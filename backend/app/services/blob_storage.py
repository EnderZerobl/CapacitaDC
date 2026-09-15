"""
services/blob_storage.py — Private Vercel Blob storage for uploaded files.

Vercel's compute is stateless: files written to local disk do not survive
between invocations, so uploads go to a private Vercel Blob store instead.
Private access means every read requires the same bearer token as writes —
unlike public blob storage, files are never reachable through a bare URL.
"""

from vercel.blob import BlobClient
from vercel.blob.errors import BlobNotFoundError

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
