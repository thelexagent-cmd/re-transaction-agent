"""Document storage service — S3/R2 interface with local fallback.

For production: set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_BUCKET_NAME.
For Cloudflare R2: also set AWS_ENDPOINT_URL to your R2 endpoint.
During development: files are stored in LOCAL_STORAGE_PATH when S3 is not configured.
"""

import os
import uuid
from pathlib import Path

from app.config import settings


def _generate_storage_key(transaction_id: int, filename: str) -> str:
    """Generate a unique storage key for a document."""
    ext = Path(filename).suffix
    uid = uuid.uuid4().hex
    return f"transactions/{transaction_id}/documents/{uid}{ext}"


async def upload_document(transaction_id: int, filename: str, content: bytes) -> str:
    """Upload a document and return its storage key.

    If S3 credentials are configured, uploads to S3/R2.
    Otherwise, falls back to local filesystem storage.

    Args:
        transaction_id: ID of the parent transaction.
        filename: Original filename from the upload.
        content: Raw file bytes.

    Returns:
        The storage key (S3 key or local path) for later retrieval.
    """
    storage_key = _generate_storage_key(transaction_id, filename)

    if settings.aws_access_key_id and settings.aws_secret_access_key:
        await _upload_to_s3(storage_key, content)
    else:
        await _upload_to_local(storage_key, content)

    return storage_key


async def _upload_to_s3(storage_key: str, content: bytes) -> None:
    """Upload bytes to S3 or Cloudflare R2.

    TODO: Switch to aioboto3 for true async S3 I/O in production.
          Current implementation uses boto3 in a sync call — acceptable for
          Phase 0 file sizes but should be replaced before scaling.
    """
    import boto3  # noqa: PLC0415

    kwargs: dict = {
        "aws_access_key_id": settings.aws_access_key_id,
        "aws_secret_access_key": settings.aws_secret_access_key,
        "region_name": settings.aws_region,
    }
    if settings.aws_endpoint_url:
        kwargs["endpoint_url"] = settings.aws_endpoint_url

    s3 = boto3.client("s3", **kwargs)
    s3.put_object(
        Bucket=settings.aws_bucket_name,
        Key=storage_key,
        Body=content,
    )


async def _upload_to_local(storage_key: str, content: bytes) -> None:
    """Store file on the local filesystem under LOCAL_STORAGE_PATH.

    Used during development when S3 credentials are not set.
    """
    dest = Path(settings.local_storage_path) / storage_key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)


async def get_presigned_url(storage_key: str, expires_in: int = 3600) -> str:
    """Generate a pre-signed URL for temporary download access.

    TODO: Implement for S3/R2 in Phase 1. Returns a local path stub for now.

    Args:
        storage_key: The key returned by upload_document.
        expires_in: URL expiry in seconds (default 1 hour).

    Returns:
        A URL (pre-signed for S3, or local path for dev).
    """
    if settings.aws_access_key_id and settings.aws_secret_access_key:
        # TODO: Generate real presigned URL via boto3 generate_presigned_url
        raise NotImplementedError("Pre-signed URL generation not yet implemented for S3")

    local_path = Path(settings.local_storage_path) / storage_key
    return f"file://{local_path}"
