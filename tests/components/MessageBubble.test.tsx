// @vitest-environment jsdom
// tests/components/MessageBubble.test.tsx
// Plan 03-03 Task 3: MessageBubble extends to walk message.parts in assistant
// role and dispatch to TracePanel + (for design_metric_framework) MetricCard.
// Phase 2 behavior (user role + stripMarkdownHeaders on text) preserved.
// W3: per-file jsdom directive; global env stays 'node'.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MessageBubble } from '../../src/components/MessageBubble';

afterEach(() => {
  cleanup();
});

const validMetric = {
  north_star: 'NS',
  input_metrics: ['im1'],
  counter_metrics: ['cm1'],
  guardrails: ['g1'],
  proposed_experiment: 'pe',
  open_questions: ['oq1'],
};

describe('MessageBubble', () => {
  it('user role renders text only (Phase 2 behavior preserved)', () => {
    render(<MessageBubble role="user" text="hi joe" />);
    const bubble = screen.getByTestId('msg-user');
    expect(bubble.textContent).toContain('hi joe');
    // No assistant test-ids
    expect(screen.queryByTestId('msg-assistant')).not.toBeInTheDocument();
  });

  it('assistant role with text part: stripMarkdownHeaders applied (Phase 2 D-I-07)', () => {
    render(
      <MessageBubble
        role="assistant"
        parts={[{ type: 'text', text: '# Heading\nbody line' }]}
      />,
    );
    const bubble = screen.getByTestId('msg-assistant');
    // Heading prefix stripped
    expect(bubble.textContent).not.toMatch(/^# Heading/);
    expect(bubble.textContent).toContain('Heading');
    expect(bubble.textContent).toContain('body line');
  });

  it('assistant with tool-research_company part renders text first, then TracePanel', () => {
    render(
      <MessageBubble
        role="assistant"
        parts={[
          { type: 'text', text: 'I looked them up.' },
          {
            type: 'tool-research_company',
            toolCallId: 'call_rc_1',
            state: 'output-available',
            input: { company: 'Acme' },
            output: { paragraphs: ['p1'] },
          },
        ]}
      />,
    );
    const bubble = screen.getByTestId('msg-assistant');
    const trace = screen.getByTestId('trace-call_rc_1');
    expect(trace).toBeInTheDocument();
    // Text appears before trace in DOM order
    const text = screen.getByText('I looked them up.');
    expect(text.compareDocumentPosition(trace) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // No metric card for non-metric tool
    expect(screen.queryByTestId('metric-card')).not.toBeInTheDocument();
    // Bubble wrapper still present
    expect(bubble).toBeInTheDocument();
  });

  it('assistant with tool-design_metric_framework output-available renders text → MetricCard → TracePanel', () => {
    render(
      <MessageBubble
        role="assistant"
        parts={[
          { type: 'text', text: 'Here is a frame.' },
          {
            type: 'tool-design_metric_framework',
            toolCallId: 'call_mf_1',
            state: 'output-available',
            input: { description: 'thumbs' },
            output: validMetric,
          },
        ]}
      />,
    );
    const text = screen.getByText('Here is a frame.');
    const card = screen.getByTestId('metric-card');
    const trace = screen.getByTestId('trace-call_mf_1');
    // text → card → trace
    expect(text.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card.compareDocumentPosition(trace) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('multiple tool calls render multiple stacked TracePanels', () => {
    render(
      <MessageBubble
        role="assistant"
        parts={[
          { type: 'text', text: 'Here.' },
          {
            type: 'tool-research_company',
            toolCallId: 'call_a',
            state: 'output-available',
            input: { company: 'A' },
            output: { paragraphs: [] },
          },
          {
            type: 'tool-get_case_study',
            toolCallId: 'call_b',
            state: 'output-available',
            input: { slug: 's' },
            output: { kind: 'case_study' },
          },
        ]}
      />,
    );
    expect(screen.getByTestId('trace-call_a')).toBeInTheDocument();
    expect(screen.getByTestId('trace-call_b')).toBeInTheDocument();
  });

  it('design_metric_framework with {error} output renders TracePanel but NOT MetricCard', () => {
    render(
      <MessageBubble
        role="assistant"
        parts={[
          { type: 'text', text: 'I tried.' },
          {
            type: 'tool-design_metric_framework',
            toolCallId: 'call_mf_err',
            state: 'output-available',
            input: { description: 'thumbs' },
            output: { error: 'I hit a snag designing that frame.' },
          },
        ]}
      />,
    );
    expect(screen.getByTestId('trace-call_mf_err')).toBeInTheDocument();
    expect(screen.queryByTestId('metric-card')).not.toBeInTheDocument();
  });

  it('empty assistant parts renders the wrapper but no children content', () => {
    render(<MessageBubble role="assistant" parts={[]} />);
    expect(screen.getByTestId('msg-assistant')).toBeInTheDocument();
    expect(screen.queryByTestId('metric-card')).not.toBeInTheDocument();
    // No trace panels
    const allTestids = document.querySelectorAll('[data-testid^="trace-"]');
    expect(allTestids.length).toBe(0);
  });
});
