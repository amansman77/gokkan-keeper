#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8787}"

pass() {
  printf '[PASS] %s\n' "$1"
}

fail() {
  printf '[FAIL] %s\n' "$1"
  exit 1
}

request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local header_file body_file status
  header_file="$(mktemp)"
  body_file="$(mktemp)"

  if [[ -n "$body" ]]; then
    status="$(curl -sS -D "$header_file" -o "$body_file" -w '%{http_code}' -X "$method" "${BASE_URL}${path}" -H 'Content-Type: application/json' --data "$body")"
  else
    status="$(curl -sS -D "$header_file" -o "$body_file" -w '%{http_code}' -X "$method" "${BASE_URL}${path}")"
  fi

  echo "$header_file|$body_file|$status"
}

read_response() {
  local response="$1"
  IFS='|' read -r RESP_HEADERS RESP_BODY RESP_STATUS <<< "$response"
}

assert_status() {
  local expected="$1"
  local label="$2"
  if [[ "$RESP_STATUS" != "$expected" ]]; then
    echo "Status: $RESP_STATUS"
    echo 'Headers:'
    cat "$RESP_HEADERS"
    echo 'Body:'
    cat "$RESP_BODY"
    fail "$label"
  fi
}

assert_body_contains() {
  local needle="$1"
  local label="$2"
  if ! grep -q "$needle" "$RESP_BODY"; then
    echo 'Body:'
    cat "$RESP_BODY"
    fail "$label"
  fi
}

assert_header_contains() {
  local needle="$1"
  local label="$2"
  if ! grep -qi "$needle" "$RESP_HEADERS"; then
    echo 'Headers:'
    cat "$RESP_HEADERS"
    fail "$label"
  fi
}

cleanup_response() {
  rm -f "$RESP_HEADERS" "$RESP_BODY"
}

# 1) health check
read_response "$(request GET /health)"
assert_status 200 'health should return 200'
assert_body_contains '"status":"ok"' 'health response should include ok status'
cleanup_response
pass 'GET /health'

# 2) /auth/me unauthenticated
read_response "$(request GET /auth/me)"
assert_status 200 '/auth/me should return 200 even when unauthenticated'
assert_body_contains '"authenticated":false' '/auth/me should report unauthenticated'
cleanup_response
pass 'GET /auth/me (unauthenticated)'

# 3) /auth/google missing credential
read_response "$(request POST /auth/google '{}')"
assert_status 400 '/auth/google missing credential should return 400'
assert_body_contains 'Missing credential' '/auth/google missing credential error message'
cleanup_response
pass 'POST /auth/google (missing credential)'

# 4) /auth/google invalid credential
read_response "$(request POST /auth/google '{"credential":"invalid-token"}')"
if [[ "$RESP_STATUS" != "401" && "$RESP_STATUS" != "500" ]]; then
  echo "Status: $RESP_STATUS"
  echo 'Body:'
  cat "$RESP_BODY"
  fail '/auth/google invalid credential should return 401 or 500 (if env missing)'
fi
cleanup_response
pass 'POST /auth/google (invalid credential)'

# 5) /auth/logout clears session cookie
read_response "$(request POST /auth/logout)"
assert_status 200 '/auth/logout should return 200'
assert_header_contains 'Set-Cookie: gk_session=' '/auth/logout should set gk_session cookie'
assert_header_contains 'Max-Age=0' '/auth/logout should expire gk_session cookie'
cleanup_response
pass 'POST /auth/logout'

# 6) private route blocked without session
read_response "$(request GET /granaries)"
assert_status 401 'private API should return 401 without session'
cleanup_response
pass 'GET /granaries (unauthorized)'

echo 'All auth integration checks passed.'
