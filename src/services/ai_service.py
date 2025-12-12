"""
AI服务
"""
import requests
from typing import Dict, Any, Optional

from ..utils.errors import ApiError
from ..models.usage_stats import UsageStats
from ..config import get_config
from .api_key_service import get_api_key_service


class AIService:
    """AI服务"""

    def __init__(self):
        self.config = get_config()
        self.api_key_service = get_api_key_service()

    def call_api(self, endpoint: str, payload: Dict[str, Any], user_id: Optional[int]) -> Dict[str, Any]:
        """调用API"""
        try:
            response = requests.post(
                endpoint,
                headers=self.api_key_service.build_headers(user_id),
                json=payload,
                timeout=120
            )
            response.raise_for_status()
        except requests.HTTPError as exc:
            text = exc.response.text if exc.response is not None else ""
            raise ApiError(
                "API request failed",
                status_code=exc.response.status_code if exc.response else 502,
                details=text
            )
        except requests.RequestException as exc:
            raise ApiError(f"Network error: {exc}", status_code=502)

        try:
            return response.json()
        except ValueError as exc:
            raise ApiError(
                f"Invalid JSON from upstream: {exc}",
                status_code=502,
                details=response.text
            )

    def call_streaming_api(self, endpoint: str, payload: Dict[str, Any], user_id: Optional[int]):
        """调用流式API"""
        try:
            response = requests.post(
                endpoint,
                headers=self.api_key_service.build_headers(user_id),
                json=payload,
                timeout=120,
                stream=True
            )
            response.raise_for_status()
            return response
        except requests.HTTPError as exc:
            text = exc.response.text if exc.response is not None else ""
            raise ApiError(
                "API request failed",
                status_code=exc.response.status_code if exc.response else 502,
                details=text
            )
        except requests.RequestException as exc:
            raise ApiError(f"Network error: {exc}", status_code=502)

    def generate_image(self, user_id: Optional[int], data: Dict[str, Any]) -> Dict[str, Any]:
        """生成图像"""
        from ..utils.validation import get_validation_service
        validation = get_validation_service()

        prompt = (data.get("prompt") or "").strip()
        model = (data.get("model") or "nano-banana-fast").strip()
        aspect_ratio = (data.get("aspectRatio") or "auto").strip()
        image_size = (data.get("imageSize") or "").strip()
        urls = validation.sanitize_urls(data.get("urls"))
        web_hook = (data.get("webHook") or "-1").strip() or "-1"
        shut_progress = bool(data.get("shutProgress"))

        validation.validate_prompt(prompt)
        validation.validate_reference_images(urls)

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

        result = self.call_api(self.config.draw_endpoint, payload, user_id)

        # 记录使用
        if user_id:
            UsageStats.record_usage_for_user(user_id)

        return result

    def get_image_result(self, user_id: Optional[int], draw_id: str) -> Dict[str, Any]:
        """获取图像生成结果"""
        from ..utils.validation import get_validation_service
        validation = get_validation_service()
        validation.validate_draw_id(draw_id)

        result = self.call_api(
            self.config.result_endpoint,
            {"id": draw_id},
            user_id
        )

        # 记录使用
        if user_id:
            UsageStats.record_usage_for_user(user_id)

        return result

    def chat_completion(self, user_id: Optional[int], data: Dict[str, Any]) -> Any:
        """聊天完成"""
        from ..utils.validation import get_validation_service
        validation = get_validation_service()

        model = (data.get("model") or "gpt-4o-mini").strip()
        messages = data.get("messages") or []
        stream = bool(data.get("stream", False))

        validation.validate_messages(messages)

        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": stream,
        }

        if stream:
            response = self.call_streaming_api(self.config.chat_endpoint, payload, user_id)

            # 记录使用
            if user_id:
                UsageStats.record_usage_for_user(user_id)

            return response
        else:
            result = self.call_api(self.config.chat_endpoint, payload, user_id)

            # 记录使用
            if user_id:
                UsageStats.record_usage_for_user(user_id)

            return result

    def generate_stream_response(self, response):
        """生成流式响应"""
        def generate():
            for chunk in response.iter_lines():
                if chunk:
                    text = chunk.decode("utf-8", errors="ignore")
                    payload = text if text.startswith("data:") else f"data: {text}"
                    yield (payload + "\n\n").encode("utf-8")

        return generate()


# 全局AI服务实例
_ai_service: Optional[AIService] = None


def get_ai_service() -> AIService:
    """获取AI服务实例（单例模式）"""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service