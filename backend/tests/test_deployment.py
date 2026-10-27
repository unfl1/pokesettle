import importlib
import io
import json
import sys
import tarfile
from types import SimpleNamespace

import pytest

from deployment import receive_release as receiver
from deployment.check_production import check as check_production
from deployment.package_release import package


@pytest.mark.parametrize("failure", [None, "old_home", "redirect", "chat", "assets", "asset_status", "api"])
def test_public_smoke_checks_home_chat_assets_and_api(monkeypatch, failure):
    base = "https://www.example.com"
    asset = "/_next/static/app.js"
    calls = []

    class Response(io.BytesIO):
        def __init__(self, url, text, status=200):
            super().__init__(text.encode())
            self.url = url
            self.status = status

    def open_url(url, timeout):
        calls.append(url)
        if url == base + "/api/status":
            return Response(url, json.dumps({"data": {"ready": failure != "api"}}))
        if url == base + asset:
            return Response(url, "js", 404 if failure == "asset_status" else 200)
        marker = "배틀 준비는 PokeTact에서" if url == base + "/ko" else "전략 챗봇"
        if failure == "old_home" and url == base + "/ko":
            marker = "전략 챗봇"
        if failure == "chat" and url == base + "/ko/chat":
            marker = "PokeTact"
        html = marker + (f'<script src="{asset}"></script>' if failure != "assets" else "")
        return Response(base + "/ko/chat" if failure == "redirect" else url, html)

    monkeypatch.setattr("deployment.check_production.urllib.request.urlopen", open_url)
    if failure:
        with pytest.raises(ValueError):
            check_production(base)
    else:
        check_production(base)
        assert calls == [base + "/ko", base + "/ko/chat", base + asset, base + "/api/status"]


def test_public_smoke_rejects_plain_http():
    with pytest.raises(ValueError, match="HTTPS"):
        check_production("http://www.example.com")


def make_bundle(path, changes=None):
    changes = changes or {}
    with tarfile.open(path, "w:gz") as archive:
        for name in receiver.CONFIG_FILES | {"image.tar"}:
            member = tarfile.TarInfo(name)
            member.size = 1
            if name in changes:
                changes[name](member)
            archive.addfile(member, io.BytesIO(b"x" * member.size) if member.isfile() else None)


@pytest.mark.parametrize("attack", ["path", "symlink", "size", "duplicate"])
def test_release_rejects_unexpected_paths_links_sizes_and_duplicate_members(tmp_path, attack):
    bundle = tmp_path / "release.tar.gz"
    name = "compose.production.yaml"
    if attack == "path":
        changes = {name: lambda m: setattr(m, "name", "../.env.production")}
    elif attack == "symlink":
        changes = {name: lambda m: (setattr(m, "type", tarfile.SYMTYPE), setattr(m, "linkname", "/etc/passwd"))}
    elif attack == "size":
        changes = {name: lambda m: setattr(m, "size", 1_000_001)}
    else:
        changes = {name: lambda m: setattr(m, "name", "image.tar")}
    make_bundle(bundle, changes)
    with pytest.raises((ValueError, tarfile.TarError)):
        receiver.extract_bundle(bundle, tmp_path / "extracted")


