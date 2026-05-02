"""Mock data used when LOCAL_TEST_MODE is active."""
from __future__ import annotations

MOCK_TABLES = [
    {"tableName": "demo_sales", "database": "default", "isTemporary": False},
    {"tableName": "demo_users", "database": "default", "isTemporary": False},
    {"tableName": "demo_products", "database": "default", "isTemporary": False},
]

MOCK_COLUMNS: dict[str, list[dict[str, str]]] = {
    "demo_sales": [
        {"col_name": "date", "data_type": "date"},
        {"col_name": "region", "data_type": "string"},
        {"col_name": "revenue", "data_type": "double"},
        {"col_name": "quantity", "data_type": "int"},
        {"col_name": "product_id", "data_type": "string"},
    ],
    "demo_users": [
        {"col_name": "user_id", "data_type": "string"},
        {"col_name": "name", "data_type": "string"},
        {"col_name": "signup_date", "data_type": "date"},
        {"col_name": "country", "data_type": "string"},
        {"col_name": "lifetime_value", "data_type": "double"},
    ],
    "demo_products": [
        {"col_name": "product_id", "data_type": "string"},
        {"col_name": "category", "data_type": "string"},
        {"col_name": "price", "data_type": "double"},
        {"col_name": "stock", "data_type": "int"},
    ],
}
