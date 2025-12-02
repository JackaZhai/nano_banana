import base64
import json
import os
from datetime import datetime, timedelta
from functools import wraps
from hashlib import pbkdf2_hmac, sha256
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import requests
from cryptography.fernet import Fernet, InvalidToken
from flask import Flask, Response, jsonify, redirect, render_template, request, session, url_for

try:
    import config  # type: ignore
except ImportError:
    config = None

app = Flask(__name__)
app.secret_key = os.getenv("APP_SECRET_KEY", "change-me")

DATA_DIR = os.getenv("DATA_DIR", "data")
KEY_STORE_PATH = os.getenv("KEY_STORE_PATH", os.path.join(DATA_DIR, "keys.json"))
CREDENTIALS_PATH = os.getenv("CREDENTIALS_PATH", os.path.join(DATA_DIR, "credentials.json"))
MAX_LOGIN_ATTEMPTS = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
LOCK_MINUTES = int(os.getenv("LOCK_MINUTES", "10"))
MAX_REFERENCE_IMAGES = int(os.getenv("MAX_REFERENCE_IMAGES", "3"))
MAX_REFERENCE_IMAGE_BYTES = int(os.getenv("MAX_REFERENCE_IMAGE_BYTES", str(5 * 1024 * 1024)))

CONFIG_HOST = getattr(config, "API_HOST", None) if config else None
CONFIG_KEY = getattr(config, "API_KEY", None) if config else None
CONFIG_USERNAME = getattr(config, "AUTH_USERNAME", None) if config else None
CONFIG_PASSWORD = getattr(config, "AUTH_PASSWORD", None) if config else None

API_HOST = CONFIG_HOST or os.getenv("NANO_BANANA_HOST", "https://api.grsai.com")
API_KEY = CONFIG_KEY or os.getenv("NANO_BANANA_API_KEY", "")
DRAW_ENDPOINT = f"{API_HOST.rstrip('/')}/v1/draw/nano-banana"
RESULT_ENDPOINT = f"{API_HOST.rstrip('/')}/v1/draw/result"
CHAT_ENDPOINT = f"{API_HOST.rstrip('/')}/v1/chat/completions"
SEED_USERNAME = CONFIG_USERNAME or os.getenv("APP_USERNAME", "admin")
SEED_PASSWORD = CONFIG_PASSWORD or os.getenv("APP_PASSWORD", "banana123")

LOGIN_ATTEMPTS: Dict[str, Dict[str, Any]] = {}


class ApiError(Exception):
    """Custom error for API failures."""

    def __init__(self, message: str, status_code: int = 500, details: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details


def ensure_data_dir(path: str) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)


def derive_cipher() -> Fernet:
    secret = str(app.secret_key or "change-me")
    digest = sha256(secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_value(value: str) -> str:
    if not value:
        return ""
    cipher = derive_cipher()
    return cipher.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(token: str) -> str:
    if not token:
        return ""
    cipher = derive_cipher()
    try:
        return cipher.decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return ""


def generate_salt() -> bytes:
    return os.urandom(16)


def hash_password(password: str, salt: bytes) -> str:
    digest = pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return base64.b64encode(digest).decode("utf-8")


def read_credentials() -> Dict[str, str]:
    if not os.path.exists(CREDENTIALS_PATH):
        return {}
    with open(CREDENTIALS_PATH, "r", encoding="utf-8") as fp:
        return json.load(fp)


def write_credentials(data: Dict[str, str]) -> None:
    ensure_data_dir(CREDENTIALS_PATH)
    with open(CREDENTIALS_PATH, "w", encoding="utf-8") as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)


def ensure_credentials_file() -> Dict[str, str]:
    data = read_credentials()
    if data:
        return data

    salt = generate_salt()
    payload = {
        "username": SEED_USERNAME,
        "salt": base64.b64encode(salt).decode("utf-8"),
        "password_hash": hash_password(SEED_PASSWORD, salt),
    }
    write_credentials(payload)
    return payload


def verify_credentials(username: str, password: str) -> bool:
    data = ensure_credentials_file()
    stored_username = data.get("username")
    salt = base64.b64decode(data.get("salt", "")) if data.get("salt") else b""
    password_hash = data.get("password_hash")

    if not (stored_username and salt and password_hash):
        return False
    if username != stored_username:
        return False
    return hash_password(password, salt) == password_hash


