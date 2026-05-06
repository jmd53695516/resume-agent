// @vitest-environment jsdom
// tests/components/error-boundary.test.tsx
// Plan 03-05 Task 3: src/app/error.tsx is the belt-and-suspenders surface for
// render-time exceptions. Renders the same PlainHtmlFallback content the
// page.tsx branched-render path renders for OBSV-12 triggers — but error.tsx
// is the catch-all for unexpected exceptions (e.g., kb file unreadable).
// W3: per-file jsdom directive (global env stays 'node').
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/generated/fallback', () => ({
  FALLBACK_BIO: 'bio',
  FALLBACK_LINKEDIN: 'l',
  FALLBACK_GITHUB: 'g',
  FALLBACK_EMAIL: 'e@x.com',
  FALLBACK_ROLES: [],
}));

afterEach(() => {
  cleanup();
});

describe('error.tsx ErrorBoundary', () => {
  it('renders PlainHtmlFallback when invoked', async () => {
    const ErrorBoundary = (await import('../../src/app/error')).default;
    render(
      <ErrorBoundary error={new Error('test')} reset={() => {}} />,
    );
    expect(screen.getByTestId('plain-html-fallback')).toBeTruthy();
  });

  it('renders the Email Joe CTA via the fallback content', async () => {
    const ErrorBoundary = (await import('../../src/app/error')).default;
    render(
      <ErrorBoundary error={new Error('test')} reset={() => {}} />,
    );
    expect(screen.getByTestId('fallback-email-cta').getAttribute('href')).toBe(
      'mailto:e@x.com',
    );
  });
});
