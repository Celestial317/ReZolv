"""Create the two Vultr Object Storage buckets (if missing) and allow browser uploads (CORS).

    python -m scripts.setup_storage
"""
from botocore.exceptions import ClientError

import storage
from config import settings


def main() -> None:
    if not storage.enabled():
        raise SystemExit("VULTR_S3_ACCESS_KEY / VULTR_S3_SECRET_KEY are not set")
    s3 = storage.client()
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    for bucket in (settings.bucket_voice, settings.bucket_photos, settings.bucket_assets):
        try:
            s3.create_bucket(Bucket=bucket)
            print("created", bucket)
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code not in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
                raise
            print("exists ", bucket)
        s3.put_bucket_cors(
            Bucket=bucket,
            CORSConfiguration={"CORSRules": [{
                "AllowedOrigins": origins or ["*"],
                "AllowedMethods": ["PUT", "GET"],
                "AllowedHeaders": ["*"],
                "MaxAgeSeconds": 3000,
            }]},
        )
        print("cors set", bucket, origins)


if __name__ == "__main__":
    main()
