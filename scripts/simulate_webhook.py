#!/usr/bin/env python3
"""
Simulate a GitHub Pull Request webhook event locally.
Calculates the proper HMAC-SHA256 signature using your GITHUB_WEBHOOK_SECRET
and POSTs to http://localhost:8000/api/v1/webhooks/github.
"""

import hashlib
import hmac
import json
import os
import sys
import httpx

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
except ImportError:
    pass

SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "test-secret-123")
API_URL = os.getenv("WEBHOOK_URL", "http://localhost:8000/api/v1/webhooks/github")
REPO_NAME = os.getenv("REPO_NAME", "Yug23IT013/Datatable-using-api")

payload = {
    "action": "opened",
    "repository": {
        "id": 3001,
        "full_name": REPO_NAME,
        "default_branch": "main"
    },
    "pull_request": {
        "number": 1,
        "title": "Refactor DataTable queries & add export endpoints",
        "user": {
            "login": "Yug23IT013"
        },
        "head": {
            "sha": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
        },
        "base": {
            "sha": "f0e1d2c3b4a5f0e1d2c3b4a5f0e1d2c3b4a5f0e1"
        },
        "state": "open",
        "html_url": f"https://github.com/{REPO_NAME}/pull/1"
    }
}

payload_bytes = json.dumps(payload).encode("utf-8")

# Compute HMAC-SHA256 signature matching GitHub format: "sha256=<hex>"
mac = hmac.new(SECRET.encode("utf-8"), payload_bytes, hashlib.sha256)
signature = f"sha256={mac.hexdigest()}"

headers = {
    "Content-Type": "application/json",
    "X-GitHub-Event": "pull_request",
    "X-Hub-Signature-256": signature,
}

print(f"--> Sending simulated PR webhook to: {API_URL}")
print(f"--> Secret used: '{SECRET}'")
print(f"--> Generated Signature: {signature}")

try:
    with httpx.Client(timeout=10.0) as client:
        response = client.post(API_URL, content=payload_bytes, headers=headers)
        print(f"\n[Response HTTP {response.status_code}]")
        print(json.dumps(response.json(), indent=2))
except httpx.ConnectError:
    print(f"\n[ERROR] Could not connect to {API_URL}. Is the backend server running?")
    print("Start backend: cd backend && uvicorn app.main:app --reload")
except Exception as e:
    print(f"\n[ERROR] {e}")
