import threading
from concurrent.futures import ThreadPoolExecutor

import pytest

from backend.app.core.config import Settings
from backend.app.rag.embeddings import LocalEmbeddings


def test_parallel_embedding_callers_share_one_inference_thread(tmp_path, monkeypatch):
    embedding = LocalEmbeddings(tmp_path)
    threads = set()

    def infer(texts):
        threads.add(threading.get_ident())
        return texts

    monkeypatch.setattr(embedding, '_embed', infer)
    try:
        with ThreadPoolExecutor(max_workers=20) as pool:
            answers = list(pool.map(lambda i: embedding([str(i)]), range(100)))
        assert answers == [[str(i)] for i in range(100)]
        assert len(threads) == 1
    finally:
        embedding.close()
    with pytest.raises(RuntimeError):
        embedding(['after close'])


@pytest.mark.parametrize('batch_size', [0, 33])
def test_embedding_batch_limit_is_validated(batch_size):
    with pytest.raises(ValueError):
        Settings(embedding_batch_size=batch_size)
