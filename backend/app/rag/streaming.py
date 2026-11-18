"""Transient answer previews; only validated final answers enter conversation history."""
import time
from contextvars import ContextVar

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.utils.json import parse_partial_json

active_answer_preview = ContextVar("active_answer_preview", default=None)


class AnswerPreviewHandler(BaseCallbackHandler):
    raise_error = True

    def __init__(self, publish):
        self.publish = publish
        self.buffer = ""
        self.last_update = 0.0
        self.previous = ""

    def on_llm_new_token(self, token, **kwargs):
        self.buffer += token
        now = time.monotonic()
        if now - self.last_update < 0.1:
            return
        self.last_update = now
        try:
            partial = parse_partial_json(self.buffer)
        except (ValueError, TypeError):
            return
        if not isinstance(partial, dict) or not isinstance(partial.get("claims"), list):
            return
        text = "\n\n".join(
            claim["text"] for claim in partial["claims"]
            if isinstance(claim, dict) and isinstance(claim.get("text"), str)
        )
        if text != self.previous:
            self.previous = text
            self.publish(text)
