#!/usr/bin/env python3
"""Root-owned forced SSH command; accepts only a bounded, immutable release bundle."""

import fcntl
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path("/var/lib/poketact-deploy")
LEGACY = Path("/home/ubuntu/poketact")
ENV = LEGACY / ".env.production"
MONITOR_ENV = Path("/etc/poketact/observability.env")
MAX_BUNDLE = 1_500_000_000
CONFIG_FILES = {
    "compose.production.yaml", "compose.observability.yaml",
    "deployment/observability/prometheus.yaml", "deployment/observability/alerts.yaml",
    "deployment/observability/loki.yaml", "deployment/observability/config.alloy",
    "deployment/observability/grafana/provisioning/datasources/default.yaml",
    "deployment/observability/grafana/provisioning/dashboards/default.yaml",
    "deployment/observability/grafana/dashboards/operations.json",
}


def run(args, *, env=None):
    # Never relay Docker/Compose diagnostics: expanded environment values can be present.
    result = subprocess.run(args, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if result.returncode:
        raise RuntimeError("Deployment command failed; inspect privately on the server")


def extract_bundle(bundle, destination):
    expected = CONFIG_FILES | {"image.tar"}
    with tarfile.open(bundle, "r:gz") as archive:
        files, names = [], set()
        for member in archive:
            if member.name not in expected or member.name in names:
                raise ValueError("Unexpected or duplicate release file")
            limit = 3_000_000_000 if member.name == "image.tar" else 1_000_000
            if not member.isfile() or member.size < 0 or member.size > limit:
                raise ValueError("Invalid release member")
            files.append(member)
            names.add(member.name)
        if names != expected:
            raise ValueError("Missing release files")
        archive.extractall(destination, members=files, filter="data")


def compose(directory, image_tag, *args, monitoring=True):
    environment = os.environ.copy()
    environment["IMAGE_TAG"] = image_tag
    command = ["docker", "compose", "--project-name", "poketact", "--project-directory", str(directory),
               "--env-file", str(ENV), "-f", str(directory / "compose.production.yaml")]
    if monitoring:
        command += ["-f", str(directory / "compose.observability.yaml")]
    run(command + list(args), env=environment)


def ready():
    with urllib.request.urlopen("http://127.0.0.1:8000/api/status", timeout=10) as response:
        if not json.load(response)["data"]["ready"]:
            raise RuntimeError("API is not ready")
    with urllib.request.urlopen("http://127.0.0.1:3001/chat", timeout=10) as response:
        if "PokeTact" not in response.read().decode():
            raise RuntimeError("Frontend is not ready")
    with urllib.request.urlopen("http://127.0.0.1:3000/api/health", timeout=10) as response:
        if json.load(response).get("database") != "ok":
            raise RuntimeError("Grafana is not ready")


def deploy(release, sha):
    current = ROOT / "current.json"
    previous = json.loads(current.read_text()) if current.exists() else {
        "directory": str(LEGACY), "image_tag": "local", "monitoring": False,
    }
    (release / ".env.production").symlink_to(ENV)
    (release / ".env.observability").symlink_to(MONITOR_ENV)
    compose(release, sha, "config", "--quiet")
    run(["docker", "load", "--input", str(release / "image.tar")])
    run(["docker", "image", "inspect", "poketact-backend:" + sha])
    run(["docker", "image", "inspect", "poketact-frontend:" + sha])
    (release / "image.tar").unlink()
    # Alloy runs as the API UID and needs its persistent positions directory owned by that UID.
    run(["docker", "volume", "create", "poketact_alloy_data"])
    result = subprocess.run(["docker", "volume", "inspect", "--format", "{{.Mountpoint}}", "poketact_alloy_data"],
                            check=True, capture_output=True, text=True)
    os.chown(result.stdout.strip(), 10001, 10001)
    for attempt in range(3):
        try:
            compose(release, sha, "pull", "prometheus", "loki", "alloy", "node-exporter", "grafana")
            break
        except RuntimeError:
            if attempt == 2:
                raise
            time.sleep(5)
    try:
        compose(release, sha, "up", "-d", "--wait", "--wait-timeout", "180", "--no-deps", "--no-build",
                "api", "frontend", "prometheus", "loki", "alloy", "node-exporter", "grafana")
        # Grafana may still be initializing after its container has started.
        for attempt in range(30):
            try:
                ready()
                break
            except Exception:
                if attempt == 29:
                    raise RuntimeError("Release readiness check failed") from None
                time.sleep(2)
    except Exception:
        services = ["api"]
        if previous.get("frontend"):
            services += ["frontend"]
        else:
            compose(release, sha, "stop", "frontend")
        if previous["monitoring"]:
            services += ["prometheus", "loki", "alloy", "node-exporter", "grafana"]
        compose(Path(previous["directory"]), previous["image_tag"], "up", "-d", "--wait",
                "--wait-timeout", "180", "--no-deps", "--no-build", *services, monitoring=previous["monitoring"])
        if not previous["monitoring"]:
            compose(release, sha, "stop", "prometheus", "loki", "alloy", "node-exporter", "grafana")
        raise RuntimeError("New release failed; previous API image restored") from None
    record = {"directory": str(release), "image_tag": sha, "monitoring": True, "frontend": True}
    temporary = ROOT / "current.next.json"
    temporary.write_text(json.dumps(record))
    temporary.replace(current)
    # Retain the active and previous release, including their images; never touch DB volumes.
    keep = {str(release), previous["directory"]}
    for old in ROOT.iterdir():
        if old.is_dir() and not old.is_symlink() and re.fullmatch(r"[a-f0-9]{40}-.+", old.name) and str(old) not in keep:
            shutil.rmtree(old)
    result = subprocess.run(["docker", "image", "ls", "--format", "{{.Tag}}", "poketact-backend"],
                            check=True, capture_output=True, text=True)
    for tag in result.stdout.splitlines():
        if re.fullmatch(r"[a-f0-9]{40}", tag) and tag not in {sha, previous["image_tag"]}:
            subprocess.run(["docker", "image", "rm", "poketact-backend:" + tag],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("Backend and monitoring release healthy")


def main(command):
    match = re.fullmatch(r"deploy ([a-f0-9]{40})", command)
    if not match:
        raise ValueError("Only deploy followed by a commit SHA is allowed")
    if os.geteuid() != 0 or not ENV.is_file() or not MONITOR_ENV.is_file():
        raise RuntimeError("Server bootstrap required")
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (ROOT / "deploy.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if shutil.disk_usage(ROOT).free < 8_000_000_000:
            raise RuntimeError("At least 8 GB free disk required")
        release = Path(tempfile.mkdtemp(prefix=match[1] + "-", dir=ROOT))
        bundle = release / "bundle.tar.gz"
        try:
            total = 0
            with bundle.open("wb") as output:
                while chunk := sys.stdin.buffer.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_BUNDLE:
                        raise ValueError("Release bundle too large")
                    output.write(chunk)
            extract_bundle(bundle, release)
            bundle.unlink()
            deploy(release, match[1])
        except Exception:
            # Preserve config for private diagnosis, but discard large transfer artifacts.
            bundle.unlink(missing_ok=True)
            (release / "image.tar").unlink(missing_ok=True)
            raise


if __name__ == "__main__":
    try:
        main(sys.argv[1] if len(sys.argv) == 2 else "")
    except Exception as error:
        # The type is sufficient for CI; exception messages may contain private paths or URLs.
        print("Deployment failed: " + type(error).__name__, file=sys.stderr)
        sys.exit(1)
