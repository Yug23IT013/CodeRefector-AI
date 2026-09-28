import logging
from typing import Any, Dict, List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.jwt import create_access_token, get_current_user
from app.db.session import get_db
from app.db.models import User, Repository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class TrackRepoPayload(BaseModel):
    full_name: str
    auto_install_webhook: bool = True


@router.get("/github/url")
def get_github_oauth_url() -> Dict[str, Any]:
    """Get the GitHub OAuth authorization URL."""
    if not settings.GITHUB_CLIENT_ID:
        return {
            "configured": False,
            "url": None,
            "message": "GITHUB_CLIENT_ID not configured in .env. You can use demo login or configure GitHub OAuth.",
        }

    callback_url = f"http://localhost:{settings.PORT}/api/v1/auth/github/callback"
    url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.GITHUB_CLIENT_ID}"
        f"&scope=read:user,repo,admin:repo_hook"
        f"&redirect_uri={callback_url}"
    )
    return {"configured": True, "url": url}


@router.get("/github/callback")
async def github_oauth_callback(
    code: str = Query(..., description="Authorization code from GitHub"),
    db: Session = Depends(get_db)
):
    """
    Handle GitHub OAuth redirect callback.
    Exchanges code for access token, fetches profile, upserts user, and returns JWT.
    """
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub OAuth credentials not configured.",
        )

    # 1. Exchange code for access token
    token_url = "https://github.com/login/oauth/access_token"
    token_payload = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "client_secret": settings.GITHUB_CLIENT_SECRET,
        "code": code,
    }
    headers = {"Accept": "application/json"}

    async with httpx.AsyncClient(timeout=20.0) as client:
        token_res = await client.post(token_url, json=token_payload, headers=headers)
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange GitHub authorization code.")

        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=400,
                detail=token_data.get("error_description", "No access token returned from GitHub."),
            )

        # 2. Fetch User Profile
        user_res = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}", "User-Agent": "CodeRefactor-AI"},
        )
        if user_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user profile from GitHub.")

        gh_user = user_res.json()

    # 3. Upsert User in database
    github_id = gh_user.get("id")
    username = gh_user.get("login")
    name = gh_user.get("name")
    avatar_url = gh_user.get("avatar_url")

    user = db.query(User).filter(User.github_id == github_id).first()
    if not user:
        user = User(
            github_id=github_id,
            username=username,
            name=name,
            avatar_url=avatar_url,
            github_access_token=access_token,
        )
        db.add(user)
    else:
        user.username = username
        user.name = name
        user.avatar_url = avatar_url
        user.github_access_token = access_token

    db.commit()
    db.refresh(user)

    # 4. Issue JWT
    jwt_token = create_access_token({"sub": str(user.id), "username": user.username})

    # 5. Redirect back to frontend with token
    redirect_url = f"{settings.FRONTEND_URL}/#auth_token={jwt_token}"
    return RedirectResponse(url=redirect_url)


@router.post("/demo-login")
def demo_login(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Instant demo login (allows testing full authenticated flow without configuring OAuth App).
    """
    user = db.query(User).filter(User.username == "demo-developer").first()
    if not user:
        user = User(
            github_id=999999,
            username="demo-developer",
            name="Demo Developer",
            avatar_url="https://avatars.githubusercontent.com/u/9919?s=200&v=4",
            github_access_token=settings.GITHUB_TOKEN or None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    jwt_token = create_access_token({"sub": str(user.id), "username": user.username})
    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "name": user.name,
            "avatar_url": user.avatar_url,
        },
    }


@router.get("/me")
def get_current_user_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get profile of current logged-in user."""
    tracked_count = db.query(Repository).filter(Repository.user_id == user.id).count()
    return {
        "id": user.id,
        "github_id": user.github_id,
        "username": user.username,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "has_github_token": bool(user.github_access_token or settings.GITHUB_TOKEN),
        "tracked_repos_count": tracked_count,
    }


@router.get("/user-repos")
async def list_user_github_repos(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Fetch repositories accessible by the user from GitHub API.
    Marks which ones are already tracked in CodeRefactor AI.
    """
    token = user.github_access_token or settings.GITHUB_TOKEN
    if not token:
        # Return currently tracked repos if no GitHub token
        existing = db.query(Repository).all()
        return [
            {
                "id": r.id,
                "full_name": r.full_name,
                "default_branch": r.default_branch,
                "is_tracked": True,
            }
            for r in existing
        ]

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CodeRefactor-AI",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get("https://api.github.com/user/repos?per_page=100&sort=updated", headers=headers)
            if res.status_code != 200:
                logger.error(f"GitHub list repos failed: {res.status_code} {res.text}")
                return []

            gh_repos = res.json()

        # Get set of already tracked repo names
        tracked_names = {r.full_name.lower() for r in db.query(Repository).all()}

        results = []
        for r in gh_repos:
            full_name = r.get("full_name")
            results.append({
                "id": r.get("id"),
                "full_name": full_name,
                "private": r.get("private", False),
                "default_branch": r.get("default_branch", "main"),
                "description": r.get("description"),
                "is_tracked": full_name.lower() in tracked_names if full_name else False,
            })
        return results

    except Exception as e:
        logger.error(f"Error fetching user repos from GitHub: {e}")
        return []


@router.post("/track-repo")
async def track_repository(
    payload: TrackRepoPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Add a repository to CodeRefactor AI tracking and optionally install webhook via GitHub API.
    """
    full_name = payload.full_name.strip()
    if not full_name or "/" not in full_name:
        raise HTTPException(status_code=400, detail="Repository full name must be in format 'owner/repo'")

    # Check if already tracked
    repo = db.query(Repository).filter(Repository.full_name.ilike(full_name)).first()
    if not repo:
        repo = Repository(
            full_name=full_name,
            user_id=user.id,
            default_branch="main",
        )
        db.add(repo)
    else:
        # Link user if not assigned
        if not repo.user_id:
            repo.user_id = user.id

    db.commit()
    db.refresh(repo)

    webhook_installed = False
    token = user.github_access_token or settings.GITHUB_TOKEN

    # Optionally auto-install webhook on GitHub if webhook public URL is configured
    if payload.auto_install_webhook and token and settings.WEBHOOK_PUBLIC_URL:
        owner, repo_name = full_name.split("/", 1)
        hooks_url = f"https://api.github.com/repos/{owner}/{repo_name}/hooks"
        hook_body = {
            "name": "web",
            "active": True,
            "events": ["pull_request"],
            "config": {
                "url": settings.WEBHOOK_PUBLIC_URL,
                "content_type": "json",
                "secret": settings.GITHUB_WEBHOOK_SECRET,
                "insecure_ssl": "0",
            },
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "CodeRefactor-AI",
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                hook_res = await client.post(hooks_url, json=hook_body, headers=headers)
                if hook_res.status_code in (200, 201):
                    webhook_installed = True
                    logger.info(f"Auto-installed webhook on {full_name}")
                else:
                    logger.warning(f"Could not auto-install webhook on {full_name}: {hook_res.status_code} {hook_res.text}")
        except Exception as e:
            logger.warning(f"Failed to auto-install webhook on {full_name}: {e}")

    return {
        "status": "success",
        "message": f"Repository '{full_name}' is now tracked by CodeRefactor AI.",
        "repo_id": repo.id,
        "full_name": repo.full_name,
        "webhook_auto_installed": webhook_installed,
    }
