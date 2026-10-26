"""Package only explicit deployment files and a locally built Docker image."""

import argparse
import tarfile
from pathlib import Path

from deployment.receive_release import CONFIG_FILES


def package(image, destination):
    # Fast compression keeps the bounded SSH bundle format without spending
    # minutes recompressing Docker layers at gzip's default level.
    with tarfile.open(destination, "w:gz", compresslevel=1) as archive:
        archive.add(image, arcname="image.tar", recursive=False)
        for name in sorted(CONFIG_FILES):
            # Keep the server bundle layout stable when repository files move.
            path = (Path("deployment/docker") / name
                    if name in {"compose.production.yaml", "compose.observability.yaml"}
                    else Path(name))
            if not path.is_file() or path.is_symlink():
                raise ValueError("Expected a regular deployment file")
            archive.add(path, arcname=name, recursive=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    package(args.image, args.output)
