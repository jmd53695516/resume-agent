// src/emails/SessionNotification.tsx
// Phase 4 OBSV-08 + D-C-04. Per-session notification template.
// Subject is set by the caller (sendSessionNotification in src/lib/email.ts);
// this file owns the body markup only.
import {
  Body,
  Button,
  Container,
  Heading,
  Hr,
  Html,
  Section,
  Text,
} from '@react-email/components';

export type SessionNotificationProps = {
  session_id: string;
  email: string;
  email_domain: string;
  is_priority: boolean;
  first_message: string;
  classifier_verdict: string;
  classifier_confidence: number | null;
  session_cost_cents: number;
  admin_url: string; // absolute https://host/admin/sessions/<id>
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function SessionNotification({
  session_id,
  email,
  email_domain,
  is_priority,
  first_message,
  classifier_verdict,
  classifier_confidence,
  session_cost_cents,
  admin_url,
}: SessionNotificationProps) {
  const headline = is_priority
    ? `[PRIORITY] New chat from ${email}`
    : `New chat from ${email}`;
  const truncated =
    first_message.length > 600 ? `${first_message.slice(0, 600)}…` : first_message;
  const confidence =
    classifier_confidence !== null ? ` (confidence ${classifier_confidence.toFixed(2)})` : '';

  return (
    <Html>
      <Body
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#f3f1ec',
          padding: '20px',
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '560px',
          }}
        >
          <Heading style={{ fontSize: '18px', margin: '0 0 8px 0' }}>{headline}</Heading>
          <Text style={{ fontSize: '13px', color: '#666', margin: '0 0 16px 0' }}>
            Domain: {email_domain} · Session ID: {session_id}
          </Text>

          <Section style={{ marginBottom: '16px' }}>
            <Text
              style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#888',
                margin: '0 0 4px 0',
              }}
            >
              First message
            </Text>
            <Text style={{ fontSize: '14px', whiteSpace: 'pre-wrap', margin: 0 }}>
              {truncated}
            </Text>
          </Section>

          <Hr style={{ borderColor: '#eee', margin: '16px 0' }} />

          <Section>
            <Text style={{ fontSize: '13px', color: '#666', margin: '0 0 4px 0' }}>
              Classifier: <strong>{classifier_verdict}</strong>
              {confidence}
            </Text>
            <Text style={{ fontSize: '13px', color: '#666', margin: '0 0 16px 0' }}>
              Session cost so far: <strong>{dollars(session_cost_cents)}</strong>
            </Text>
          </Section>

          <Button
            href={admin_url}
            style={{
              backgroundColor: '#2080ff',
              color: '#ffffff',
              padding: '10px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            View transcript
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
