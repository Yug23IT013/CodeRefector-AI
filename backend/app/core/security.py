import hmac
import hashlib
from typing import Optional
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

security_bearer = HTTPBearer(auto_error=False)


def verify_github_signature(
    payload_body: bytes,
    signature_header: Optional[str],
    secret: Optional[str] = None
) -> bool:
    """
    Verify that the payload was sent from GitHub by calculating the HMAC-SHA256
    digest of the payload and comparing it to the signature in X-Hub-Signature-256.
    """
    signing_secret = secret or settings.GITHUB_WEBHOOK_SECRET
    if not signing_secret:
        # If no secret is configured, allow in development mode with a warning, or fail in prod
        if settings.ENVIRONMENT == "development":
            return True
        return False

    if not signature_header:
        return False

    # Format is "sha256=<hex_digest>"
    parts = signature_header.split("=")
    if len(parts) != 2 or parts[0] != "sha256":
        return False

    received_signature = parts[1].strip()
    mac = hmac.new(
        key=signing_secret.encode("utf-8"),
        msg=payload_body,
        digestmod=hashlib.sha256
    )
    expected_signature = mac.hexdigest()

    return hmac.compare_digest(expected_signature, received_signature)


def verify_api_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer)
) -> bool:
    """
    Optional authorization dependency for API endpoints.
    If DASHBOARD_API_TOKEN is set in environment, requires matching Bearer token.
    """
    if not settings.DASHBOARD_API_TOKEN:
        return True

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token"
        )

    if not hmac.compare_digest(credentials.credentials, settings.DASHBOARD_API_TOKEN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid authentication token"
        )

    return True
