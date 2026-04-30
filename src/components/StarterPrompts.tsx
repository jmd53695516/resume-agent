'use client';

import { Button } from '@/components/ui/button';

type StarterPromptsProps = {
  onSelect: (text: string) => void;
  disabled?: boolean;
};

// CONTEXT D-I-03: three starter-prompt buttons, prefill-not-submit.
// Phase 2 ships these as UX stubs; Phase 3 wires them to real tool invocations.
// The "[my company]" / "[describe your feature]" tokens are editable prefill — the recruiter
// is expected to replace them before sending.
const STARTERS: Array<{ label: string; prefill: string }> = [
  {
    label: 'Pitch me on my company',
    prefill:
      "I'm at [my company]. Pitch me on why you'd fit — weave in something specific about our recent product direction.",
  },
  {
    label: 'Walk me through a project',
    prefill:
      'Walk me through one of your past projects. Pick the one you think best shows how you product-manage.',
  },
  {
    label: 'Design a metric',
    prefill:
      'I want to measure [describe your feature / product / goal]. Design a metric framework — north star, input metrics, counter-metrics, experiment.',
  },
];

export function StarterPrompts({ onSelect, disabled = false }: StarterPromptsProps) {
  return (
    <div
      className="flex w-full max-w-xl flex-col gap-2"
      role="group"
      aria-label="Starter prompts"
      data-testid="starter-prompts"
    >
      <p className="mb-1 text-sm text-muted-foreground">
        Or just ask about Joe&apos;s background. Three ideas to start:
      </p>
      {STARTERS.map((s) => (
        <Button
          key={s.label}
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onSelect(s.prefill)}
          className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
          data-testid={`starter-${s.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}
