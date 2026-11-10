"""Publish and attach the home language CloudFront Function without changing origins."""

import argparse
import json
from pathlib import Path

import boto3

FUNCTION_NAME = "pokesettle-home-locale"


def publish_locale_function(cf, name=FUNCTION_NAME):
    config = {"Comment": "PokeSettle home language by saved choice or KR/JP/CN", "Runtime": "cloudfront-js-2.0"}
    code = Path(__file__).with_suffix(".js").read_bytes()
    try:
        current = cf.describe_function(Name=name, Stage="DEVELOPMENT")
    except cf.exceptions.NoSuchFunctionExists:
        result = cf.create_function(Name=name, FunctionConfig=config, FunctionCode=code)
    else:
        result = cf.update_function(Name=name, IfMatch=current["ETag"], FunctionConfig=config, FunctionCode=code)
    published = cf.publish_function(Name=name, IfMatch=result["ETag"])
    return published["FunctionSummary"]["FunctionMetadata"]["FunctionARN"]


def associate_locale_function(default, arn):
    # Keep an existing viewer-response function; never silently replace another viewer-request function.
    items = default.get("FunctionAssociations", {}).get("Items", [])
    if any(item["EventType"] == "viewer-request" and item["FunctionARN"] != arn for item in items):
        raise ValueError("A different viewer-request function is already attached")
    if any(item["EventType"] == "viewer-request" for item in default.get("LambdaFunctionAssociations", {}).get("Items", [])):
        raise ValueError("A viewer-request Lambda@Edge function is already attached")
    items = [item for item in items if item["EventType"] != "viewer-request"]
    items.append({"EventType": "viewer-request", "FunctionARN": arn})
    default["FunctionAssociations"] = {"Quantity": len(items), "Items": items}


def configure(distribution_id):
    cf = boto3.client("cloudfront", region_name="us-east-1")
    current = cf.get_distribution_config(Id=distribution_id)
    config = current["DistributionConfig"]
    name = FUNCTION_NAME
    # Validate associations before publishing a function used by live traffic.
    account = boto3.client("sts", region_name="us-east-1").get_caller_identity()["Account"]
    arn = f"arn:aws:cloudfront::{account}:function/{name}"
    associate_locale_function(config["DefaultCacheBehavior"], arn)
    publish_locale_function(cf, name)
    result = cf.update_distribution(Id=distribution_id, IfMatch=current["ETag"], DistributionConfig=config)
    print(json.dumps({"distribution_id": distribution_id, "function_arn": arn,
                      "status": result["Distribution"]["Status"]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--distribution-id", required=True)
    configure(parser.parse_args().distribution_id)
