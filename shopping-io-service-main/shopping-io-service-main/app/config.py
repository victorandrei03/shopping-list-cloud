import os


class Settings:
    def __init__(self) -> None:
        self.database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://shopping_user:shopping_password@postgres:5432/shopping_db",
        )


settings = Settings()
