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
# Added lines only (+ lines in unified diff). Two-stage filter (grep '^\+' then
# grep -v '^\+\+\+' then pattern) avoids a regex backtracking failure seen with
# '^\+[^+].*PATTERN' when PATTERN starts at column 2.
#
# Two diff scopes:
#   - VALUES (patterns 2 & 3 — real secret shapes): scan everything except the
#     hook installer, the hook self-test, and .env.example (which contains only
#     placeholders). If an actual sk-ant-* or JWT appears anywhere else, block.
#   - NAMES (pattern 1 — env var names like NEXT_PUBLIC_*KEY): additionally
#     exclude planning docs (.planning/**) and design specs (docs/superpowers/**)
#     where referencing env var names is legitimate design documentation, not
#     a secret-leak vector. Also exclude the canonical legitimate consumers of
#     NEXT_PUBLIC_SUPABASE_ANON_KEY (env.ts schema, supabase-browser.ts client
#     singleton, admin-auth.ts Layer-2 helper, proxy.ts Layer-1 perimeter) and
#     the corresponding tests/** files (vi.mock fixtures reference the var
#     name) — the anon key name is public-by-design per Supabase docs and
#     these are the only places that read it. The values that those names
#     would hold are still covered by patterns 2 & 3. Also exclude
#     .github/workflows/** because eval.yml legitimately references the env
#     var name to inject GH Actions secrets into the runner.
diff_output_values="$(git diff --cached -U0 --no-color -- ':(exclude).env.example' ':(exclude)scripts/install-pre-commit-hook.sh' ':(exclude)scripts/test-pre-commit-hook.sh' ':(exclude)package-lock.json' || true)"
diff_output_names="$(git diff --cached -U0 --no-color -- ':(exclude).env.example' ':(exclude)scripts/install-pre-commit-hook.sh' ':(exclude)scripts/test-pre-commit-hook.sh' ':(exclude).planning/**' ':(exclude)docs/superpowers/**' ':(exclude)src/lib/env.ts' ':(exclude)src/lib/supabase-browser.ts' ':(exclude)src/lib/admin-auth.ts' ':(exclude)src/proxy.ts' ':(exclude)src/app/auth/callback/route.ts' ':(exclude)tests/**' ':(exclude).github/workflows/**' || true)"

if [[ -z "$diff_output_values" ]] && [[ -z "$diff_output_names" ]]; then
  exit 0
fi

check_pattern() {
  local diff_input="$1"
  local pattern="$2"
  local label="$3"
  matches="$(printf '%s\n' "$diff_input" | grep -E '^\+' | grep -v -E '^\+\+\+' | grep -E "$pattern" || true)"
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
check_pattern "$diff_output_names"  'NEXT_PUBLIC_[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD|PASS)'       'NEXT_PUBLIC_ secret name' || fail=1
check_pattern "$diff_output_values" 'sk-ant-[A-Za-z0-9_-]{20,}'                                 'Anthropic API key (sk-ant-*)' || fail=1
check_pattern "$diff_output_values" 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+' 'JWT (possible Supabase service-role key)' || fail=1

exit $fail
HOOK_EOF

chmod +x "$HOOK_PATH"
echo "installed pre-commit hook at $HOOK_PATH"
echo "test it by staging a file containing 'sk-ant-XXXXXXXXXXXXXXXXXXXX' and trying to commit."
