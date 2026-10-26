"""Provision CloudFront for the Next.js HTTPS server from AWS CloudShell."""

import argparse
import json
import re
import time
from pathlib import Path

import boto3


def provision(domain, token_path, state_path):
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]+\.[a-z]{2,}", domain):
        raise ValueError("Invalid domain")
    token = token_path.read_text().strip()
    if not re.fullmatch(r"[a-f0-9]{64}", token):
        raise ValueError("Expected a private 64-character hexadecimal origin token")
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    if state.get("domain", domain) != domain:
        raise ValueError("State belongs to a different domain")
    cf = boto3.client("cloudfront")
    acm = boto3.client("acm", region_name="us-east-1")
    if not state.get("distribution_id"):
        cache_id = next(x["CachePolicy"]["Id"] for x in
                        cf.list_cache_policies(Type="managed")["CachePolicyList"]["Items"]
                        if x["CachePolicy"]["CachePolicyConfig"]["Name"] == "Managed-CachingDisabled")
        request_id = next(x["OriginRequestPolicy"]["Id"] for x in
                          cf.list_origin_request_policies(Type="managed")["OriginRequestPolicyList"]["Items"]
                          if x["OriginRequestPolicy"]["OriginRequestPolicyConfig"]["Name"] == "Managed-AllViewerExceptHostHeader")
        distribution = cf.create_distribution(DistributionConfig={
            "CallerReference": f"poketact-{domain}-{time.time_ns()}",
            "Comment": f"PokeTact Next.js {domain}", "Enabled": True,
            "DefaultRootObject": "", "HttpVersion": "http2and3",
            "IsIPV6Enabled": True, "PriceClass": "PriceClass_All",
            "Origins": {"Quantity": 1, "Items": [{
                "Id": "backend-api", "DomainName": f"api.{domain}", "OriginPath": "",
                "CustomHeaders": {"Quantity": 1, "Items": [{"HeaderName": "X-PokeTact-Origin", "HeaderValue": token}]},
                "CustomOriginConfig": {"HTTPPort": 80, "HTTPSPort": 443,
                                       "OriginProtocolPolicy": "https-only",
                                       "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]},
                                       "OriginReadTimeout": 60, "OriginKeepaliveTimeout": 5},
            }]},
            "DefaultCacheBehavior": {
                "TargetOriginId": "backend-api", "ViewerProtocolPolicy": "redirect-to-https",
                "TrustedSigners": {"Enabled": False, "Quantity": 0}, "Compress": True,
                "AllowedMethods": {"Quantity": 7, "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
                                   "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}},
                "CachePolicyId": cache_id, "OriginRequestPolicyId": request_id,
            },
            "ViewerCertificate": {"CloudFrontDefaultCertificate": True},
        })["Distribution"]
        state.update(distribution_id=distribution["Id"], cloudfront_domain=distribution["DomainName"], domain=domain)
        state_path.write_text(json.dumps(state, indent=2))
        state_path.chmod(0o600)
    if not state.get("certificate_arn"):
        state["certificate_arn"] = acm.request_certificate(
            DomainName=f"www.{domain}", ValidationMethod="DNS",
            IdempotencyToken="poketactfrontend", Options={"CertificateTransparencyLoggingPreference": "ENABLED"},
        )["CertificateArn"]
    state_path.write_text(json.dumps(state, indent=2))
    state_path.chmod(0o600)
    certificate = acm.describe_certificate(CertificateArn=state["certificate_arn"])["Certificate"]
    print(json.dumps({**state, "dns_validation": [x.get("ResourceRecord") for x in certificate.get("DomainValidationOptions", [])]}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--origin-token-file", type=Path, required=True)
    parser.add_argument("--state", type=Path, default=Path.home() / "poketact-deployment.json")
    args = parser.parse_args()
    provision(args.domain, args.origin_token_file, args.state)
