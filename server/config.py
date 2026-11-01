from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    database_url: str = "postgresql://yugabyte:yugabyte@localhost:5433/yugabyte"
    jwt_secret: str = "change-me"
    jwt_hours: int = 72

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_embed_model: str = "gemini-embedding-001"
    # Keep these low: the key is shared and a rate-limit stops the whole demo.
    gemini_rpm: int = 12            # text + audio calls per minute
    gemini_embed_rpm: int = 60
    gemini_daily_budget: int = 1000  # after this many calls today, use the offline fallbacks

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
    public_app_url: str = "http://localhost:3000"   # base of the links printed on QR stickers
    qr_link_prefix: str = "rezolv://a/"             # what an equipment QR sticker holds; the app opens it
    bucket_assets: str = "rezolv-assets"
    campus_security_phone: str = "112"              # shown on the "Call campus security" button
    safe_review_days: int = 7                       # a waiting Safe Voice report reaches the officer after this
    fraud_burst_min: int = 5                        # near-identical reports from new accounts that raise a flag
    verifier_use_llm: bool = False                  # also ask Gemini to judge free-text claims (costs calls)
    promise_loop_seconds: int = 300


settings = Settings()
