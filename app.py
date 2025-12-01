import json
import os
from typing import Any, Dict, List, Optional

import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

API_HOST = os.getenv("NANO_BANANA_HOST", "https://grsai.dakka.com.cn")
API_KEY = os.getenv("NANO_BANANA_API_KEY", "")
HAS_API_KEY = bool(API_KEY)
DRAW_ENDPOINT = f"{API_HOST.rstrip('/')}/v1/draw/nano-banana"
RESULT_ENDPOINT = f"{API_HOST.rstrip('/')}/v1/draw/result"


class ApiError(Exception):
    """Custom error for API failures."""

    def __init__(self, message: str, status_code: int = 500, details: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details


def build_headers() -> Dict[str, str]:
    if not API_KEY:
        raise ApiError("Missing API key. Set NANO_BANANA_API_KEY.", status_code=400)
    return {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }


def sanitize_urls(urls: Optional[List[str]]) -> List[str]:
    if not urls:
        return []
    cleaned = []
    for raw in urls:
        if not raw:
            continue
        value = raw.strip()
        if value:
            cleaned.append(value)
    return cleaned


def call_api(endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        response = requests.post(endpoint, headers=build_headers(), json=payload, timeout=120)
        response.raise_for_status()
    except requests.HTTPError as exc:
        text = exc.response.text if exc.response is not None else ""
        raise ApiError("API request failed", status_code=exc.response.status_code if exc.response else 502, details=text)
    except requests.RequestException as exc:
        raise ApiError(f"Network error: {exc}", status_code=502)

    try:
        return response.json()
    except ValueError as exc:
        raise ApiError(f"Invalid JSON from upstream: {exc}", status_code=502, details=response.text)


@app.get("/")
def index() -> Any:
    return render_template("index.html", api_host=API_HOST, has_api_key=HAS_API_KEY)


@app.post("/api/draw")
def draw() -> Any:
    data = request.get_json(force=True, silent=True) or {}

    prompt = (data.get("prompt") or "").strip()
    model = (data.get("model") or "nano-banana-fast").strip()
    aspect_ratio = (data.get("aspectRatio") or "auto").strip()
    image_size = (data.get("imageSize") or "").strip()
    urls = sanitize_urls(data.get("urls"))
    web_hook = (data.get("webHook") or "-1").strip() or "-1"
    shut_progress = bool(data.get("shutProgress"))

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    payload: Dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "aspectRatio": aspect_ratio,
        "shutProgress": shut_progress,
        "webHook": web_hook,
    }

    if image_size:
        payload["imageSize"] = image_size
    if urls:
        payload["urls"] = urls

    try:
        api_response = call_api(DRAW_ENDPOINT, payload)
    except ApiError as exc:
        return jsonify({"error": str(exc), "details": exc.details}), exc.status_code

    return jsonify(api_response)


@app.post("/api/result")
def result() -> Any:
    data = request.get_json(force=True, silent=True) or {}
    draw_id = (data.get("id") or "").strip()
    if not draw_id:
        return jsonify({"error": "id is required"}), 400

    try:
        api_response = call_api(RESULT_ENDPOINT, {"id": draw_id})
    except ApiError as exc:
        return jsonify({"error": str(exc), "details": exc.details}), exc.status_code

    return jsonify(api_response)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
