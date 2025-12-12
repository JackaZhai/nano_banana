"""
配置管理类
"""
import os
from typing import Optional


class Config:
    """配置管理类"""

    def __init__(self):
        # 尝试导入本地配置
        try:
            import config as local_config  # type: ignore
            self.local_config = local_config
        except ImportError:
            self.local_config = None

        # 从环境变量或本地配置获取值
        self.app_secret_key = os.getenv("APP_SECRET_KEY", "change-me")

        # API配置
        self.api_host = self._get_config_value(
            "API_HOST", "NANO_BANANA_HOST", "https://api.grsai.com"
        )
        self.api_key = self._get_config_value("API_KEY", "NANO_BANANA_API_KEY", "")

        # 认证配置
        self.seed_username = self._get_config_value(
            "AUTH_USERNAME", "APP_USERNAME", "admin"
        )
        self.seed_password = self._get_config_value(
            "AUTH_PASSWORD", "APP_PASSWORD", "banana123"
        )

        # 服务器配置
        self.port = int(os.getenv("PORT", "5000"))

        # 数据库配置
        self.data_dir = os.getenv("DATA_DIR", "data")
        self.db_path = os.getenv("DB_PATH", os.path.join(self.data_dir, "app.db"))

        # 安全配置
        self.max_login_attempts = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
        self.lock_minutes = int(os.getenv("LOCK_MINUTES", "10"))
        self.max_reference_images = int(os.getenv("MAX_REFERENCE_IMAGES", "3"))
        self.max_reference_image_bytes = int(os.getenv(
            "MAX_REFERENCE_IMAGE_BYTES", str(5 * 1024 * 1024)
        ))

    def _get_config_value(self, config_attr: str, env_var: str, default: str) -> str:
        """获取配置值，优先级：环境变量 > 本地配置 > 默认值"""
        # 首先检查环境变量
        env_value = os.getenv(env_var)
        if env_value is not None:
            return env_value

        # 然后检查本地配置
        if self.local_config:
            config_value = getattr(self.local_config, config_attr, None)
            if config_value is not None:
                return config_value

        # 最后返回默认值
        return default

    @property
    def draw_endpoint(self) -> str:
        """图像生成端点"""
        return f"{self.api_host.rstrip('/')}/v1/draw/nano-banana"

    @property
    def result_endpoint(self) -> str:
        """结果查询端点"""
        return f"{self.api_host.rstrip('/')}/v1/draw/result"

    @property
    def chat_endpoint(self) -> str:
        """聊天完成端点"""
        return f"{self.api_host.rstrip('/')}/v1/chat/completions"

    def to_dict(self) -> dict:
        """转换为字典（用于调试）"""
        return {
            "api_host": self.api_host,
            "draw_endpoint": self.draw_endpoint,
            "result_endpoint": self.result_endpoint,
            "chat_endpoint": self.chat_endpoint,
            "seed_username": self.seed_username,
            "port": self.port,
            "db_path": self.db_path,
            "max_login_attempts": self.max_login_attempts,
            "lock_minutes": self.lock_minutes,
            "max_reference_images": self.max_reference_images,
            "max_reference_image_bytes": self.max_reference_image_bytes
        }


# 全局配置实例
_config_instance: Optional[Config] = None


def get_config() -> Config:
    """获取配置实例（单例模式）"""
    global _config_instance
    if _config_instance is None:
        _config_instance = Config()
    return _config_instance