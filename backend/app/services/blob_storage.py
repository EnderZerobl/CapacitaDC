"""
services/blob_storage.py — Private Vercel Blob storage for uploaded files.

Vercel's compute is stateless: files written to local disk do not survive
between invocations, so uploads go to a private Vercel Blob store instead.
Private access means every read requires the same bearer token as writes —
unlike public blob storage, files are never reachable through a bare URL.
"""

import base64
import hashlib
import hmac
import json
import os
import time

from vercel.blob import BlobClient
from vercel.blob.errors import BlobError, BlobNoTokenProvidedError, BlobNotFoundError

_client: BlobClient | None = None


def _get_client() -> BlobClient:
    global _client
    if _client is None:
        _client = BlobClient()
    return _client


def upload(pathname: str, data: bytes, content_type: str | None = None) -> str:
    """Store bytes privately. Returns the pathname to persist as the storage key."""
    result = _get_client().put(pathname, data, access="private", content_type=content_type)
    return result.pathname


def client_upload_token(pathname: str, max_size: int, valid_for_seconds: int = 600) -> str:
    """A token that lets the browser send one file straight to the store.

    Vercel Functions reject request bodies over 4.5 MB, so larger files cannot
    pass through the API. The token only creates this exact pathname, without
    overwriting, up to max_size bytes. The Python SDK has no helper for it: the
    format mirrors generateClientTokenFromReadWriteToken from @vercel/blob.
    """
    token = os.environ.get("BLOB_READ_WRITE_TOKEN") or os.environ.get("VERCEL_BLOB_READ_WRITE_TOKEN")
    if not token:
        raise BlobNoTokenProvidedError()
    parts = token.split("_")  # vercel_blob_rw_<storeId>_<secret>
    if len(parts) < 5 or not parts[3]:
        raise BlobError("Invalid BLOB_READ_WRITE_TOKEN")
    payload = base64.b64encode(json.dumps({
        "pathname": pathname,
        "maximumSizeInBytes": max_size,
        "validUntil": int((time.time() + valid_for_seconds) * 1000),
        "addRandomSuffix": False,
        "allowOverwrite": False,
    }, separators=(",", ":")).encode()).decode()
    signature = hmac.new(token.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"vercel_blob_client_{parts[3]}_" + base64.b64encode(f"{signature}.{payload}".encode()).decode()


def size(pathname: str) -> int | None:
    """A stored blob's size in bytes, or None if it doesn't exist."""
    try:
        return _get_client().head(pathname).size
    except BlobNotFoundError:
        return None


def download(pathname: str) -> bytes | None:
    """Fetch a blob's bytes, or None if it doesn't exist."""
    try:
        result = _get_client().get(pathname, access="private")
    except BlobNotFoundError:
        return None
    return result.content


def delete(pathname: str) -> None:
    """Remove a blob. A missing blob is not an error."""
    try:
        _get_client().delete(pathname)
    except BlobNotFoundError:
        pass
