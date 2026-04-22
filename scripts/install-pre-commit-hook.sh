#!/usr/bin/env bash
# Source: CONTEXT.md D-D-01..04
# Installs a pre-commit hook that blocks accidental secret commits.
# Idempotent — safe to re-run.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
if [[ -z "$REPO_ROOT" ]]; then
  echo "error: not inside a git repo" >&2
  exit 1
fi

HOOK_PATH="$REPO_ROOT/.git/hooks/pre-commit"

cat > "$HOOK_PATH" <<'HOOK_EOF'
#!/usr/bin/env bash
# pre-commit hook — secret scanning (auto-generated; edit scripts/install-pre-commit-hook.sh to change)
set -euo pipefail

# Patterns we block (CONTEXT.md D-D-02):
#   1. NEXT_PUBLIC_.*(KEY|SECRET|TOKEN|PASSWORD|PASS)
#   2. Raw Anthropic keys:        sk-ant-[A-Za-z0-9_-]+
#   3. Supabase service-role JWT: eyJ[...].[...].[...]
#   4. Any staged .env*.local file

# (4) Block staged .env*.local files outright
staged_files="$(git diff --cached --name-only --diff-filter=ACMR)"
if [[ -n "$staged_files" ]]; then
  while IFS= read -r f; do
    if [[ "$f" =~ (^|/)\.env.*\.local$ ]]; then
      echo "error: attempting to commit '$f' — .env*.local files are gitignored for a reason." >&2
      echo "       If this is intentional, remove the file from staging: git reset HEAD '$f'" >&2
      exit 1
    fi
  done <<< "$staged_files"
fi

# (1) (2) (3) Scan staged content for forbidden patterns
# We use git diff --cached (only staged changes) and look at added lines only (+).
diff_output="$(git diff --cached -U0 --no-color -- ':(exclude).env.example' ':(exclude)scripts/install-pre-commit-hook.sh' ':(exclude)scripts/test-pre-commit-hook.sh' || true)"

if [[ -z "$diff_output" ]]; then
  exit 0
fi

check_pattern() {
  local pattern="$1"
  local label="$2"
  # Filter to added lines (start with '+') and strip diff file-headers ('+++'),
  # then match the forbidden pattern. Two-stage filter avoids regex backtracking
  # failures seen with '^\+[^+].*PATTERN' when PATTERN starts at column 2.
  matches="$(printf '%s\n' "$diff_output" | grep -E '^\+' | grep -v -E '^\+\+\+' | grep -E "$pattern" || true)"
  if [[ -n "$matches" ]]; then
    echo "error: commit blocked — detected $label in staged changes:" >&2
    echo "$matches" | head -5 >&2
    echo "" >&2
    echo "       If this is a false positive (e.g. a documentation example)," >&2
    echo "       rephrase the line. There is no --no-verify escape hatch for a reason." >&2
    return 1
  fi
  return 0
}

fail=0
check_pattern 'NEXT_PUBLIC_[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD|PASS)' 'NEXT_PUBLIC_ secret name' || fail=1
check_pattern 'sk-ant-[A-Za-z0-9_-]{20,}' 'Anthropic API key (sk-ant-*)' || fail=1
check_pattern 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+' 'JWT (possible Supabase service-role key)' || fail=1

exit $fail
HOOK_EOF

chmod +x "$HOOK_PATH"
echo "installed pre-commit hook at $HOOK_PATH"
echo "test it by staging a file containing 'sk-ant-XXXXXXXXXXXXXXXXXXXX' and trying to commit."
