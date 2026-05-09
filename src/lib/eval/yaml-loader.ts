// src/lib/eval/yaml-loader.ts
// Loads evals/cat-NN-*.yaml and validates against EvalCaseSchema.
// Forward-compat: extra unknown keys in YAML are ignored (`.passthrough()` on
// the schema), but missing required fields throw. Plans 05-04..05-09 author
// the YAML files; this loader is the single contract.
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import { childLogger } from '@/lib/logger';
import { EvalCaseSchema, type EvalCase } from './types';

const log = childLogger({ event: 'eval_yaml_load' });

/**
 * Load and validate eval cases from a YAML file. The YAML must be a top-level
 * array of case objects, each matching EvalCaseSchema.
 *
 * Throws on:
 *  - file-not-found / read error
 *  - YAML parse failure (with filename + position)
 *  - non-array top-level (e.g., a single mapping)
 *  - any case failing zod validation (with array index for traceability)
 *
 * Returns empty array (with warn log) for an empty / whitespace-only file.
 */
export async function loadCases(filepath: string): Promise<EvalCase[]> {
  let raw: string;
  try {
    raw = await readFile(filepath, 'utf8');
  } catch (e) {
    throw new Error(
      `eval yaml: cannot read ${filepath}: ${(e as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw, { filename: filepath });
  } catch (e) {
    throw new Error(
      `eval yaml: parse failure in ${filepath}: ${(e as Error).message}`,
    );
  }

  if (parsed == null) {
    log.warn({ filepath }, 'empty yaml file; returning zero cases');
    return [];
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      `eval yaml: expected top-level array in ${filepath}, got ${typeof parsed}`,
    );
  }

  const cases: EvalCase[] = [];
  for (const [i, item] of parsed.entries()) {
    const result = EvalCaseSchema.safeParse(item);
    if (!result.success) {
      throw new Error(
        `eval yaml: case index ${i} in ${filepath} failed validation: ${result.error.message}`,
      );
    }
    cases.push(result.data);
  }
  return cases;
}

export { EvalCaseSchema };
