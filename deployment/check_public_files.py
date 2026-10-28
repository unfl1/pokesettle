"""Reject credentials and private operational artifacts before building or publishing."""

import re
import subprocess
from pathlib import Path

PATTERNS = [
    r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
    r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
    r"\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}",
    r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})",
]


def check():
    failures = []
    for name in subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"]).decode().split("\0"):
        if not name:
            continue
        path = Path(name)
        if not path.exists():
            continue
        if ({".secrets", ".aws", "private", "runtime", "backups", "node_modules"} & set(path.parts)
                or path.suffix in {".pem", ".key", ".dump", ".sqlite3", ".log"}
                or path.name.startswith(".env") and path.name not in {".env.example", ".env.production.example"}
                or path.name.startswith(("poketact-deployment", "pokesettle-deployment")) and path.suffix == ".json"
                or path.name.startswith("origin-token")):
            failures.append(name + ": private artifact")
        try:
            text = path.read_text()
        except UnicodeDecodeError:
            continue
        if any(re.search(pattern, text) for pattern in PATTERNS):
            failures.append(name + ": credential pattern")
    if failures:
        raise SystemExit("\n".join(failures))
    print("Public tracked files: credential and private artifact checks passed")


if __name__ == "__main__":
    check()
