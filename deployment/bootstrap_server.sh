#!/usr/bin/env bash
# Run once as root from a reviewed checkout, with a dedicated deployment PUBLIC key.
set -euo pipefail
if [[ $EUID -ne 0 || $# -ne 1 ]]; then
  echo 'Usage: sudo bash deployment/bootstrap_server.sh dedicated-deploy-key.pub' >&2
  exit 1
fi
python3 - "$1" <<'PY'
import base64
import os
import re
import secrets
import subprocess
import sys
from pathlib import Path

key = Path(sys.argv[1]).read_text().strip()
if not re.fullmatch(r'ssh-ed25519 [A-Za-z0-9+/=]+(?: [^\r\n]+)?', key):
    raise SystemExit('Dedicated Ed25519 public key required')
base64.b64decode(key.split()[1], validate=True)
if not Path('/home/ubuntu/poketact/.env.production').is_file():
    raise SystemExit('Existing production environment required')
root = Path('/etc/poketact')
root.mkdir(mode=0o700, exist_ok=True)
env = root / 'observability.env'
if not env.exists():
    fd = os.open(env, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write('GF_SECURITY_ADMIN_USER=admin\nGF_SECURITY_ADMIN_PASSWORD=' + secrets.token_hex(32) + '\n')
Path('/usr/local/lib/poketact').mkdir(mode=0o755, parents=True, exist_ok=True)
subprocess.run(['install', '-o', 'root', '-g', 'root', '-m', '755',
                'deployment/receive_release.py', '/usr/local/lib/poketact/receive-release.py'], check=True)
authorized = Path('/home/ubuntu/.ssh/authorized_keys')
original = authorized.read_text() if authorized.exists() else ''
forced = r'restrict,command="sudo -n /usr/local/lib/poketact/receive-release.py \"$SSH_ORIGINAL_COMMAND\"" '
if not any(key.split()[1] in line.split() for line in original.splitlines()):
    authorized.write_text(original.rstrip() + '\n' + forced + key + '\n')
    authorized.chmod(0o600)
    subprocess.run(['chown', 'ubuntu:ubuntu', str(authorized)], check=True)
print('Restricted deployment key and private Grafana settings installed; no ports opened')
PY