def load_key_store() -> Dict[str, Any]:
    if not os.path.exists(KEY_STORE_PATH):
        return {"keys": [], "active_id": ""}
    with open(KEY_STORE_PATH, "r", encoding="utf-8") as fp:
        return json.load(fp)


def save_key_store(keys: List[Dict[str, str]], active_id: str) -> None:
    ensure_data_dir(KEY_STORE_PATH)
    payload = {
        "keys": [
            {"id": item.get("id"), "value": encrypt_value(item.get("value", "")), "source": item.get("source", "custom")}
            for item in keys
        ],
        "active_id": active_id,
    }
    with open(KEY_STORE_PATH, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=2)


def load_keys_decrypted() -> Tuple[List[Dict[str, str]], str]:
    store = load_key_store()
    decrypted: List[Dict[str, str]] = []
    for item in store.get("keys", []):
        decrypted_value = decrypt_value(item.get("value", ""))
        if not decrypted_value:
            continue
        decrypted.append({"id": item.get("id"), "value": decrypted_value, "source": item.get("source", "custom")})
    return decrypted, store.get("active_id", "")


def mask_key(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return f"***{value[-2:]}"
    return f"{value[:4]}...{value[-4:]}"


def bootstrap_api_keys() -> None:
    keys, active_id = load_keys_decrypted()
    changed = False

    if API_KEY and not any(item.get("value") == API_KEY for item in keys):
        keys.append({"id": uuid4().hex, "value": API_KEY, "source": "env"})
        changed = True

    if keys and not active_id:
        active_id = keys[0]["id"]
        changed = True

    if changed:
        save_key_store(keys, active_id)


def get_active_api_key_value() -> str:
    keys, active_id = load_keys_decrypted()
    if active_id:
        for item in keys:
            if item.get("id") == active_id:
                return item.get("value", "")
    return API_KEY


def build_headers() -> Dict[str, str]:
    api_key = get_active_api_key_value()
    if not api_key:
        raise ApiError("Missing API key. 请在页面 Api key 管理中添加。", status_code=400)
    return {
        "Authorization": f"Bearer {api_key}",
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


def validate_reference_images(urls: List[str]) -> None:
    if len(urls) > MAX_REFERENCE_IMAGES:
        raise ApiError(f"参考图数量最多 {MAX_REFERENCE_IMAGES} 张", status_code=400)

    for url in urls:
        if url.startswith("data:"):
            try:
                header, encoded = url.split(",", 1)
            except ValueError:
                raise ApiError("参考图数据格式无效", status_code=400)

            approx_size = len(encoded) * 3 // 4
            if approx_size > MAX_REFERENCE_IMAGE_BYTES:
                raise ApiError(
                    f"单张参考图大小超出限制（最大 {MAX_REFERENCE_IMAGE_BYTES // (1024 * 1024)} MB）",
                    status_code=400,
                )


def serialize_keys() -> Dict[str, Any]:
    keys, active_id = load_keys_decrypted()
    return {
        "activeId": active_id,
        "hasKey": bool(get_active_api_key_value()),
        "keys": [
            {
                "id": item.get("id"),
                "mask": mask_key(item.get("value", "")),
                "source": item.get("source", "custom"),
                "isActive": item.get("id") == active_id,
            }
            for item in keys
        ],
    }


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


def is_authenticated() -> bool:
    return bool(session.get("authenticated"))


def login_required(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if not is_authenticated():
            return redirect(url_for("login", next=request.path))
        return view_func(*args, **kwargs)

    return wrapper


@app.route("/login", methods=["GET", "POST"])
def login() -> Any:
    error: Optional[str] = None
    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""

        attempt = LOGIN_ATTEMPTS.get(username, {"count": 0, "locked_until": None})
        locked_until = attempt.get("locked_until")
        now = datetime.utcnow()

        if locked_until and locked_until > now:
            remaining = int((locked_until - now).total_seconds() // 60) + 1
            error = f"账号已锁定，请 {remaining} 分钟后重试"
        elif verify_credentials(username, password):
            session["authenticated"] = True
            LOGIN_ATTEMPTS.pop(username, None)
            bootstrap_api_keys()
            next_url = request.args.get("next") or url_for("index")
            return redirect(next_url)
        else:
            attempt["count"] = attempt.get("count", 0) + 1
            if attempt["count"] >= MAX_LOGIN_ATTEMPTS:
                attempt["locked_until"] = now + timedelta(minutes=LOCK_MINUTES)
                error = f"错误次数过多，已锁定 {LOCK_MINUTES} 分钟"
            else:
                remaining = MAX_LOGIN_ATTEMPTS - attempt["count"]
                error = f"用户名或密码错误，剩余重试次数 {remaining} 次"
            LOGIN_ATTEMPTS[username] = attempt

    return render_template("login.html", error=error)


@app.get("/logout")
def logout() -> Any:
    session.clear()
    return redirect(url_for("login"))


@app.get("/")
@login_required
def index() -> Any:
    bootstrap_api_keys()
    has_api_key = bool(get_active_api_key_value())
    return render_template("index.html", api_host=API_HOST, has_api_key=has_api_key)


@app.post("/api/draw")
@login_required
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

    try:
        validate_reference_images(urls)
    except ApiError as exc:
        return jsonify({"error": str(exc)}), exc.status_code

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
@login_required
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


@app.get("/api/keys")
@login_required
def list_keys() -> Any:
    bootstrap_api_keys()
    return jsonify(serialize_keys())


@app.post("/api/keys")
@login_required
def add_key() -> Any:
    data = request.get_json(force=True, silent=True) or {}
    value = (data.get("value") or "").strip()
    if not value:
        return jsonify({"error": "Api key 不能为空"}), 400

    keys, active_id = load_keys_decrypted()
    if any(item.get("value") == value for item in keys):
        return jsonify({"error": "Api key 已存在"}), 400

    new_item = {"id": uuid4().hex, "value": value, "source": "custom"}
    keys.append(new_item)
    active_id = new_item["id"]
    save_key_store(keys, active_id)
    return jsonify(serialize_keys())


@app.delete("/api/keys/<key_id>")
@login_required
def delete_key(key_id: str) -> Any:
    keys, active_id = load_keys_decrypted()
    filtered = [item for item in keys if item.get("id") != key_id]

    if len(filtered) == len(keys):
        return jsonify({"error": "未找到对应的 Api key"}), 404

    if active_id == key_id:
        active_id = filtered[0]["id"] if filtered else ""
    save_key_store(filtered, active_id)
    return jsonify(serialize_keys())


@app.post("/api/keys/active")
@login_required
def set_active_key() -> Any:
    data = request.get_json(force=True, silent=True) or {}
    key_id = (data.get("id") or "").strip()
    if not key_id:
        return jsonify({"error": "缺少 id"}), 400

    keys, _ = load_keys_decrypted()
    if not any(item.get("id") == key_id for item in keys):
        return jsonify({"error": "无效的 Api key"}), 400

    save_key_store(keys, key_id)
    return jsonify(serialize_keys())


@app.post("/api/chat")
@login_required
def chat() -> Any:
    data = request.get_json(force=True, silent=True) or {}
    model = (data.get("model") or "gpt-4o-mini").strip()
    messages = data.get("messages") or []
    stream = bool(data.get("stream", False))

    if not messages:
        return jsonify({"error": "messages is required"}), 400

    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": stream,
    }

    if stream:
        try:
            response = requests.post(
                CHAT_ENDPOINT,
                headers=build_headers(),
                json=payload,
                timeout=120,
                stream=True,
            )
            response.raise_for_status()
        except requests.HTTPError as exc:
            text = exc.response.text if exc.response is not None else ""
            return jsonify({"error": "API request failed", "details": text}), exc.response.status_code if exc.response else 502
        except requests.RequestException as exc:
            return jsonify({"error": f"Network error: {exc}"}), 502

        def generate():
            for chunk in response.iter_lines():
                if chunk:
                    text = chunk.decode("utf-8", errors="ignore")
                    payload = text if text.startswith("data:") else f"data: {text}"
                    yield (payload + "\n\n").encode("utf-8")

        return Response(generate(), content_type="text/event-stream")

    try:
        api_response = call_api(CHAT_ENDPOINT, payload)
    except ApiError as exc:
        return jsonify({"error": str(exc), "details": exc.details}), exc.status_code

    return jsonify(api_response)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
