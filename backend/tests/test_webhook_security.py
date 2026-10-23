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


def test_webhook_replay_protection_rejects_duplicate_delivery(client):
    """Sending the same X-GitHub-Delivery GUID twice MUST be rejected with HTTP 409 Conflict."""
    payload_data = {
        "action": "opened",
        "repository": {
            "id": 11223,
            "full_name": "test-owner/replay-repo",
            "default_branch": "main"
        },
        "pull_request": {
            "number": 1,
            "title": "Initial commit",
            "user": {"login": "attacker"},
            "head": {"sha": "1111111111111111111111111111111111111111"},
            "base": {"sha": "0000000000000000000000000000000000000000"},
            "state": "open",
            "html_url": "https://github.com/test-owner/replay-repo/pull/1"
        }
    }
    payload = json.dumps(payload_data).encode("utf-8")
    sig = generate_github_signature(payload)
    delivery_id = "guid-unique-delivery-test-12345"

    headers = {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": sig,
        "X-GitHub-Delivery": delivery_id,
        "Content-Type": "application/json",
    }

    # 1. First delivery attempt -> Accepted (202)
    first_res = client.post("/api/v1/webhooks/github", data=payload, headers=headers)
    assert first_res.status_code == 202

    # 2. Replayed delivery attempt -> Conflict (409)
    replay_res = client.post("/api/v1/webhooks/github", data=payload, headers=headers)
    assert replay_res.status_code == 409
    assert "Duplicate webhook delivery ID" in replay_res.json()["detail"]
