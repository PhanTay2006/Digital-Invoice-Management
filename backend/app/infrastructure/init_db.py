"""Khởi tạo schema CSDL từ file backend/schema.sql và nạp dữ liệu mẫu (nếu trống).
Chạy: python -m app.infrastructure.init_db
"""
from pathlib import Path
from sqlalchemy import text
from ..core.common import engine


def init_schema():
    schema_path = Path(__file__).resolve().parents[2] / "schema.sql"
    sql = schema_path.read_text(encoding="utf-8")
    with engine.begin() as conn:
        conn.connection.driver_connection.execute(sql)
    print(f"Đã khởi tạo schema từ: {schema_path}")


if __name__ == "__main__":
    init_schema()
