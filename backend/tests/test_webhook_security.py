import json
import pytest
from tests.conftest import generate_github_signature


def test_webhook_ping_event(client):
    payload = json.dumps({"zen": "Keep it logically awesome."}).encode("utf-8")
    sig = generate_github_signature(payload)

    response = client.post(
        "/api/v1/webhooks/github",
        data=payload,
        headers={
            "X-GitHub-Event": "ping",
            "X-Hub-Signature-256": sig,
            "Content-Type": "application/json",
        },
    )
    assert response.status_code == 202
    assert response.json().get("zen") == "Keep it logically awesome."


def test_webhook_invalid_signature_rejected(client):
    payload = json.dumps({"action": "opened"}).encode("utf-8")
    response = client.post(
        "/api/v1/webhooks/github",
        data=payload,
        headers={
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": "sha256=invalid_hex_signature_here",
            "Content-Type": "application/json",
        },
    )
    assert response.status_code == 401


def test_webhook_missing_signature_rejected(client):
    payload = json.dumps({"action": "opened"}).encode("utf-8")
    response = client.post(
        "/api/v1/webhooks/github",
        data=payload,
        headers={
            "X-GitHub-Event": "pull_request",
            "Content-Type": "application/json",
        },
    )
    assert response.status_code == 401


def test_webhook_pull_request_opened_success(client):
    payload_data = {
        "action": "opened",
        "repository": {
            "id": 98765,
            "full_name": "test-owner/test-repo",
            "default_branch": "main"
        },
        "pull_request": {
            "number": 42,
            "title": "Add feature X",
            "user": {"login": "octocat"},
            "head": {"sha": "abcdef1234567890abcdef1234567890abcdef12"},
            "base": {"sha": "0000001234567890abcdef1234567890abcdef12"},
            "state": "open",
            "html_url": "https://github.com/test-owner/test-repo/pull/42"
        }
    }
    payload = json.dumps(payload_data).encode("utf-8")
    sig = generate_github_signature(payload)

    response = client.post(
        "/api/v1/webhooks/github",
        data=payload,
        headers={
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": sig,
            "Content-Type": "application/json",
        },
    )
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "queued"
    assert data["repo"] == "test-owner/test-repo"
    assert data["commit_sha"] == "abcdef1234567890abcdef1234567890abcdef12"
