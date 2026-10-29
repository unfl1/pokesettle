"""Connect CloudFront to the authenticated Next.js and FastAPI server origin."""

import argparse
import json
import re
from pathlib import Path

import boto3


def connect(state_path, token_path):
    if not token_path:
        raise ValueError("SSR requires an authenticated HTTPS server origin")
    state = json.loads(state_path.read_text())
    domain = state["domain"]
    cf = boto3.client("cloudfront")
    certificate = boto3.client("acm", region_name="us-east-1").describe_certificate(
        CertificateArn=state["certificate_arn"]
    )["Certificate"]
    if certificate["Status"] != "ISSUED":
        raise RuntimeError(f"Certificate is {certificate['Status']}; retry after DNS validation")
    current = cf.get_distribution_config(Id=state["distribution_id"])
    config = current["DistributionConfig"]
    config["Aliases"] = {"Quantity": 1, "Items": [f"www.{domain}"]}
    config["ViewerCertificate"] = {
        "ACMCertificateArn": state["certificate_arn"], "SSLSupportMethod": "sni-only",
        "MinimumProtocolVersion": "TLSv1.2_2021",
    }
    config["DefaultCacheBehavior"]["FunctionAssociations"] = {"Quantity": 0}
    token = token_path.read_text().strip()
    if not re.fullmatch(r"[a-f0-9]{64}", token):
        raise ValueError("Expected a private 64-character hexadecimal origin token")
    origins = [{
        "Id": "backend-api", "DomainName": f"api.{domain}", "OriginPath": "",
        "CustomHeaders": {"Quantity": 1, "Items": [{"HeaderName": "X-PokeTact-Origin", "HeaderValue": token}]},
        "CustomOriginConfig": {"HTTPPort": 80, "HTTPSPort": 443,
                               "OriginProtocolPolicy": "https-only",
                               "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]},
                               "OriginReadTimeout": 60, "OriginKeepaliveTimeout": 5},
    }]
    config["Origins"] = {"Quantity": len(origins), "Items": origins}
    cache_policies = cf.list_cache_policies(Type="managed")["CachePolicyList"]["Items"]
    request_policies = cf.list_origin_request_policies(Type="managed")["OriginRequestPolicyList"]["Items"]
    cache_id = next(x["CachePolicy"]["Id"] for x in cache_policies
                    if x["CachePolicy"]["CachePolicyConfig"]["Name"] == "Managed-CachingDisabled")
    request_id = next(x["OriginRequestPolicy"]["Id"] for x in request_policies
                      if x["OriginRequestPolicy"]["OriginRequestPolicyConfig"]["Name"] == "Managed-AllViewerExceptHostHeader")
    behaviors = []
    for pattern in ("/api", "/api/*"):
        behaviors.append({
            "PathPattern": pattern, "TargetOriginId": "backend-api",
            "ViewerProtocolPolicy": "redirect-to-https", "Compress": True,
            "SmoothStreaming": False, "FieldLevelEncryptionId": "",
            "LambdaFunctionAssociations": {"Quantity": 0},
            "FunctionAssociations": {"Quantity": 0},
            "TrustedSigners": {"Enabled": False, "Quantity": 0},
            "AllowedMethods": {"Quantity": 7, "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
                               "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}},
            "CachePolicyId": cache_id, "OriginRequestPolicyId": request_id,
        })
    config["CacheBehaviors"] = {"Quantity": len(behaviors), "Items": behaviors}
    config["DefaultRootObject"] = ""
    config["CustomErrorResponses"] = {"Quantity": 0}
    default = config["DefaultCacheBehavior"]
    default.update(TargetOriginId="backend-api", ViewerProtocolPolicy="redirect-to-https", CachePolicyId=cache_id,
                   OriginRequestPolicyId=request_id,
                   AllowedMethods={"Quantity": 7,
                                   "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
                                   "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}})
    default.pop("ForwardedValues", None)
    for key in ("MinTTL", "DefaultTTL", "MaxTTL"):
        default.pop(key, None)
    result = cf.update_distribution(Id=state["distribution_id"], IfMatch=current["ETag"], DistributionConfig=config)
    cf.create_invalidation(DistributionId=state["distribution_id"], InvalidationBatch={
        "Paths": {"Quantity": 1, "Items": ["/*"]}, "CallerReference": result["ETag"],
    })
    print(json.dumps({"domain": f"www.{domain}", "status": result["Distribution"]["Status"],
                      "api_connected": bool(token_path)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", type=Path, default=Path.home() / "poketact-deployment.json")
    parser.add_argument("--origin-token-file", type=Path, required=True)
    args = parser.parse_args()
    connect(args.state, args.origin_token_file)
