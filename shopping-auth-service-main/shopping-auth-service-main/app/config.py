import os


class Settings:
    def __init__(self) -> None:
        self.io_service_url = os.getenv("IO_SERVICE_URL", "http://io-service:8000")
        self.jwt_secret = os.getenv("JWT_SECRET", "trelow23214343982jtunfusn8d3onrfourd8o4832r3rofn8so8f3")
        self.jwt_algorithm = "HS256"
        self.jwt_expire_minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))


settings = Settings()
