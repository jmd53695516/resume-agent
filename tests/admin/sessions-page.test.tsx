// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SessionsTable, type SessionRow } from '@/app/admin/components/SessionsTable';

afterEach(cleanup);

const rows: SessionRow[] = [
  {
    id: 'sess-1',
    email: 'recruiter@acmecorp.com',
    email_domain: 'acmecorp.com',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    flagged: false,
    total_cost_cents: 14,
    turn_count: 3,
  },
  {
    id: 'sess-2',
    email: 'jane@gmail.com',
    email_domain: 'gmail.com',
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    flagged: true,
    total_cost_cents: 312,
    turn_count: 12,
  },
];

describe('SessionsTable', () => {
  it('renders empty state when no sessions', () => {
    render(<SessionsTable sessions={[]} sort="created_at" dir="desc" />);
    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
  });

  it('renders rows with cost in dollars', () => {
    render(<SessionsTable sessions={rows} sort="created_at" dir="desc" />);
    expect(screen.getByText('$0.14')).toBeInTheDocument();
    expect(screen.getByText('$3.12')).toBeInTheDocument();
  });

  it('shows PRIORITY badge for non-free-mail domain', () => {
    render(<SessionsTable sessions={rows} sort="created_at" dir="desc" />);
    expect(screen.getByText('PRIORITY')).toBeInTheDocument();
  });

  it('shows flagged badge for flagged session', () => {
    render(<SessionsTable sessions={rows} sort="created_at" dir="desc" />);
    expect(screen.getByText('flagged')).toBeInTheDocument();
  });

  it('does NOT show PRIORITY for gmail.com', () => {
    const onlyGmail = [rows[1]]; // gmail.com
    render(<SessionsTable sessions={onlyGmail} sort="created_at" dir="desc" />);
    expect(screen.queryByText('PRIORITY')).not.toBeInTheDocument();
  });

  it('marks active sort column with font-semibold', () => {
    const { container } = render(
      <SessionsTable sessions={rows} sort="email_domain" dir="asc" />,
    );
    const headers = container.querySelectorAll('thead th');
    const domainHeader = Array.from(headers).find((th) =>
      th.textContent?.includes('Domain'),
    );
    expect(domainHeader).toBeTruthy();
    expect(domainHeader?.className).toContain('font-semibold');
  });
});
