// scripts/inspect-eval-failures.ts
// One-off ops utility for Plan 05-12 Task 0 Step C iteration. Queries
// eval_cases directly via the service-role key for a given runId and prints
// the prompt + response + judge_rationale of every failed case. Bypasses the
// admin UI auth flow (which currently breaks on Vercel preview because the
// Supabase OAuth callback URL allowlist is configured for localhost only).
//
// Run via:   npm run eval:inspect <runId>
//   or:      node --env-file-if-exists=.env.local --import tsx scripts/inspect-eval-failures.ts <runId>
//
// Optional --cat=cat1 filter narrows to one category (cat1, cat2, cat3,
// cat4-judge, cat5, cat6).
import { supabaseAdmin } from '../src/lib/supabase-server';

interface EvalCaseRow {
  case_id: string;
  category: string;
  prompt: string;
  response: string | null;
  judge_score: number | null;
  judge_verdict: 'pass' | 'fail' | null;
  judge_rationale: string | null;
  passed: boolean;
  cost_cents: number;
}

function parseArgs(argv: string[]): { runId: string | null; category: string | null } {
  const args = argv.slice(2);
  let runId: string | null = null;
  let category: string | null = null;
  for (const a of args) {
    if (a.startsWith('--cat=')) {
      category = a.slice('--cat='.length);
    } else if (!a.startsWith('--') && runId === null) {
      runId = a;
    }
  }
  return { runId, category };
}

async function main(): Promise<void> {
  const { runId, category } = parseArgs(process.argv);
  if (!runId) {
    console.error('usage: tsx scripts/inspect-eval-failures.ts <runId> [--cat=cat1]');
    process.exit(2);
  }

  let query = supabaseAdmin
    .from('eval_cases')
    .select(
      'case_id, category, prompt, response, judge_score, judge_verdict, judge_rationale, passed, cost_cents',
    )
    .eq('run_id', runId)
    .eq('passed', false)
    .order('category', { ascending: true })
    .order('case_id', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`query failed: ${error.message}`);
    process.exit(1);
  }

  const rows = (data ?? []) as EvalCaseRow[];
  if (rows.length === 0) {
    console.log(`No failed cases for run ${runId}${category ? ` in ${category}` : ''}.`);
    return;
  }

  console.log(`# Eval failure detail — runId=${runId}${category ? ` cat=${category}` : ''}`);
  console.log(`# Failed cases: ${rows.length}`);
  console.log('');

  for (const r of rows) {
    console.log(`================================================================`);
    console.log(`=== ${r.case_id}  [${r.category}]  score=${r.judge_score ?? 'null'}  verdict=${r.judge_verdict ?? 'null'}`);
    console.log(`================================================================`);
    console.log('');
    console.log('--- Prompt ---');
    console.log(r.prompt);
    console.log('');
    console.log('--- Response ---');
    console.log(r.response ?? '(no response captured — likely deflection or judge error)');
    console.log('');
    console.log('--- Judge rationale ---');
    console.log(r.judge_rationale ?? '(empty)');
    console.log('');
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
