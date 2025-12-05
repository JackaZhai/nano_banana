import base64
import os
import sqlite3
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
DB_PATH = os.getenv("DB_PATH", os.path.join(DATA_DIR, "app.db"))
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


def get_db() -> sqlite3.Connection:
    ensure_data_dir(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            salt BLOB NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            value TEXT NOT NULL,
            source TEXT DEFAULT 'custom',
            is_active INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS usage_stats (
            user_id INTEGER PRIMARY KEY,
            total_calls INTEGER DEFAULT 0,
            last_used_at TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """
    )
    conn.commit()
    conn.close()


init_db()


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


def ensure_default_user() -> sqlite3.Row:
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (SEED_USERNAME,)).fetchone()
    if user:
        conn.close()
        return user

    salt = generate_salt()
    password_hash = hash_password(SEED_PASSWORD, salt)
    conn.execute(
        "INSERT INTO users (username, salt, password_hash) VALUES (?, ?, ?)",
        (SEED_USERNAME, salt, password_hash),
    )
    conn.commit()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (SEED_USERNAME,)).fetchone()
    conn.close()
    if not user:
        raise RuntimeError("Failed to seed default user")
    return user


def get_user_by_username(username: str) -> Optional[sqlite3.Row]:
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return user


def verify_credentials(username: str, password: str) -> Optional[int]:
    ensure_default_user()
    user = get_user_by_username(username)
    if not user:
        return None

    salt = user["salt"] or b""
    password_hash = user["password_hash"]
    if not (salt and password_hash):
        return None

    if hash_password(password, salt) == password_hash:
        return int(user["id"])
    return None


def load_keys_decrypted(user_id: int) -> Tuple[List[Dict[str, str]], str]:
    conn = get_db()
    rows = conn.execute(
        "SELECT id, value, source, is_active FROM api_keys WHERE user_id = ? ORDER BY created_at ASC",
        (user_id,),
    ).fetchall()
    conn.close()

    decrypted: List[Dict[str, str]] = []
    active_id = ""
    for row in rows:
        decrypted_value = decrypt_value(row["value"] or "")
        if not decrypted_value:
            continue
        decrypted.append({"id": row["id"], "value": decrypted_value, "source": row["source"]})
        if row["is_active"]:
            active_id = row["id"]
    return decrypted, active_id


def save_key_store(keys: List[Dict[str, str]], active_id: str, user_id: int) -> None:
    conn = get_db()
    with conn:
        conn.execute("DELETE FROM api_keys WHERE user_id = ?", (user_id,))
        for item in keys:
            conn.execute(
                "INSERT INTO api_keys (id, user_id, value, source, is_active) VALUES (?, ?, ?, ?, ?)",
                (
                    item.get("id"),
                    user_id,
                    encrypt_value(item.get("value", "")),
                    item.get("source", "custom"),
                    1 if item.get("id") == active_id else 0,
                ),
            )


def mask_key(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return f"***{value[-2:]}"
    return f"{value[:4]}...{value[-4:]}"


def bootstrap_api_keys(user_id: Optional[int]) -> None:
    if not user_id:
        return

    keys, active_id = load_keys_decrypted(user_id)
    changed = False

    if API_KEY and not any(item.get("value") == API_KEY for item in keys):
        keys.append({"id": uuid4().hex, "value": API_KEY, "source": "env"})
        changed = True

    if keys and not active_id:
        active_id = keys[0]["id"]
        changed = True

    if changed:
        save_key_store(keys, active_id, user_id)


def get_active_api_key_value(user_id: Optional[int]) -> str:
    if not user_id:
        return API_KEY

    keys, active_id = load_keys_decrypted(user_id)
    if active_id:
        for item in keys:
            if item.get("id") == active_id:
                return item.get("value", "")
    return API_KEY


def build_headers(user_id: Optional[int]) -> Dict[str, str]:
    api_key = get_active_api_key_value(user_id)
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


def serialize_keys(user_id: int) -> Dict[str, Any]:
    keys, active_id = load_keys_decrypted(user_id)
    return {
        "activeId": active_id,
        "hasKey": bool(get_active_api_key_value(user_id)),
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


def get_usage_stats(user_id: Optional[int]) -> Dict[str, Any]:
    if not user_id:
        return {"totalCalls": 0, "lastUsedAt": None}

    conn = get_db()
    row = conn.execute(
        "SELECT total_calls, last_used_at FROM usage_stats WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    conn.close()
    if not row:
        return {"totalCalls": 0, "lastUsedAt": None}
    return {"totalCalls": int(row["total_calls"] or 0), "lastUsedAt": row["last_used_at"]}


def call_api(endpoint: str, payload: Dict[str, Any], user_id: Optional[int]) -> Dict[str, Any]:
    try:
        response = requests.post(endpoint, headers=build_headers(user_id), json=payload, timeout=120)
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


def record_usage(user_id: Optional[int]) -> None:
    if not user_id:
        return
    conn = get_db()
    with conn:
        conn.execute(
            """
            INSERT INTO usage_stats (user_id, total_calls, last_used_at)
            VALUES (?, 1, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                total_calls = total_calls + 1,
                last_used_at = excluded.last_used_at
            """,
            (user_id, datetime.utcnow().isoformat()),
        )


def is_authenticated() -> bool:
    return bool(session.get("authenticated"))


def current_user_id() -> Optional[int]:
    user_id = session.get("user_id")
    return int(user_id) if user_id is not None else None


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
        else:
            user_id = verify_credentials(username, password)
            if user_id:
                session["authenticated"] = True
                session["user_id"] = user_id
                session["username"] = username
                LOGIN_ATTEMPTS.pop(username, None)
                bootstrap_api_keys(user_id)
                next_url = request.args.get("next") or url_for("index")
                return redirect(next_url)
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
    user_id = current_user_id()
    bootstrap_api_keys(user_id)
    has_api_key = bool(get_active_api_key_value(user_id))
    return render_template("index.html", api_host=API_HOST, has_api_key=has_api_key)


@app.post("/api/draw")
@login_required
def draw() -> Any:
    data = request.get_json(force=True, silent=True) or {}
    user_id = current_user_id()

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
        api_response = call_api(DRAW_ENDPOINT, payload, user_id)
    except ApiError as exc:
        return jsonify({"error": str(exc), "details": exc.details}), exc.status_code

    record_usage(user_id)
    return jsonify(api_response)


@app.post("/api/result")
@login_required
def result() -> Any:
    data = request.get_json(force=True, silent=True) or {}
    draw_id = (data.get("id") or "").strip()
    if not draw_id:
        return jsonify({"error": "id is required"}), 400

    user_id = current_user_id()

    try:
        api_response = call_api(RESULT_ENDPOINT, {"id": draw_id}, user_id)
    except ApiError as exc:
        return jsonify({"error": str(exc), "details": exc.details}), exc.status_code

    record_usage(user_id)
    return jsonify(api_response)


@app.get("/api/keys")
@login_required
def list_keys() -> Any:
    user_id = current_user_id()
    bootstrap_api_keys(user_id)
    if not user_id:
        return jsonify({"error": "用户信息缺失"}), 400
    return jsonify(serialize_keys(user_id))


@app.get("/api/profile")
@login_required
def profile() -> Any:
    user_id = current_user_id()
    active_value = get_active_api_key_value(user_id)
    return jsonify(
        {
            "hasKey": bool(active_value),
            "activeKeyMask": mask_key(active_value),
            "usage": get_usage_stats(user_id),
        }
    )


@app.post("/api/keys")
@login_required
def add_key() -> Any:
    data = request.get_json(force=True, silent=True) or {}
    user_id = current_user_id()
    if not user_id:
        return jsonify({"error": "用户信息缺失"}), 400
    value = (data.get("value") or "").strip()
    if not value:
        return jsonify({"error": "Api key 不能为空"}), 400

    keys, active_id = load_keys_decrypted(user_id)
    if any(item.get("value") == value for item in keys):
        return jsonify({"error": "Api key 已存在"}), 400

    new_item = {"id": uuid4().hex, "value": value, "source": "custom"}
    keys.append(new_item)
    active_id = new_item["id"]
    save_key_store(keys, active_id, user_id)
    return jsonify(serialize_keys(user_id))


@app.delete("/api/keys/<key_id>")
@login_required
def delete_key(key_id: str) -> Any:
    user_id = current_user_id()
    if not user_id:
        return jsonify({"error": "用户信息缺失"}), 400

    keys, active_id = load_keys_decrypted(user_id)
    filtered = [item for item in keys if item.get("id") != key_id]

    if len(filtered) == len(keys):
        return jsonify({"error": "未找到对应的 Api key"}), 404

    if active_id == key_id:
        active_id = filtered[0]["id"] if filtered else ""
    save_key_store(filtered, active_id, user_id)
    return jsonify(serialize_keys(user_id))


@app.post("/api/keys/active")
@login_required
def set_active_key() -> Any:
    data = request.get_json(force=True, silent=True) or {}
    key_id = (data.get("id") or "").strip()
    if not key_id:
        return jsonify({"error": "缺少 id"}), 400

    user_id = current_user_id()
    if not user_id:
        return jsonify({"error": "用户信息缺失"}), 400

    keys, _ = load_keys_decrypted(user_id)
    if not any(item.get("id") == key_id for item in keys):
        return jsonify({"error": "无效的 Api key"}), 400

    save_key_store(keys, key_id, user_id)
    return jsonify(serialize_keys(user_id))


@app.post("/api/chat")
@login_required
def chat() -> Any:
    data = request.get_json(force=True, silent=True) or {}
    model = (data.get("model") or "gpt-4o-mini").strip()
    messages = data.get("messages") or []
    stream = bool(data.get("stream", False))
    user_id = current_user_id()

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
                headers=build_headers(user_id),
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

        record_usage(user_id)

        def generate():
            for chunk in response.iter_lines():
                if chunk:
                    text = chunk.decode("utf-8", errors="ignore")
                    payload = text if text.startswith("data:") else f"data: {text}"
                    yield (payload + "\n\n").encode("utf-8")

        return Response(generate(), content_type="text/event-stream")

    try:
        api_response = call_api(CHAT_ENDPOINT, payload, user_id)
    except ApiError as exc:
        return jsonify({"error": str(exc), "details": exc.details}), exc.status_code

    record_usage(user_id)
    return jsonify(api_response)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
