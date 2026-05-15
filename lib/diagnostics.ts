export const DIAGNOSTIC_AREAS = [
  'auth',
  'login_google',
  'ai_analysis',
  'ai_friend_reply',
  'socket',
  'room',
  'upload',
  'wallet',
  'client_runtime',
  'network',
  'unknown',
] as const;

export const DIAGNOSTIC_CODES = [
  'AUTH_SESSION_MISSING',
  'AUTH_SESSION_INVALID',
  'LOGIN_GOOGLE_FAILED',
  'AI_KEY_NOT_RESOLVED',
  'AI_PROVIDER_QUOTA',
  'AI_PROVIDER_TIMEOUT',
  'AI_PROVIDER_ERROR',
  'AI_RESPONSE_EMPTY',
  'FREE_EVENT_LIMIT_EXCEEDED',
  'FREE_EVENT_FALLBACK_APPLIED',
  'SOCKET_CONNECT_FAILED',
  'SOCKET_SEND_REJECTED',
  'SOCKET_ROOM_JOIN_FORBIDDEN',
  'UPLOAD_FILE_TOO_LARGE',
  'UPLOAD_UNSUPPORTED_TYPE',
  'UPLOAD_FAILED',
  'WALLET_INSUFFICIENT_FUNDS',
  'CLIENT_UNHANDLED_REJECTION',
  'CLIENT_RUNTIME_ERROR',
  'CLIENT_API_ERROR',
  'NETWORK_REQUEST_FAILED',
  'UNKNOWN_CLIENT_ERROR',
  'UNKNOWN_API_ERROR',
] as const;

export const DIAGNOSTIC_SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;

export type DiagnosticArea = typeof DIAGNOSTIC_AREAS[number];
export type DiagnosticCode = typeof DIAGNOSTIC_CODES[number];
export type DiagnosticSeverity = typeof DIAGNOSTIC_SEVERITIES[number];

export type SafeDiagnosticMetadata = Record<string, string | number | boolean | null>;

export type DiagnosticPayload = {
  area: DiagnosticArea;
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  status?: number;
  safeMessage?: string;
  fingerprint?: string;
  metadata?: SafeDiagnosticMetadata;
};

const SENSITIVE_KEY_PATTERN = /(content|message|prompt|email|google|api.?key|token|secret|password|invite|roomName|friendName|fileName|stack)/i;

export function sanitizeDiagnosticText(value: unknown, maxLength = 240) {
  if (typeof value !== 'string') return undefined;
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, '[redacted-phone]')
    .replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]')
    .replace(/AIza[0-9A-Za-z_-]+/g, '[redacted]')
    .slice(0, maxLength);
}

export function sanitizeDiagnosticMetadata(metadata: unknown): SafeDiagnosticMetadata {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};

  const safe: SafeDiagnosticMetadata = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;

    if (typeof value === 'string') {
      safe[key] = sanitizeDiagnosticText(value, 120) || '';
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      safe[key] = value;
    } else if (typeof value === 'boolean' || value === null) {
      safe[key] = value;
    }
  }

  return safe;
}
