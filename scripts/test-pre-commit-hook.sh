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
# Teardown silently swallows errors — correct for cleanup (we don't want to
# fail-loudly if $WORK was never created or git index doesn't have it staged)
# but means cleanup failures aren't visible. WR-04.
trap 'rm -rf "$WORK"; git reset HEAD -- "$WORK" 2>/dev/null || true' EXIT

test_case() {
  local label="$1"
  local content="$2"
  local f="$WORK/test-$RANDOM.txt"
  # WR-04: explicit error handling on setup steps. Without these, a silent
  # printf/git-add failure could leave the stage empty and the hook would
  # exit 0 (no staged changes), yielding a misleading FAIL message instead
  # of an honest setup-error message. False-PASS would be worse than false-FAIL.
  if ! printf '%s\n' "$content" > "$f"; then
    echo "ERROR: could not write fixture for '$label'" >&2
    return 1
  fi
  if ! git add "$f"; then
    echo "ERROR: could not stage fixture for '$label'" >&2
    return 1
  fi
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

# Test .env.local blocking. WR-04: same setup-step error handling as test_case.
f2="$WORK/.env.local"
if ! printf 'SOMEKEY=value\n' > "$f2"; then
  echo "ERROR: could not write .env.local fixture" >&2
  fail=1
elif ! git add -f "$f2"; then
  echo "ERROR: could not stage .env.local fixture" >&2
  fail=1
elif bash "$HOOK" 2>/dev/null; then
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
