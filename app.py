"""
a.zhai's ToolBox - AI Service Middleware
面向对象重构版本
"""
import os

from flask import Flask

from src.config import get_config
from src.routes.api_routes import api_bp, main_bp


def create_app() -> Flask:
    """创建Flask应用"""
    config = get_config()

    # 创建Flask应用
    app = Flask(__name__)
    app.secret_key = config.app_secret_key

    # 注册蓝图
    app.register_blueprint(api_bp)
    app.register_blueprint(main_bp)

    # 确保默认用户存在
    from src.models.user import User
    User.ensure_default_user()

    return app


# 创建应用实例
app = create_app()


if __name__ == "__main__":
    config = get_config()
    port = int(os.getenv("PORT", str(config.port)))
    app.run(host="0.0.0.0", port=port, debug=True)
