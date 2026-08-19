import crypto from 'crypto';

const GCM_ALGORITHM = 'aes-256-gcm';
const CBC_ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'ALO_POP_SECURE_KEY_DEFAULT_32CHR';

if (process.env.NODE_ENV === 'production' && !process.env.ENCRYPTION_KEY) {
  console.warn('[SECURITY] ENCRYPTION_KEY not set — using default key in production is unsafe');
}

const KEY = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));

export function encryptKey(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

export function decryptKey(encryptedText: string | null): string | null {
  if (!encryptedText) return null;
  try {
    const textParts = encryptedText.split(':');

    if (textParts.length === 3) {
      const iv = Buffer.from(textParts[0], 'hex');
      const authTag = Buffer.from(textParts[1], 'hex');
      const encryptedData = textParts[2];
      const decipher = crypto.createDecipheriv(GCM_ALGORITHM, KEY, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }

    if (textParts.length === 2) {
      const iv = Buffer.from(textParts[0], 'hex');
      const encryptedData = textParts[1];
      const decipher = crypto.createDecipheriv(CBC_ALGORITHM, KEY, iv);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }

    console.warn('[CRYPTO] Legacy plaintext value detected — should be re-encrypted');
    return encryptedText;
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return null;
  }
}
