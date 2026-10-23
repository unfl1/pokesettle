import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class Settings:
    data_dir: Path = ROOT / "data"
    runtime_dir: Path = ROOT / "runtime"
    database_url: str = field(default="postgresql://localhost:5432/poketact", repr=False)
    database_schema: str = "poketact"
    api_key: str = field(default="", repr=False)
    chat_model: str = ""
    base_url: str | None = None
    embedding_model: str = "all-MiniLM-L6-v2"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k: int = 6
    search_mode: str = "similarity"
    mmr_fetch_k: int = 30
    mmr_lambda_mult: float = 0.5
    http_timeout: float = 15
    llm_timeout: float = 60
    max_retries: int = 2
    request_interval: float = 1
    allowed_origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")
    source_contact: str = ""
    wikipedia_enabled: bool = False
    damage_node_binary: str = "node"

    def __post_init__(self):
        if not 0 <= self.chunk_overlap < self.chunk_size:
            raise ValueError("0 <= CHUNK_OVERLAP < CHUNK_SIZE 이어야 합니다.")
        if not 2 <= self.top_k <= 20:
            raise ValueError("TOP_K는 2~20이어야 합니다.")
        if self.search_mode not in {"similarity", "mmr"}:
            raise ValueError("SEARCH_MODE는 similarity 또는 mmr이어야 합니다.")
        if not self.top_k - 1 <= self.mmr_fetch_k <= 200:
            raise ValueError("MMR_FETCH_K는 TOP_K - 1 이상, 200 이하여야 합니다.")
        if not 0 <= self.mmr_lambda_mult <= 1:
            raise ValueError("MMR_LAMBDA_MULT는 0~1이어야 합니다.")
        if min(self.http_timeout, self.llm_timeout) <= 0 or self.request_interval < 0:
            raise ValueError("시간 설정이 잘못되었습니다.")
        if not 0 <= self.max_retries <= 5:
            raise ValueError("MAX_RETRIES는 0~5이어야 합니다.")

    @property
    def model_configured(self):
        return bool(self.api_key and self.chat_model)

    @classmethod
    def from_env(cls):
        load_dotenv(ROOT / ".env", override=False)
        return cls(
            data_dir=Path(os.getenv("DATA_DIR", str(ROOT / "data"))),
            runtime_dir=Path(os.getenv("RUNTIME_DIR", str(ROOT / "runtime"))),
            database_url=os.getenv("DATABASE_URL", "postgresql://localhost:5432/poketact"),
            database_schema=os.getenv("DATABASE_SCHEMA", "poketact"),
            api_key=os.getenv("OPENAI_API_KEY", ""),
            chat_model=os.getenv("CHAT_MODEL", ""),
            # Pass an explicit default: the SDK otherwise rereads an empty env value.
            base_url=os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1",
            embedding_model=os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"),
            chunk_size=int(os.getenv("CHUNK_SIZE", "1000")),
            chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "200")),
            top_k=int(os.getenv("TOP_K", "6")),
            search_mode=os.getenv("SEARCH_MODE", "similarity"),
            mmr_fetch_k=int(os.getenv("MMR_FETCH_K", "30")),
            mmr_lambda_mult=float(os.getenv("MMR_LAMBDA_MULT", "0.5")),
            http_timeout=float(os.getenv("HTTP_TIMEOUT_SECONDS", "15")),
            llm_timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "60")),
            max_retries=int(os.getenv("MAX_RETRIES", "2")),
            request_interval=float(os.getenv("SOURCE_REQUEST_INTERVAL_SECONDS", "1")),
            allowed_origins=tuple(
                x.strip()
                for x in os.getenv(
                    "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
                ).split(",")
                if x.strip()
            ),
            source_contact=os.getenv("SOURCE_CONTACT", ""),
            wikipedia_enabled=os.getenv("WIKIPEDIA_ENABLED", "false").lower() == "true",
            damage_node_binary=os.getenv("DAMAGE_NODE_BINARY", "node"),
        )
