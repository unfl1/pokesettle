"""Local MiniLM ONNX inference independent of the vector store."""

import hashlib
import shutil
import tarfile
import tempfile
from functools import cached_property
from pathlib import Path
from urllib.request import urlopen

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

# Upstream ONNX export, preserving the existing model cache and embedding space.
MODEL_URL = "https://chroma-onnx-models.s3.amazonaws.com/all-MiniLM-L6-v2/onnx.tar.gz"
MODEL_SHA256 = "913d7300ceae3b2dbc2c50d1de4baacab4be7b9380491c27fab7418616a16ec3"


class LocalEmbeddings:
    def __init__(self, directory):
        self.directory = Path(directory) / "onnx"

    def _prepare(self):
        if all((self.directory / name).is_file() for name in ("model.onnx", "tokenizer.json")):
            return
        self.directory.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=self.directory.parent) as temporary:
            archive = Path(temporary) / "model.tar.gz"
            with urlopen(MODEL_URL, timeout=120) as response, archive.open("wb") as output:
                shutil.copyfileobj(response, output)
            checksum = hashlib.sha256()
            with archive.open("rb") as source:
                for block in iter(lambda: source.read(1024 * 1024), b""):
                    checksum.update(block)
            if checksum.hexdigest() != MODEL_SHA256:
                raise ValueError("임베딩 모델 체크섬이 일치하지 않습니다.")
            self.directory.mkdir(parents=True, exist_ok=True)
            with tarfile.open(archive) as bundle:
                for name in ("model.onnx", "tokenizer.json"):
                    member = bundle.getmember(f"onnx/{name}")
                    if not member.isfile():
                        raise ValueError("임베딩 모델 파일 형식이 잘못되었습니다.")
                    staged = Path(temporary) / name
                    with bundle.extractfile(member) as source, staged.open("wb") as output:
                        shutil.copyfileobj(source, output)
                    staged.replace(self.directory / name)

    @cached_property
    def tokenizer(self):
        self._prepare()
        tokenizer = Tokenizer.from_file(str(self.directory / "tokenizer.json"))
        tokenizer.enable_truncation(max_length=256)
        tokenizer.enable_padding(pad_id=0, pad_token="[PAD]", length=256)
        return tokenizer

    @cached_property
    def model(self):
        self._prepare()
        ort.disable_telemetry_events()
        return ort.InferenceSession(
            str(self.directory / "model.onnx"), providers=["CPUExecutionProvider"]
        )

    def __call__(self, texts):
        vectors = []
        for start in range(0, len(texts), 32):
            tokens = self.tokenizer.encode_batch(texts[start : start + 32])
            ids = np.asarray([t.ids for t in tokens], dtype=np.int64)
            mask = np.asarray([t.attention_mask for t in tokens], dtype=np.int64)
            hidden = self.model.run(
                None,
                {"input_ids": ids, "attention_mask": mask, "token_type_ids": np.zeros_like(ids)},
            )[0]
            weights = mask[:, :, None]
            pooled = (hidden * weights).sum(axis=1) / np.maximum(weights.sum(axis=1), 1)
            normalized = pooled / np.maximum(np.linalg.norm(pooled, axis=1, keepdims=True), 1e-12)
            vectors.extend(normalized.astype(np.float32).tolist())
        return vectors
