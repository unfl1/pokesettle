"""Provision private S3 + CloudFront from an authenticated AWS CloudShell session."""

import argparse
import json
import mimetypes
import re
import time
import zipfile
from pathlib import Path

import boto3
from botocore.exceptions import ClientError


def provision(domain, region, bundle, state_path):
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]+\.[a-z]{2,}", domain):
        raise ValueError("Invalid domain")
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    account = boto3.client("sts").get_caller_identity()["Account"]
    s3 = boto3.client("s3", region_name=region)
    cf = boto3.client("cloudfront")
    acm = boto3.client("acm", region_name="us-east-1")
    bucket = state.get("bucket", f"poketact-web-{account}-{region}")
    try:
        s3.head_bucket(Bucket=bucket)
    except ClientError as error:
        if error.response["Error"]["Code"] not in {"404", "NoSuchBucket"}:
            raise
        s3.create_bucket(Bucket=bucket, CreateBucketConfiguration={"LocationConstraint": region})
    s3.put_public_access_block(Bucket=bucket, PublicAccessBlockConfiguration={
        "BlockPublicAcls": True, "IgnorePublicAcls": True,
        "BlockPublicPolicy": True, "RestrictPublicBuckets": True,
    })
    s3.put_bucket_ownership_controls(Bucket=bucket, OwnershipControls={
        "Rules": [{"ObjectOwnership": "BucketOwnerEnforced"}],
    })
    s3.put_bucket_encryption(Bucket=bucket, ServerSideEncryptionConfiguration={
        "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}],
    })
    state["bucket"] = bucket

    oac_name = f"poketact-{domain}"
    oacs = cf.list_origin_access_controls()["OriginAccessControlList"].get("Items", [])
    oac = next((x for x in oacs if x["Name"] == oac_name), None)
    if oac is None:
        oac = cf.create_origin_access_control(OriginAccessControlConfig={
            "Name": oac_name, "Description": "Read public frontend files from a private bucket",
            "SigningProtocol": "sigv4", "SigningBehavior": "always",
            "OriginAccessControlOriginType": "s3",
        })["OriginAccessControl"]

    if not state.get("distribution_id"):
        distribution = cf.create_distribution(DistributionConfig={
            "CallerReference": f"poketact-{domain}-{int(time.time())}",
            "Comment": f"PokeTact frontend {domain}", "Enabled": True,
            "DefaultRootObject": "index.html", "HttpVersion": "http2and3",
            "IsIPV6Enabled": True, "PriceClass": "PriceClass_All",
            "Origins": {"Quantity": 1, "Items": [{
                "Id": "frontend-s3", "DomainName": f"{bucket}.s3.{region}.amazonaws.com",
                "OriginAccessControlId": oac["Id"],
                "S3OriginConfig": {"OriginAccessIdentity": ""},
            }]},
            "DefaultCacheBehavior": {
                "TargetOriginId": "frontend-s3", "ViewerProtocolPolicy": "redirect-to-https",
                "TrustedSigners": {"Enabled": False, "Quantity": 0}, "Compress": True,
                "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"],
                                   "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}},
                "ForwardedValues": {"QueryString": False, "Cookies": {"Forward": "none"}},
                "MinTTL": 0, "DefaultTTL": 300, "MaxTTL": 31536000,
            },
            "ViewerCertificate": {"CloudFrontDefaultCertificate": True},
        })["Distribution"]
        state.update(distribution_id=distribution["Id"], cloudfront_domain=distribution["DomainName"])
    distribution_arn = f"arn:aws:cloudfront::{account}:distribution/{state['distribution_id']}"
    s3.put_bucket_policy(Bucket=bucket, Policy=json.dumps({
        "Version": "2012-10-17", "Statement": [{
            "Sid": "CloudFrontReadOnly", "Effect": "Allow",
            "Principal": {"Service": "cloudfront.amazonaws.com"},
            "Action": "s3:GetObject", "Resource": f"arn:aws:s3:::{bucket}/*",
            "Condition": {"StringEquals": {"AWS:SourceArn": distribution_arn}},
        }],
    }))
    state_path.write_text(json.dumps(state, indent=2))
    state_path.chmod(0o600)

    with zipfile.ZipFile(bundle) as archive:
        names = archive.namelist()
        if "index.html" not in names:
            raise ValueError("Missing index.html")
        for name in names:
            if name.endswith("/"):
                continue
            if name != "index.html" and not re.fullmatch(r"assets/[a-zA-Z0-9_./-]+", name):
                raise ValueError("Unexpected build artifact")
            if ".." in Path(name).parts or Path(name).suffix not in {".html", ".js", ".css", ".svg", ".png", ".ico", ".webp", ".woff", ".woff2"}:
                raise ValueError("Unexpected build artifact")
            s3.put_object(Bucket=bucket, Key=name, Body=archive.read(name),
                          ContentType=mimetypes.guess_type(name)[0] or "application/octet-stream",
                          CacheControl="no-cache" if name == "index.html" else "public,max-age=31536000,immutable")
    if not state.get("certificate_arn"):
        state["certificate_arn"] = acm.request_certificate(
            DomainName=f"www.{domain}", ValidationMethod="DNS",
            IdempotencyToken="poketactfrontend", Options={"CertificateTransparencyLoggingPreference": "ENABLED"},
        )["CertificateArn"]
    state.update(domain=domain, region=region)
    state_path.write_text(json.dumps(state, indent=2))
    state_path.chmod(0o600)
    certificate = acm.describe_certificate(CertificateArn=state["certificate_arn"])["Certificate"]
    print(json.dumps({**state, "dns_validation": [x.get("ResourceRecord") for x in certificate.get("DomainValidationOptions", [])]}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--region", default="ap-northeast-2")
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--state", type=Path, default=Path.home() / "poketact-deployment.json")
    args = parser.parse_args()
    provision(args.domain, args.region, args.bundle, args.state)
