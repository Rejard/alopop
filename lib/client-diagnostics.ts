'use client';

import type { DiagnosticPayload, SafeDiagnosticMetadata } from '@/lib/diagnostics';

type ClientDiagnosticInput = DiagnosticPayload & {
  metadata?: SafeDiagnosticMetadata;
};

function trimText(value: unknown, maxLength = 220) {
  if (typeof value !== 'string') return undefined;
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, '[redacted-phone]')
    .replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]')
    .replace(/AIza[0-9A-Za-z_-]+/g, '[redacted]')
    .slice(0, maxLength);
}

function safeMetadata(metadata: SafeDiagnosticMetadata | undefined) {
  if (!metadata) return undefined;
  const result: SafeDiagnosticMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') result[key] = trimText(value, 100) || '';
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    else if (typeof value === 'boolean' || value === null) result[key] = value;
  }

  return result;
}

export function reportDiagnostic(input: ClientDiagnosticInput) {
  if (typeof window === 'undefined') return;

  const payload: ClientDiagnosticInput = {
    area: input.area,
    code: input.code,
    severity: input.severity,
    status: input.status,
    safeMessage: trimText(input.safeMessage),
    fingerprint: trimText(input.fingerprint, 80),
    metadata: safeMetadata({
      route: window.location.pathname,
      online: navigator.onLine,
      ...input.metadata,
    }),
  };

  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/diagnostics', blob);
      return;
    }

    void fetch('/api/diagnostics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Diagnostics must never break the app.
  }
}

export async function reportApiFailure({
  area,
  response,
  code,
  metadata,
}: {
  area: ClientDiagnosticInput['area'];
  response: Response;
  code?: ClientDiagnosticInput['code'];
  metadata?: SafeDiagnosticMetadata;
}) {
  reportDiagnostic({
    area,
    code: code || (response.status === 429 ? 'AI_PROVIDER_QUOTA' : response.status === 400 ? 'AI_KEY_NOT_RESOLVED' : 'UNKNOWN_API_ERROR'),
    severity: response.status >= 500 ? 'error' : 'warning',
    status: response.status,
    fingerprint: `${area}:${response.status}`,
    metadata,
  });
}

export function reportCaughtError({
  area,
  error,
  code = 'UNKNOWN_CLIENT_ERROR',
  metadata,
}: {
  area: ClientDiagnosticInput['area'];
  error: unknown;
  code?: ClientDiagnosticInput['code'];
  metadata?: SafeDiagnosticMetadata;
}) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  reportDiagnostic({
    area,
    code,
    severity: 'error',
    safeMessage: message,
    fingerprint: `${area}:${message.slice(0, 80)}`,
    metadata,
  });
}
