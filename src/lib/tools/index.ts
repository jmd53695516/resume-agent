// src/lib/tools/index.ts
// Barrel export consumed by src/app/api/chat/route.ts in Plan 03-02:
//   tools: { research_company, get_case_study, design_metric_framework }
// + the prepareStep callback for TOOL-07/SAFE-15 + the failure-copy map for
// trace-panel rendering.
export { research_company } from './research-company';
export { get_case_study } from './get-case-study';
export { design_metric_framework } from './design-metric-framework';
export { enforceToolCallDepthCap } from './depth-cap';
export { TOOL_FAILURE_COPY, type ToolFailureKey } from './failure-copy';
