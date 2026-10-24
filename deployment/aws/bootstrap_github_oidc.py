"""Create a narrowly scoped GitHub OIDC role from an authenticated AWS CloudShell."""

import argparse
import json
import os
from pathlib import Path

import boto3


def configure(state_path, repository):
    # Resource identifiers remain in the private CloudShell state, never in source control.
    state = json.loads(state_path.read_text())
    account = boto3.client("sts").get_caller_identity()["Account"]
    iam = boto3.client("iam")
    provider = f"arn:aws:iam::{account}:oidc-provider/token.actions.githubusercontent.com"
    try:
        existing = iam.get_open_id_connect_provider(OpenIDConnectProviderArn=provider)
        if "sts.amazonaws.com" not in existing["ClientIDList"]:
            iam.add_client_id_to_open_id_connect_provider(
                OpenIDConnectProviderArn=provider, ClientID="sts.amazonaws.com")
    except iam.exceptions.NoSuchEntityException:
        iam.create_open_id_connect_provider(
            Url="https://token.actions.githubusercontent.com", ClientIDList=["sts.amazonaws.com"])
    trust = {
        "Version": "2012-10-17", "Statement": [{
            "Effect": "Allow", "Principal": {"Federated": provider},
            "Action": "sts:AssumeRoleWithWebIdentity", "Condition": {"StringEquals": {
                "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                "token.actions.githubusercontent.com:sub": f"repo:{repository}:environment:production",
            }},
        }],
    }
    role = "poketact-github-production"
    try:
        result = iam.create_role(RoleName=role, AssumeRolePolicyDocument=json.dumps(trust),
                                 Description="PokeTact frontend deployment from protected production environment")
    except iam.exceptions.EntityAlreadyExistsException:
        # Never silently repurpose a role with different trust.
        existing = iam.get_role(RoleName=role)
        if existing["Role"]["AssumeRolePolicyDocument"] != trust:
            raise RuntimeError("Existing deployment role has different trust; review required") from None
        result = existing
    bucket = state["bucket"]
    distribution = f"arn:aws:cloudfront::{account}:distribution/{state['distribution_id']}"
    policy = {"Version": "2012-10-17", "Statement": [
        {"Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": f"arn:aws:s3:::{bucket}"},
        {"Effect": "Allow", "Action": ["s3:PutObject"],
         "Resource": [f"arn:aws:s3:::{bucket}/index.html", f"arn:aws:s3:::{bucket}/assets/*"]},
        {"Effect": "Allow", "Action": ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"],
         "Resource": distribution},
    ]}
    iam.put_role_policy(RoleName=role, PolicyName="FrontendPublish", PolicyDocument=json.dumps(policy))
    output = state_path.with_name("github-production-secrets.json")
    values = {
        "AWS_ROLE_ARN": result["Role"]["Arn"], "FRONTEND_BUCKET": bucket,
        "CLOUDFRONT_DISTRIBUTION_ID": state["distribution_id"],
        "PRODUCTION_URL": f"https://www.{state['domain']}",
    }
    fd = os.open(output, os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as file:
        file.write(json.dumps(values, indent=2))
    print("OIDC role configured; deployment identifiers saved to private github-production-secrets.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", type=Path, default=Path.home() / "poketact-deployment.json")
    parser.add_argument("--repository", default="unfl1/poketact")
    args = parser.parse_args()
    configure(args.state, args.repository)
