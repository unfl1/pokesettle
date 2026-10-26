"""Create a narrowly scoped GitHub OIDC role from an authenticated AWS CloudShell."""

import argparse
import copy
import json
import os
import re
from pathlib import Path

import boto3


def validate_subject_prefix(subject_prefix, repository):
    owner, name = repository.split("/")
    immutable = rf"repo:{re.escape(owner)}@[0-9]+/{re.escape(name)}@[0-9]+"
    if subject_prefix != f"repo:{repository}" and not re.fullmatch(immutable, subject_prefix):
        raise ValueError("Use the exact subject prefix reported by this repository's OIDC API")


def configure(state_path, repository, subject_prefix, *, migrate_legacy_subject=False):
    validate_subject_prefix(subject_prefix, repository)
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
                "token.actions.githubusercontent.com:sub": f"{subject_prefix}:environment:production",
            }},
        }],
    }
    role = "poketact-github-production"
    try:
        result = iam.create_role(RoleName=role, AssumeRolePolicyDocument=json.dumps(trust),
                                 Description="PokeTact deployment from protected production environment")
    except iam.exceptions.EntityAlreadyExistsException:
        # Only an explicit migration of this exact repository's old subject is allowed.
        existing = iam.get_role(RoleName=role)
        if existing["Role"]["AssumeRolePolicyDocument"] != trust:
            legacy = copy.deepcopy(trust)
            legacy["Statement"][0]["Condition"]["StringEquals"]["token.actions.githubusercontent.com:sub"] = (
                f"repo:{repository}:environment:production")
            if not migrate_legacy_subject or existing["Role"]["AssumeRolePolicyDocument"] != legacy:
                raise RuntimeError("Existing deployment role has different trust; review required") from None
            iam.update_assume_role_policy(RoleName=role, PolicyDocument=json.dumps(trust))
        result = existing
    distribution = f"arn:aws:cloudfront::{account}:distribution/{state['distribution_id']}"
    policy = {"Version": "2012-10-17", "Statement": [
        {"Effect": "Allow", "Action": ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"],
         "Resource": distribution},
    ]}
    iam.put_role_policy(RoleName=role, PolicyName="FrontendPublish", PolicyDocument=json.dumps(policy))
    output = state_path.with_name("github-production-secrets.json")
    values = {
        "AWS_ROLE_ARN": result["Role"]["Arn"],
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
    parser.add_argument("--subject-prefix", required=True,
                        help="Exact sub_claim_prefix from the GitHub repository OIDC API")
    parser.add_argument("--migrate-legacy-subject", action="store_true",
                        help="Replace only this repository's exact legacy subject, preserving all other trust conditions")
    args = parser.parse_args()
    configure(args.state, args.repository, args.subject_prefix,
              migrate_legacy_subject=args.migrate_legacy_subject)
