#!/usr/bin/env bash
set -euo pipefail
umask 077
task_ssh_dir=$(mktemp -d "$RUNNER_TEMP/poketact-ssh.XXXXXX")
trap 'rm -rf "$task_ssh_dir"' EXIT
printf '%s\n' "$DEPLOY_SSH_KEY" > "$task_ssh_dir/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$task_ssh_dir/known_hosts"
ssh -i "$task_ssh_dir/key" \
  -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes \
  -o "UserKnownHostsFile=$task_ssh_dir/known_hosts" -o ConnectTimeout=20 \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=20 \
  "ubuntu@$DEPLOY_HOST" "deploy $GITHUB_SHA" < "$1"
