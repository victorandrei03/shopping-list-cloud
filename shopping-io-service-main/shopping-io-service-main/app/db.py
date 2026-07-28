from collections.abc import Iterator
from contextlib import contextmanager

from psycopg import Connection, connect
from psycopg.rows import dict_row

from app.config import settings


@contextmanager
def get_connection() -> Iterator[Connection]:
    with connect(settings.database_url, row_factory=dict_row) as connection:
        yield connection


def ensure_annotations_schema() -> None:
    with connect(settings.database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS list_annotations (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    content TEXT NOT NULL CHECK (length(trim(content)) > 0),
                    x_percent NUMERIC(6, 4) NOT NULL CHECK (x_percent >= 0 AND x_percent <= 1),
                    y_percent NUMERIC(6, 4) NOT NULL CHECK (y_percent >= 0 AND y_percent <= 1),
                    width_percent NUMERIC(6, 4) NOT NULL CHECK (width_percent > 0 AND width_percent <= 1),
                    height_percent NUMERIC(6, 4) NOT NULL CHECK (height_percent > 0 AND height_percent <= 1),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CHECK (x_percent + width_percent <= 1),
                    CHECK (y_percent + height_percent <= 1)
                )
                """
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_list_annotations_list_id ON list_annotations(list_id)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_list_annotations_user_id ON list_annotations(user_id)"
            )
        connection.commit()
