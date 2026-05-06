// @vitest-environment jsdom
// tests/components/TracePanel.test.tsx
// Plan 03-03 Task 1 (CHAT-13 / D-E-01..05): collapsible "See what I did" trace
// panel rendered exclusively from AI SDK v6 message.parts shape. Default state
// is collapsed (D-E-02). Streaming-state shows label-only line (no partial
// JSON flash, RESEARCH §5).
// W3: per-file jsdom directive; global env stays 'node'.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TracePanel, type ToolPart } from '../../src/components/TracePanel';

afterEach(() => {
  cleanup();
});

const baseId = 'call_test_abc';

const inputAvailablePart: ToolPart = {
  type: 'tool-research_company',
  toolCallId: baseId,
  state: 'input-available',
  input: { company: 'Acme', focus: 'mission' },
};

const outputAvailablePart: ToolPart = {
  type: 'tool-research_company',
  toolCallId: baseId,
  state: 'output-available',
  input: { company: 'Acme', focus: 'mission' },
  output: { paragraphs: ['p1', 'p2', 'p3'], sources: [] },
};

const errorPart: ToolPart = {
  type: 'tool-research_company',
  toolCallId: baseId,
  state: 'output-error',
  input: { company: 'Acme' },
  errorText: 'Exa search failed',
};

describe('TracePanel', () => {
  it('renders nothing inside <details> in input-streaming state — label-only inline', () => {
    const part: ToolPart = {
      type: 'tool-research_company',
      toolCallId: baseId,
      state: 'input-streaming',
    };
    render(<TracePanel part={part} />);
    // No details element; just the streaming testid wrapper.
    expect(
      screen.getByTestId(`trace-streaming-${baseId}`),
    ).toBeInTheDocument();
    expect(screen.queryByTestId(`trace-${baseId}`)).not.toBeInTheDocument();
  });

  it('streaming-state label uses the human-readable mapping for research_company', () => {
    const part: ToolPart = {
      type: 'tool-research_company',
      toolCallId: baseId,
      state: 'input-streaming',
    };
    render(<TracePanel part={part} />);
    const el = screen.getByTestId(`trace-streaming-${baseId}`);
    expect(el.textContent).toContain('Researched company');
  });

  it('renders <details> COLLAPSED by default in input-available state (no `open` attr)', () => {
    render(<TracePanel part={inputAvailablePart} />);
    const details = screen.getByTestId(`trace-${baseId}`) as HTMLDetailsElement;
    expect(details.tagName).toBe('DETAILS');
    expect(details.open).toBe(false);
  });

  it('summary contains literal "See what I did"', () => {
    render(<TracePanel part={inputAvailablePart} />);
    const details = screen.getByTestId(`trace-${baseId}`);
    expect(details.textContent).toContain('See what I did');
  });

  it('maps tool-get_case_study to "Pulled case study"', () => {
    const part: ToolPart = {
      type: 'tool-get_case_study',
      toolCallId: 'call_cs_1',
      state: 'input-available',
      input: { slug: 'gap-supply-chain' },
    };
    render(<TracePanel part={part} />);
    const details = screen.getByTestId(`trace-call_cs_1`);
    expect(details.textContent).toContain('Pulled case study');
  });

  it('maps tool-design_metric_framework to "Designed metric framework"', () => {
    const part: ToolPart = {
      type: 'tool-design_metric_framework',
      toolCallId: 'call_mf_1',
      state: 'input-available',
      input: { description: 'thumbs up/down' },
    };
    render(<TracePanel part={part} />);
    const details = screen.getByTestId(`trace-call_mf_1`);
    expect(details.textContent).toContain('Designed metric framework');
  });

  it('renders args JSON in input-available state', () => {
    render(<TracePanel part={inputAvailablePart} />);
    const inputBlock = screen.getByTestId(`trace-input-${baseId}`);
    expect(inputBlock.textContent).toContain('"company"');
    expect(inputBlock.textContent).toContain('"Acme"');
    // Output block NOT yet present
    expect(
      screen.queryByTestId(`trace-output-${baseId}`),
    ).not.toBeInTheDocument();
  });

  it('renders args + response JSON in output-available state', () => {
    render(<TracePanel part={outputAvailablePart} />);
    expect(screen.getByTestId(`trace-input-${baseId}`)).toBeInTheDocument();
    const outputBlock = screen.getByTestId(`trace-output-${baseId}`);
    expect(outputBlock.textContent).toContain('paragraphs');
  });

  it('renders errorText with destructive class in output-error state', () => {
    render(<TracePanel part={errorPart} />);
    const errBlock = screen.getByTestId(`trace-error-${baseId}`);
    expect(errBlock.textContent).toContain('Exa search failed');
    // Destructive styling — class includes 'destructive' somewhere
    expect(errBlock.className).toMatch(/destructive/);
  });

  it('falls back to raw type for unknown tool prefix', () => {
    const part: ToolPart = {
      type: 'tool-mystery',
      toolCallId: 'call_x',
      state: 'input-available',
      input: {},
    };
    render(<TracePanel part={part} />);
    const details = screen.getByTestId(`trace-call_x`);
    expect(details.textContent).toContain('tool-mystery');
  });
});
