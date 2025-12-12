"""
API密钥服务
"""
import uuid
from typing import Dict, List, Optional, Tuple

from ..models.api_key import ApiKey
from ..models.user import User
from ..utils.encryption import get_encryption_service
from ..utils.errors import ValidationError, NotFoundError
from ..config import get_config


class ApiKeyService:
    """API密钥服务"""

    def __init__(self):
        self.config = get_config()
        self.encryption = get_encryption_service()

    def bootstrap_api_keys(self, user_id: Optional[int]) -> None:
        """引导API密钥（确保环境变量中的密钥存在）"""
        if not user_id:
            return

        # 获取当前密钥
        decrypted_keys, active_id = self.get_decrypted_keys(user_id)
        changed = False

        # 如果环境变量中有密钥且不在列表中，则添加
        if self.config.api_key and not any(
            item.get("value") == self.config.api_key for item in decrypted_keys
        ):
            decrypted_keys.append({
                "id": uuid.uuid4().hex,
                "value": self.config.api_key,
                "source": "env"
            })
            changed = True

        # 如果没有活动密钥但有密钥，设置第一个为活动密钥
        if decrypted_keys and not active_id:
            active_id = decrypted_keys[0]["id"]
            changed = True

        if changed:
            self.save_key_store(decrypted_keys, active_id, user_id)

    def get_decrypted_keys(self, user_id: int) -> Tuple[List[Dict], str]:
        """获取解密后的密钥列表"""
        return ApiKey.get_decrypted_keys(user_id, self.encryption.decrypt)

    def save_key_store(self, keys: List[Dict], active_id: str, user_id: int) -> None:
        """保存密钥存储"""
        # 先删除用户的所有密钥
        from ..services.database import get_db_manager
        db = get_db_manager()
        db.execute_query(
            "DELETE FROM api_keys WHERE user_id = ?",
            (user_id,)
        )

        # 重新插入所有密钥
        for item in keys:
            key = ApiKey(
                id=item.get("id"),
                user_id=user_id,
                value=self.encryption.encrypt(item.get("value", "")),
                source=item.get("source", "custom"),
                is_active=(item.get("id") == active_id)
            )
            key.save()

    def get_active_api_key_value(self, user_id: Optional[int]) -> str:
        """获取活动API密钥的值"""
        if not user_id:
            return self.config.api_key

        decrypted_keys, active_id = self.get_decrypted_keys(user_id)
        if active_id:
            for item in decrypted_keys:
                if item.get("id") == active_id:
                    return item.get("value", "")

        return self.config.api_key

    def serialize_keys(self, user_id: int) -> Dict:
        """序列化密钥信息"""
        decrypted_keys, active_id = self.get_decrypted_keys(user_id)
        active_value = self.get_active_api_key_value(user_id)

        return {
            "activeId": active_id,
            "hasKey": bool(active_value),
            "keys": [
                {
                    "id": item.get("id"),
                    "mask": self.encryption.mask_key(item.get("value", "")),
                    "source": item.get("source", "custom"),
                    "isActive": item.get("id") == active_id,
                }
                for item in decrypted_keys
            ],
        }

    def add_api_key(self, user_id: int, value: str) -> Dict:
        """添加API密钥"""
        from ..utils.validation import get_validation_service
        validation = get_validation_service()
        validation.validate_api_key(value)

        # 检查密钥是否已存在
        decrypted_keys, active_id = self.get_decrypted_keys(user_id)
        if any(item.get("value") == value for item in decrypted_keys):
            raise ValidationError("Api key 已存在")

        # 添加新密钥
        new_item = {"id": uuid.uuid4().hex, "value": value, "source": "custom"}
        decrypted_keys.append(new_item)
        active_id = new_item["id"]

        self.save_key_store(decrypted_keys, active_id, user_id)
        return self.serialize_keys(user_id)

    def delete_api_key(self, user_id: int, key_id: str) -> Dict:
        """删除API密钥"""
        if not ApiKey.delete_by_id(key_id, user_id):
            raise NotFoundError("未找到对应的 Api key")

        # 重新序列化密钥
        return self.serialize_keys(user_id)

    def set_active_key(self, user_id: int, key_id: str) -> Dict:
        """设置活动API密钥"""
        if not ApiKey.set_active_key(key_id, user_id):
            raise ValidationError("无效的 Api key")

        return self.serialize_keys(user_id)

    def build_headers(self, user_id: Optional[int]) -> Dict[str, str]:
        """构建API请求头"""
        api_key = self.get_active_api_key_value(user_id)
        if not api_key:
            raise ValidationError("Missing API key. 请在页面 Api key 管理中添加。")

        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }


# 全局API密钥服务实例
_api_key_service: Optional[ApiKeyService] = None


def get_api_key_service() -> ApiKeyService:
    """获取API密钥服务实例（单例模式）"""
    global _api_key_service
    if _api_key_service is None:
        _api_key_service = ApiKeyService()
    return _api_key_service