import crypto from 'crypto';

const GCM_ALGORITHM = 'aes-256-gcm';
const CBC_ALGORITHM = 'aes-256-cbc';
const LEGACY_SECRET = 'ALO_POP_SECURE_KEY_DEFAULT_32CHR';
const configuredSecret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || '';
const activeSecret = configuredSecret || LEGACY_SECRET;

if (process.env.NODE_ENV === 'production' && !configuredSecret) {
  console.error('[SECURITY] ENCRYPTION_KEY or SESSION_SECRET must be configured for API key encryption');
}

function modernKey(secret: string) {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function legacyKey(secret: string) {
  return Buffer.from(secret.padEnd(32, '0').slice(0, 32));
}

function uniqueSecrets() {
  return [...new Set([activeSecret, configuredSecret, LEGACY_SECRET].filter(Boolean))];
}

function isHex(value: string, byteLength?: number) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return false;
  return byteLength === undefined || value.length === byteLength * 2;
}

function decryptGcm(ivHex: string, tagHex: string, dataHex: string, key: Buffer) {
  if (!isHex(ivHex) || !isHex(tagHex, 16) || !isHex(dataHex)) return null;
  try {
    const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

function decryptCbc(ivHex: string, dataHex: string, key: Buffer) {
  if (!isHex(ivHex, 16) || !isHex(dataHex)) return null;
  try {
    const decipher = crypto.createDecipheriv(CBC_ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

function isPlausiblePlaintextKey(value: string) {
  return value.length >= 20 && value.length <= 500 && /^[A-Za-z0-9._-]+$/.test(value);
}

export function encryptKey(text: string) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, modernKey(activeSecret), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return ['v2', iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptKey(encryptedText: string | null) {
  if (!encryptedText) return null;
  const parts = encryptedText.split(':');

  if (parts.length === 4 && parts[0] === 'v2') {
    for (const secret of uniqueSecrets()) {
      const decrypted = decryptGcm(parts[1], parts[2], parts[3], modernKey(secret));
      if (decrypted) return decrypted;
    }
    return null;
  }

  if (parts.length === 3) {
    for (const secret of uniqueSecrets()) {
      const decrypted = decryptGcm(parts[0], parts[1], parts[2], legacyKey(secret));
      if (decrypted) return decrypted;
    }
    return null;
  }

  if (parts.length === 2) {
    for (const secret of uniqueSecrets()) {
      const decrypted = decryptCbc(parts[0], parts[1], legacyKey(secret));
      if (decrypted) return decrypted;
    }
    return null;
  }

  return isPlausiblePlaintextKey(encryptedText) ? encryptedText : null;
}

export function isKeyEncryptionConfigured() {
  return Boolean(configuredSecret);
}
