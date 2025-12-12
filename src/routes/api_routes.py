"""
API路由
"""
from typing import Any

from flask import Blueprint, jsonify, request, Response, render_template

from .decorators import api_login_required, handle_api_errors
from ..services.auth import get_auth_service
from ..services.api_key_service import get_api_key_service
from ..services.ai_service import get_ai_service
from ..models.usage_stats import UsageStats

# 创建API蓝图
api_bp = Blueprint('api', __name__, url_prefix='/api')


@api_bp.get("/profile")
@api_login_required
@handle_api_errors
def profile() -> Any:
    """获取用户资料"""
    auth_service = get_auth_service()
    api_key_service = get_api_key_service()

    user_id = auth_service.require_auth()
    active_value = api_key_service.get_active_api_key_value(user_id)

    return jsonify({
        "hasKey": bool(active_value),
        "activeKeyMask": api_key_service.encryption.mask_key(active_value),
        "usage": UsageStats.get_by_user_id(user_id).to_dict() if user_id else {
            "totalCalls": 0,
            "lastUsedAt": None
        },
    })


@api_bp.get("/keys")
@api_login_required
@handle_api_errors
def list_keys() -> Any:
    """列出API密钥"""
    auth_service = get_auth_service()
    api_key_service = get_api_key_service()

    user_id = auth_service.require_auth()
    api_key_service.bootstrap_api_keys(user_id)

    return jsonify(api_key_service.serialize_keys(user_id))


@api_bp.post("/keys")
@api_login_required
@handle_api_errors
def add_key() -> Any:
    """添加API密钥"""
    auth_service = get_auth_service()
    api_key_service = get_api_key_service()

    user_id = auth_service.require_auth()
    data = request.get_json(force=True, silent=True) or {}
    value = (data.get("value") or "").strip()

    result = api_key_service.add_api_key(user_id, value)
    return jsonify(result)


@api_bp.delete("/keys/<key_id>")
@api_login_required
@handle_api_errors
def delete_key(key_id: str) -> Any:
    """删除API密钥"""
    auth_service = get_auth_service()
    api_key_service = get_api_key_service()

    user_id = auth_service.require_auth()
    result = api_key_service.delete_api_key(user_id, key_id)
    return jsonify(result)


@api_bp.post("/keys/active")
@api_login_required
@handle_api_errors
def set_active_key() -> Any:
    """设置活动API密钥"""
    auth_service = get_auth_service()
    api_key_service = get_api_key_service()

    user_id = auth_service.require_auth()
    data = request.get_json(force=True, silent=True) or {}
    key_id = (data.get("id") or "").strip()

    result = api_key_service.set_active_key(user_id, key_id)
    return jsonify(result)


@api_bp.post("/draw")
@api_login_required
@handle_api_errors
def draw() -> Any:
    """生成图像"""
    auth_service = get_auth_service()
    ai_service = get_ai_service()

    user_id = auth_service.get_current_user_id()
    data = request.get_json(force=True, silent=True) or {}

    result = ai_service.generate_image(user_id, data)
    return jsonify(result)


@api_bp.post("/result")
@api_login_required
@handle_api_errors
def result() -> Any:
    """获取图像生成结果"""
    auth_service = get_auth_service()
    ai_service = get_ai_service()

    user_id = auth_service.get_current_user_id()
    data = request.get_json(force=True, silent=True) or {}
    draw_id = (data.get("id") or "").strip()

    result = ai_service.get_image_result(user_id, draw_id)
    return jsonify(result)


@api_bp.post("/chat")
@api_login_required
@handle_api_errors
def chat() -> Any:
    """聊天完成"""
    auth_service = get_auth_service()
    ai_service = get_ai_service()

    user_id = auth_service.get_current_user_id()
    data = request.get_json(force=True, silent=True) or {}
    stream = bool(data.get("stream", False))

    if stream:
        response = ai_service.chat_completion(user_id, data)
        return Response(
            ai_service.generate_stream_response(response),
            content_type="text/event-stream"
        )
    else:
        result = ai_service.chat_completion(user_id, data)
        return jsonify(result)


# 创建主页面蓝图
main_bp = Blueprint('main', __name__)


@main_bp.get("/")
@api_login_required
def index() -> Any:
    """主页面"""
    from ..config import get_config
    config = get_config()
    auth_service = get_auth_service()
    api_key_service = get_api_key_service()

    user_id = auth_service.get_current_user_id()
    api_key_service.bootstrap_api_keys(user_id)
    has_api_key = bool(api_key_service.get_active_api_key_value(user_id))

    return render_template("index.html", api_host=config.api_host, has_api_key=has_api_key)