def test_release_package_excludes_environment_and_unlisted_files(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    for name in receiver.CONFIG_FILES:
        source = "deployment/docker/" + name if name.startswith("compose.") else name
        path = tmp_path / source
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("public")
    (tmp_path / ".env.production").write_text("PRIVATE_VALUE")
    (tmp_path / "image.tar").write_bytes(b"image")
    package(tmp_path / "image.tar", tmp_path / "bundle.gz")
    destination = tmp_path / "extracted"
    receiver.extract_bundle(tmp_path / "bundle.gz", destination)
    assert not (destination / ".env.production").exists()
    assert (destination / "image.tar").read_bytes() == b"image"


def test_failed_readiness_restores_previous_api_without_advancing_pointer(tmp_path, monkeypatch):
    monkeypatch.setattr(receiver, "ROOT", tmp_path)
    monkeypatch.setattr(receiver, "run", lambda *a, **k: None)
    monkeypatch.setattr(receiver.os, "chown", lambda *a: None)
    monkeypatch.setattr(receiver.subprocess, "run", lambda *a, **k: SimpleNamespace(stdout=str(tmp_path)))
    monkeypatch.setattr(receiver.time, "sleep", lambda *a: None)
    monkeypatch.setattr(receiver, "ready", lambda: (_ for _ in ()).throw(RuntimeError("not ready")))
    previous = {"directory": str(tmp_path / "previous"), "image_tag": "old", "monitoring": True}
    (tmp_path / "current.json").write_text(json.dumps(previous))
    release = tmp_path / "new"
    release.mkdir()
    (release / "image.tar").write_bytes(b"image")
    calls = []
    monkeypatch.setattr(receiver, "compose", lambda *a, **k: calls.append((a, k)))
    with pytest.raises(RuntimeError, match="previous API image restored"):
        receiver.deploy(release, "a" * 40)
    assert json.loads((tmp_path / "current.json").read_text()) == previous
    assert calls[-1][0][0] == tmp_path / "previous"
    assert calls[-1][0][1] == "old"
    assert "down" not in str(calls)
    assert "--no-deps" in calls[-1][0]


@pytest.mark.parametrize("command", ["bash", "deploy main", "deploy " + "a" * 40 + "; id", "deploy " + "../a" * 40])
def test_forced_command_rejects_shell_and_non_sha_arguments(command):
    with pytest.raises(ValueError):
        receiver.main(command)


@pytest.mark.parametrize("prefix", ["repo:unfl1/poketact", "repo:unfl1@111/poketact@222"])
def test_aws_bootstrap_grants_only_frontend_publish_permissions(tmp_path, monkeypatch, prefix):
    calls = {}

    class IAM:
        def get_open_id_connect_provider(self, **kwargs):
            return {"ClientIDList": ["sts.amazonaws.com"]}

        def create_role(self, **kwargs):
            calls["trust"] = json.loads(kwargs["AssumeRolePolicyDocument"])
            return {"Role": {"Arn": "synthetic-role-arn"}}

        def put_role_policy(self, **kwargs):
            calls["policy"] = json.loads(kwargs["PolicyDocument"])

    iam = IAM()
    fake = SimpleNamespace(client=lambda name: iam if name == "iam" else SimpleNamespace(
        get_caller_identity=lambda: {"Account": "TEST_ACCOUNT"}))
    monkeypatch.setitem(sys.modules, "boto3", fake)
    sys.modules.pop("deployment.aws.bootstrap_github_oidc", None)
    bootstrap = importlib.import_module("deployment.aws.bootstrap_github_oidc")
    state = tmp_path / "poketact-deployment.json"
    state.write_text(json.dumps({"distribution_id": "synthetic-distribution", "domain": "example.com"}))
    bootstrap.configure(state, "unfl1/poketact", prefix)
    condition = calls["trust"]["Statement"][0]["Condition"]["StringEquals"]
    assert condition["token.actions.githubusercontent.com:sub"] == prefix + ":environment:production"
    actions = {a for statement in calls["policy"]["Statement"] for a in statement["Action"]}
    assert actions == {"cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"}
    output = tmp_path / "github-production-secrets.json"
    assert output.stat().st_mode & 0o777 == 0o600
    assert json.loads(output.read_text())["PRODUCTION_URL"] == "https://www.example.com"
    for invalid in ("repo:*/*", "repo:other@111/poketact@222", "repo:unfl1@111/other@222",
                    prefix + ":environment:other"):
        with pytest.raises(ValueError):
            bootstrap.validate_subject_prefix(invalid, "unfl1/poketact")


@pytest.mark.parametrize("old_subject,allowed", [
    ("repo:unfl1/poketact:environment:production", True),
    ("repo:other/poketact:environment:production", False),
])
def test_aws_subject_migration_preserves_other_conditions(tmp_path, monkeypatch, old_subject, allowed):
    import copy

    class ExistingRole(Exception):
        pass

    calls = {}

    class IAM:
        exceptions = SimpleNamespace(EntityAlreadyExistsException=ExistingRole)

        def get_open_id_connect_provider(self, **kwargs):
            return {"ClientIDList": ["sts.amazonaws.com"]}

        def create_role(self, **kwargs):
            calls["desired"] = json.loads(kwargs["AssumeRolePolicyDocument"])
            raise ExistingRole()

        def get_role(self, **kwargs):
            old = copy.deepcopy(calls["desired"])
            old["Statement"][0]["Condition"]["StringEquals"]["token.actions.githubusercontent.com:sub"] = old_subject
            return {"Role": {"Arn": "synthetic-role-arn", "AssumeRolePolicyDocument": old}}

        def update_assume_role_policy(self, **kwargs):
            calls["updated"] = json.loads(kwargs["PolicyDocument"])

        def put_role_policy(self, **kwargs):
            pass

    iam = IAM()
    monkeypatch.setitem(sys.modules, "boto3", SimpleNamespace(client=lambda name: iam if name == "iam"
                        else SimpleNamespace(get_caller_identity=lambda: {"Account": "TEST_ACCOUNT"})))
    sys.modules.pop("deployment.aws.bootstrap_github_oidc", None)
    bootstrap = importlib.import_module("deployment.aws.bootstrap_github_oidc")
    state = tmp_path / "poketact-deployment.json"
    state.write_text(json.dumps({"distribution_id": "synthetic-distribution", "domain": "example.com"}))
    if allowed:
        bootstrap.configure(state, "unfl1/poketact", "repo:unfl1@111/poketact@222", migrate_legacy_subject=True)
        assert calls["updated"] == calls["desired"]
    else:
        with pytest.raises(RuntimeError, match="different trust"):
            bootstrap.configure(state, "unfl1/poketact", "repo:unfl1@111/poketact@222", migrate_legacy_subject=True)
        assert "updated" not in calls


@pytest.mark.parametrize("operation", ["provision", "connect"])
def test_next_cloudfront_preserves_rsc_headers_and_removes_spa_cache(tmp_path, monkeypatch, operation):
    calls = {}

    class CloudFront:
        def list_cache_policies(self, **kwargs):
            return {"CachePolicyList": {"Items": [{"CachePolicy": {
                "Id": "no-cache", "CachePolicyConfig": {"Name": "Managed-CachingDisabled"},
            }}]}}

        def list_origin_request_policies(self, **kwargs):
            return {"OriginRequestPolicyList": {"Items": [{"OriginRequestPolicy": {
                "Id": "viewer-headers", "OriginRequestPolicyConfig": {"Name": "Managed-AllViewerExceptHostHeader"},
            }}]}}

        def get_distribution_config(self, **kwargs):
            return {"ETag": "version", "DistributionConfig": {
                "Origins": {"Items": [{"Id": "frontend-s3"}]},
                "DefaultCacheBehavior": {"ForwardedValues": {}, "DefaultTTL": 300},
                "DefaultRootObject": "index.html",
                "CacheBehaviors": {"Items": [{"PathPattern": "/assets/*"}]},
                "CustomErrorResponses": {"Quantity": 1},
            }}

        def create_distribution(self, **kwargs):
            calls["config"] = kwargs["DistributionConfig"]
            return {"Distribution": {"Id": "distribution", "DomainName": "synthetic.cloudfront.net"}}

        def update_distribution(self, **kwargs):
            calls["config"] = kwargs["DistributionConfig"]
            return {"ETag": "updated", "Distribution": {"Status": "InProgress"}}

        def create_invalidation(self, **kwargs):
            calls["invalidation"] = kwargs

    acm = SimpleNamespace(
        request_certificate=lambda **kwargs: {"CertificateArn": "certificate"},
        describe_certificate=lambda **kwargs: {"Certificate": {"Status": "ISSUED"}},
    )
    cf = CloudFront()
    monkeypatch.setitem(sys.modules, "boto3", SimpleNamespace(client=lambda name, **kwargs: cf if name == "cloudfront" else acm))
    module_name = f"deployment.aws.{operation}_frontend"
    sys.modules.pop(module_name, None)
    module = importlib.import_module(module_name)
    state = tmp_path / "state.json"
    token = tmp_path / "token"
    token.write_text("a" * 64)
    if operation == "provision":
        module.provision("example.com", token, state)
        assert "bucket" not in json.loads(state.read_text())
    else:
        state.write_text(json.dumps({"domain": "example.com", "distribution_id": "distribution", "certificate_arn": "certificate"}))
        module.connect(state, token)
        assert calls["invalidation"]["InvalidationBatch"]["Paths"]["Items"] == ["/*"]
    config = calls["config"]
    default = config["DefaultCacheBehavior"]
    assert config["DefaultRootObject"] == ""
    assert default["CachePolicyId"] == "no-cache"
    assert default["OriginRequestPolicyId"] == "viewer-headers"
    assert "ForwardedValues" not in default
    assert "DefaultTTL" not in default
    assert config["Origins"]["Quantity"] == 1
    assert config["Origins"]["Items"][0]["CustomOriginConfig"]["OriginProtocolPolicy"] == "https-only"
    assert default.get("FunctionAssociations", {}).get("Quantity", 0) == 0
    assert config.get("CustomErrorResponses", {}).get("Quantity", 0) == 0
    assert all(item["PathPattern"].startswith("/api") for item in config.get("CacheBehaviors", {}).get("Items", []))
