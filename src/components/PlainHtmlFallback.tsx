// src/components/PlainHtmlFallback.tsx
// OBSV-12 / D-G-01..04. Static minimal fallback: bio + last 3 roles + LinkedIn/
// GitHub/resume links + Email Joe CTA. Imports ONLY build-time constants from
// src/generated/fallback.ts — D-G-03 no dynamic deps (no Supabase, Redis,
// Anthropic, fetch, kb-loader). The whole point is that this surface keeps
// working when everything else is down.
import {
  FALLBACK_BIO,
  FALLBACK_LINKEDIN,
  FALLBACK_GITHUB,
  FALLBACK_EMAIL,
  FALLBACK_ROLES,
} from '@/generated/fallback';

export function PlainHtmlFallback() {
  return (
    <main
      className="mx-auto max-w-xl px-6 py-12"
      data-testid="plain-html-fallback"
    >
      <h1 className="text-2xl font-semibold">Joe Dollinger</h1>
      <p className="mt-4 text-base leading-relaxed">{FALLBACK_BIO}</p>

      <p className="mt-6 text-sm text-muted-foreground">
        The interactive agent is briefly offline. Email me directly:
      </p>
      <a
        href={`mailto:${FALLBACK_EMAIL}`}
        className="mt-2 inline-block rounded bg-primary px-4 py-2 text-primary-foreground"
        data-testid="fallback-email-cta"
      >
        Email Joe
      </a>

      {FALLBACK_ROLES.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Experience
          </h2>
          <ul className="mt-2 space-y-2 text-sm">
            {FALLBACK_ROLES.map((r, i) => (
              <li key={i}>
                <span className="font-medium">{r.title}</span>
                {r.company ? <> — {r.company}</> : null}
                {r.dates ? (
                  <span className="text-muted-foreground"> · {r.dates}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="mt-8 space-y-2 text-sm">
        {FALLBACK_LINKEDIN && (
          <li>
            <a
              href={FALLBACK_LINKEDIN}
              className="underline"
              data-testid="fallback-linkedin"
            >
              LinkedIn
            </a>
          </li>
        )}
        {FALLBACK_GITHUB && (
          <li>
            <a
              href={FALLBACK_GITHUB}
              className="underline"
              data-testid="fallback-github"
            >
              GitHub
            </a>
          </li>
        )}
        <li>
          <a
            href="/joe-dollinger-resume.pdf"
            className="underline"
            data-testid="fallback-resume"
          >
            Résumé (PDF)
          </a>
        </li>
      </ul>
    </main>
  );
}
