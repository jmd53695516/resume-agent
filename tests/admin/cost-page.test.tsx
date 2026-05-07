// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CostCard, type CostWindowData } from '@/app/admin/components/CostCard';

afterEach(cleanup);

function makeData(overrides: Partial<CostWindowData> = {}): CostWindowData {
  return {
    window: '24h',
    total_cents: 1432,
    request_count: 438,
    per_tool: [
      { tool_name: 'research_company', cost_cents: 812 },
      { tool_name: 'get_case_study', cost_cents: 344 },
      { tool_name: '(no tool)', cost_cents: 86 },
    ],
    cache_read_tokens: 87400,
    input_tokens: 12600,
    ...overrides,
  };
}

describe('CostCard', () => {
  it('renders dollar total and request count', () => {
    render(<CostCard data={makeData()} />);
    expect(screen.getByTestId('cost-total-24h').textContent).toBe('$14.32');
    expect(screen.getByText('438 requests')).toBeInTheDocument();
  });

  it('renders zero-spend empty state', () => {
    render(<CostCard data={makeData({ total_cents: 0, request_count: 0, per_tool: [] })} />);
    expect(screen.getByText('No requests in this window.')).toBeInTheDocument();
  });

  it('renders cache hit rate >=80% as green', () => {
    // 87400 / (87400 + 12600) = 87.4%
    const { getByTestId } = render(<CostCard data={makeData()} />);
    const el = getByTestId('cost-cache-24h');
    expect(el.className).toContain('text-green-700');
    expect(el.textContent).toContain('87.4%');
  });

  it('renders cache hit rate 60-79% as amber', () => {
    // 70 / (70 + 30) = 70%
    const data = makeData({ cache_read_tokens: 70, input_tokens: 30 });
    const { getByTestId } = render(<CostCard data={data} />);
    expect(getByTestId('cost-cache-24h').className).toContain('text-amber-700');
  });

  it('renders cache hit rate <60% as red', () => {
    const data = makeData({ cache_read_tokens: 50, input_tokens: 50 }); // 50%
    const { getByTestId } = render(<CostCard data={data} />);
    expect(getByTestId('cost-cache-24h').className).toContain('text-red-700');
  });

  it('renders per-tool breakdown sorted desc', () => {
    const { container } = render(<CostCard data={makeData()} />);
    const items = container.querySelectorAll('ul li');
    expect(items[0].textContent).toContain('research_company');
    expect(items[0].textContent).toContain('$8.12');
    expect(items[1].textContent).toContain('get_case_study');
  });
});
