"""
FastAPI sidecar for OffLoad Matching Engine.
Exposes MultiStageEntityMatcher over HTTP without modifying entity_matcher_v4.py.
"""

import io
import json
import math
import sys
from unittest.mock import MagicMock

# Patch streamlit before importing entity_matcher_v4 so module-level
# st.set_page_config / st.markdown / st.session_state calls become no-ops.
st_mock = MagicMock()
sys.modules["streamlit"] = st_mock

import pandas as pd
import uvicorn
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from entity_matcher_v4 import MultiStageEntityMatcher

app = FastAPI(title="OffLoad Matcher API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/match")
async def match(
    internal_file: UploadFile = File(...),
    external_file: UploadFile = File(...),
    config: str = Form(...),
):
    cfg = json.loads(config)

    internal_df = pd.read_csv(io.BytesIO(await internal_file.read()))
    external_df = pd.read_csv(io.BytesIO(await external_file.read()))

    matcher = MultiStageEntityMatcher(
        abbreviations=cfg.get("abbreviations"),
        use_state_blocking=cfg.get("use_state_blocking", True),
        use_context_validation=cfg.get("use_context_validation", True),
        context_config=cfg.get("context_config"),
    )

    results_df, stats = matcher.match_entities(
        internal_df,
        external_df,
        cfg["internal_col"],
        cfg["external_col"],
    )

    records = results_df.fillna("").to_dict(orient="records")
    for r in records:
        for k, v in r.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                r[k] = None

    return JSONResponse({"results": records, "stats": stats})


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
