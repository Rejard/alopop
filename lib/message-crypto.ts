import * as crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;

function getEncryptionKey(): Buffer {
  const internalApiSecret =
    process.env.INTERNAL_API_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.ENCRYPTION_KEY ||
    '';
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    internalApiSecret ||
    'ALO_POP_ENCRYPTION_SECRET_DEFAULT';
  return crypto
    .createHash('sha256')
    .update(String(secret))
    .digest()
    .subarray(0, KEY_LEN);
}

export function decryptMessageContent(payload: string): string {
  if (!payload) return '';
  if (!payload.startsWith('v1:')) return payload;
  const [version, ivB64, tagB64, encryptedB64] = payload.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !encryptedB64) return payload;
  try {
    const decipher = crypto.createDecipheriv(
      ALGO,
      getEncryptionKey(),
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return '[Encrypted message cannot be read]';
  }
}
