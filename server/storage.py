import boto3
from botocore.config import Config

from config import settings

_client = None


def client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=settings.vultr_s3_endpoint,
            aws_access_key_id=settings.vultr_s3_access_key,
            aws_secret_access_key=settings.vultr_s3_secret_key,
            region_name="us-east-1",
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
    return _client


def enabled() -> bool:
    return bool(settings.vultr_s3_access_key and settings.vultr_s3_secret_key)


def bucket_for(kind: str) -> str:
    return settings.bucket_voice if kind == "voice" else settings.bucket_photos


def split_key(stored: str) -> tuple[str, str]:
    """'rezolv-voice/reports/<id>.webm' -> ('rezolv-voice', 'reports/<id>.webm')"""
    bucket, _, key = stored.partition("/")
    return bucket, key


def presign_put(bucket: str, key: str, content_type: str, expires: int = 900) -> str:
    return client().generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=expires,
    )


def presign_get(stored: str, expires: int = 900) -> str:
    bucket, key = split_key(stored)
    return client().generate_presigned_url(
        "get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=expires
    )


def download(stored: str) -> bytes:
    bucket, key = split_key(stored)
    return client().get_object(Bucket=bucket, Key=key)["Body"].read()
