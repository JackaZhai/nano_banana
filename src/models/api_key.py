"""
API密钥模型
"""
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .base import BaseModel


class ApiKey(BaseModel):
    """API密钥模型类"""

    def __init__(self,
                 id: Optional[str] = None,
                 user_id: Optional[int] = None,
                 value: str = "",
                 source: str = "custom",
                 is_active: bool = False,
                 created_at: Optional[str] = None):
        self.id = id or uuid.uuid4().hex
        self.user_id = user_id
        self.value = value
        self.source = source
        self.is_active = is_active
        self.created_at = created_at or datetime.utcnow().isoformat()

    @classmethod
    def get_table_name(cls) -> str:
        return "api_keys"

    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            value TEXT NOT NULL,
            source TEXT DEFAULT 'custom',
            is_active INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """

    @classmethod
    def from_row(cls, row) -> 'ApiKey':
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            value=row["value"],
            source=row["source"],
            is_active=bool(row["is_active"]),
            created_at=row["created_at"]
        )

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "source": self.source,
            "is_active": self.is_active,
            "created_at": self.created_at
        }

    @classmethod
    def get_by_user_id(cls, user_id: int) -> List['ApiKey']:
        """根据用户ID获取所有API密钥"""
        from ..services.database import get_db_manager
        db = get_db_manager()
        rows = db.fetch_all(
            "SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at ASC",
            (user_id,)
        )
        return [cls.from_row(row) for row in rows]

    @classmethod
    def get_active_key(cls, user_id: int) -> Optional['ApiKey']:
        """获取用户的活动API密钥"""
        from ..services.database import get_db_manager
        db = get_db_manager()
        row = db.fetch_one(
            "SELECT * FROM api_keys WHERE user_id = ? AND is_active = 1",
            (user_id,)
        )
        return cls.from_row(row) if row else None

    def save(self) -> None:
        """保存API密钥到数据库"""
        from ..services.database import get_db_manager
        db = get_db_manager()

        # 如果设置为活动密钥，先取消其他密钥的活动状态
        if self.is_active and self.user_id:
            db.execute_query(
                "UPDATE api_keys SET is_active = 0 WHERE user_id = ?",
                (self.user_id,)
            )

        # 插入或更新密钥
        db.execute_query(
            """
            INSERT INTO api_keys (id, user_id, value, source, is_active)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                value = excluded.value,
                source = excluded.source,
                is_active = excluded.is_active
            """,
            (self.id, self.user_id, self.value, self.source, 1 if self.is_active else 0)
        )

    def delete(self) -> None:
        """从数据库删除API密钥"""
        from ..services.database import get_db_manager
        db = get_db_manager()
        db.execute_query(
            "DELETE FROM api_keys WHERE id = ?",
            (self.id,)
        )

    @classmethod
    def delete_by_id(cls, key_id: str, user_id: int) -> bool:
        """根据ID删除API密钥"""
        from ..services.database import get_db_manager
        db = get_db_manager()

        # 检查密钥是否存在且属于该用户
        row = db.fetch_one(
            "SELECT * FROM api_keys WHERE id = ? AND user_id = ?",
            (key_id, user_id)
        )

        if not row:
            return False

        db.execute_query(
            "DELETE FROM api_keys WHERE id = ?",
            (key_id,)
        )
        return True

    @classmethod
    def set_active_key(cls, key_id: str, user_id: int) -> bool:
        """设置活动API密钥"""
        from ..services.database import get_db_manager
        db = get_db_manager()

        # 检查密钥是否存在且属于该用户
        row = db.fetch_one(
            "SELECT * FROM api_keys WHERE id = ? AND user_id = ?",
            (key_id, user_id)
        )

        if not row:
            return False

        # 先取消所有密钥的活动状态
        db.execute_query(
            "UPDATE api_keys SET is_active = 0 WHERE user_id = ?",
            (user_id,)
        )

        # 设置指定密钥为活动状态
        db.execute_query(
            "UPDATE api_keys SET is_active = 1 WHERE id = ?",
            (key_id,)
        )

        return True

    @classmethod
    def get_decrypted_keys(cls, user_id: int, decrypt_func) -> Tuple[List[Dict], str]:
        """获取解密后的密钥列表和活动密钥ID"""
        keys = cls.get_by_user_id(user_id)
        decrypted = []
        active_id = ""

        for key in keys:
            decrypted_value = decrypt_func(key.value)
            if not decrypted_value:
                continue

            decrypted.append({
                "id": key.id,
                "value": decrypted_value,
                "source": key.source
            })

            if key.is_active:
                active_id = key.id

        return decrypted, active_id