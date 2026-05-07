// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TracePanel, type ToolPart } from '@/components/TracePanel';

afterEach(cleanup);

const part: ToolPart = {
  type: 'tool-research_company',
  toolCallId: 'call-1',
  state: 'output-available',
  input: { name: 'Acme' },
  output: { summary: 'ok' },
};

describe('TracePanel admin variant', () => {
  it('default (chat) renders collapsed and shows "See what I did"', () => {
    render(<TracePanel part={part} />);
    const details = screen.getByTestId('trace-call-1');
    expect(details).toHaveAttribute('data-variant', 'chat');
    expect(details).not.toHaveAttribute('open');
    expect(details.textContent).toContain('See what I did');
  });

  it('alwaysExpanded={true} renders open and shows "Tool trace"', () => {
    render(<TracePanel part={part} alwaysExpanded={true} />);
    const details = screen.getByTestId('trace-call-1');
    expect(details).toHaveAttribute('data-variant', 'admin');
    expect(details).toHaveAttribute('open');
    expect(details.textContent).toContain('Tool trace');
    expect(details.textContent).not.toContain('See what I did');
  });

  it('alwaysExpanded={true} hides the chevron icon', () => {
    const { container } = render(<TracePanel part={part} alwaysExpanded={true} />);
    // ChevronRight + ChevronDown render as svg; admin variant should have none.
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });

  it('streaming state still renders streaming line in admin variant', () => {
    const streaming: ToolPart = { ...part, state: 'input-streaming', output: undefined };
    render(<TracePanel part={streaming} alwaysExpanded={true} />);
    const el = screen.getByTestId('trace-streaming-call-1');
    expect(el).toHaveAttribute('data-variant', 'admin');
  });
});
