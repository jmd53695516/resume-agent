#!/usr/bin/env bash
# Self-test for .git/hooks/pre-commit. Run from repo root after install.
# Exits 0 if all four patterns are correctly blocked; exits 1 if any slipped through.
set -u

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK="$REPO_ROOT/.git/hooks/pre-commit"
if [[ ! -x "$HOOK" ]]; then
  echo "error: hook not installed at $HOOK. Run: npm run install-hooks" >&2
  exit 1
fi

WORK="$REPO_ROOT/.tmp-hooktest"
mkdir -p "$WORK"
trap 'rm -rf "$WORK"; git reset HEAD -- "$WORK" 2>/dev/null || true' EXIT

test_case() {
  local label="$1"
  local content="$2"
  local f="$WORK/test-$RANDOM.txt"
  printf '%s\n' "$content" > "$f"
  git add "$f"
  if bash "$HOOK" 2>/dev/null; then
    echo "FAIL: hook did NOT block '$label'"
    git reset HEAD -- "$f" >/dev/null 2>&1
    return 1
  else
    echo "PASS: hook blocked '$label'"
    git reset HEAD -- "$f" >/dev/null 2>&1
    return 0
  fi
}

fail=0
test_case "NEXT_PUBLIC_ secret"   "NEXT_PUBLIC_FAKE_SECRET_KEY=abc123xyzlooksecret" || fail=1
test_case "Anthropic key"         "const k = 'sk-ant-1234567890abcdefghijklmnop';" || fail=1
test_case "Supabase JWT"          "const t = 'eyJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE2NzE5ODIyODIsImV4cCI6NDgyNzY1NTg4Mn0aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.fakesig_but_shape_matches_jwt_regex';" || fail=1

# Test .env.local blocking
f2="$WORK/.env.local"
printf 'SOMEKEY=value\n' > "$f2"
git add -f "$f2"
if bash "$HOOK" 2>/dev/null; then
  echo "FAIL: hook did NOT block staged .env.local"
  fail=1
else
  echo "PASS: hook blocked staged .env.local"
fi
git reset HEAD -- "$f2" >/dev/null 2>&1 || true

if [[ $fail -eq 0 ]]; then
  echo "ALL_HOOK_TESTS_PASSED"
else
  echo "HOOK_TESTS_FAILED"
  exit 1
fi
