// @vitest-environment jsdom
// tests/components/PlainHtmlFallback.test.tsx
// Plan 03-05 Task 2: PlainHtmlFallback renders bio + Email Joe CTA + 3 roles
// + LinkedIn/GitHub/resume links. Imports ZERO dynamic deps — D-G-03 lock.
// W3: per-file jsdom directive (global env stays 'node').
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/generated/fallback', () => ({
  FALLBACK_BIO: 'Joe is a senior PM with 15 years of experience.',
  FALLBACK_LINKEDIN: 'https://linkedin.com/in/test',
  FALLBACK_GITHUB: 'https://github.com/test',
  FALLBACK_EMAIL: 'joe@example.com',
  FALLBACK_ROLES: [
    { title: 'Senior PM', company: 'Notion', dates: '2024-present' },
    { title: 'PM', company: 'Acme', dates: '2021-2024' },
    { title: 'Analyst', company: 'Foo', dates: '2018-2021' },
  ],
}));

afterEach(() => {
  cleanup();
});

describe('PlainHtmlFallback', () => {
  it('renders bio paragraph from FALLBACK_BIO', async () => {
    const { PlainHtmlFallback } = await import(
      '../../src/components/PlainHtmlFallback'
    );
    render(<PlainHtmlFallback />);
    expect(screen.getByText(/senior PM with 15 years/)).toBeTruthy();
  });

  it('renders Email Joe CTA with mailto href', async () => {
    const { PlainHtmlFallback } = await import(
      '../../src/components/PlainHtmlFallback'
    );
    render(<PlainHtmlFallback />);
    const cta = screen.getByTestId('fallback-email-cta');
    expect(cta.getAttribute('href')).toBe('mailto:joe@example.com');
  });

  it('renders 3 role entries with title + company + dates', async () => {
    const { PlainHtmlFallback } = await import(
      '../../src/components/PlainHtmlFallback'
    );
    render(<PlainHtmlFallback />);
    expect(screen.getByText('Senior PM')).toBeTruthy();
    expect(screen.getByText(/Notion/)).toBeTruthy();
    expect(screen.getByText(/Analyst/)).toBeTruthy();
  });

  it('renders LinkedIn + GitHub + resume PDF links with correct href', async () => {
    const { PlainHtmlFallback } = await import(
      '../../src/components/PlainHtmlFallback'
    );
    render(<PlainHtmlFallback />);
    expect(screen.getByTestId('fallback-linkedin').getAttribute('href')).toBe(
      'https://linkedin.com/in/test',
    );
    expect(screen.getByTestId('fallback-github').getAttribute('href')).toBe(
      'https://github.com/test',
    );
    expect(screen.getByTestId('fallback-resume').getAttribute('href')).toBe(
      '/joe-dollinger-resume.pdf',
    );
  });

  it('wrapper has data-testid plain-html-fallback', async () => {
    const { PlainHtmlFallback } = await import(
      '../../src/components/PlainHtmlFallback'
    );
    render(<PlainHtmlFallback />);
    expect(screen.getByTestId('plain-html-fallback')).toBeTruthy();
  });
});
