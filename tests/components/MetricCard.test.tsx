// @vitest-environment jsdom
// tests/components/MetricCard.test.tsx
// Plan 03-03 Task 2 (TOOL-06 / D-D-04): renders design_metric_framework output
// as a single inline shadcn Card with section headers. Defensive type guard
// rejects {error}, missing-field, and null payloads (returns null).
// W3: per-file jsdom directive; global env stays 'node'.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MetricCard, type MetricFramework } from '../../src/components/MetricCard';

afterEach(() => {
  cleanup();
});

const validMetric: MetricFramework = {
  north_star: 'Weekly active recruiters who finish a chat session',
  input_metrics: [
    'Sessions started per day',
    'Median session duration',
    'Tool-call adoption rate',
  ],
  counter_metrics: [
    'Bounce rate within 30s',
    'Repeat email-gate hits',
  ],
  guardrails: [
    'Daily spend cap not exceeded',
    'Refusal rate < 5%',
  ],
  proposed_experiment: 'A/B test starter prompt copy variants over 14 days',
  open_questions: [
    'How do we attribute downstream interview requests?',
    'What is the right cohort cut for new vs. returning recruiters?',
  ],
};

describe('MetricCard', () => {
  it('renders all six section labels for valid MetricFramework data', () => {
    render(<MetricCard data={validMetric} />);
    expect(screen.getByText('North Star')).toBeInTheDocument();
    expect(screen.getByText('Input Metrics')).toBeInTheDocument();
    expect(screen.getByText('Counter-Metrics')).toBeInTheDocument();
    expect(screen.getByText('Guardrails')).toBeInTheDocument();
    expect(screen.getByText('Proposed Experiment')).toBeInTheDocument();
    expect(screen.getByText('Open Questions')).toBeInTheDocument();
  });

  it('renders array fields as <ul> with <li> items', () => {
    const { container } = render(<MetricCard data={validMetric} />);
    // Three array fields × n items = several <li>
    const lis = container.querySelectorAll('li');
    // input_metrics(3) + counter_metrics(2) + guardrails(2) + open_questions(2) = 9
    expect(lis.length).toBe(9);
    expect(screen.getByText('Sessions started per day')).toBeInTheDocument();
    expect(screen.getByText('Bounce rate within 30s')).toBeInTheDocument();
  });

  it('renders scalar fields (north_star, proposed_experiment) as <p>', () => {
    render(<MetricCard data={validMetric} />);
    const ns = screen.getByText(validMetric.north_star);
    expect(ns.tagName).toBe('P');
    const exp = screen.getByText(validMetric.proposed_experiment);
    expect(exp.tagName).toBe('P');
  });

  it('returns null for {error} payload', () => {
    const { container } = render(
      <MetricCard data={{ error: 'Tool failed' }} />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('metric-card')).not.toBeInTheDocument();
  });

  it('returns null for missing-field payload (defensive type guard)', () => {
    const { container } = render(
      <MetricCard data={{ north_star: 'only this field' }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null for null payload', () => {
    const { container } = render(<MetricCard data={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for non-object payload', () => {
    const { container } = render(<MetricCard data={'a string'} />);
    expect(container.firstChild).toBeNull();
  });

  it('rendered wrapper has data-testid metric-card', () => {
    render(<MetricCard data={validMetric} />);
    expect(screen.getByTestId('metric-card')).toBeInTheDocument();
  });
});
