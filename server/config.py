from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    database_url: str = "postgresql://yugabyte:yugabyte@localhost:5433/yugabyte"
    jwt_secret: str = "change-me"
    jwt_hours: int = 72

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_embed_model: str = "gemini-embedding-001"

    vultr_s3_endpoint: str = "https://del1.vultrobjects.com"
    vultr_s3_access_key: str = ""
    vultr_s3_secret_key: str = ""
    bucket_voice: str = "rezolv-voice"
    bucket_photos: str = "rezolv-photos"
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    meko_mcp_url: str = "https://mcp.mekodata.ai/mcp"
    meko_api_key: str = ""
    meko_datapack_id: str = ""

    solana_rpc_url: str = "https://api.devnet.solana.com"
    solana_keypair_path: str = ""

    cluster_max_distance: float = 0.20
    promise_loop_seconds: int = 300


settings = Settings()
