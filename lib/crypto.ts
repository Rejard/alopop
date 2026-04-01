import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
// 실제 프로덕션에서는 .env 등에서 주입받아야 합니다.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'ALO_POP_SECURE_KEY_DEFAULT_32CHR';

// 32바이트 키 고정
const KEY = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));

export function encryptKey(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptKey(encryptedText: string | null): string | null {
  if (!encryptedText) return null;
  try {
    const textParts = encryptedText.split(':');
    if (textParts.length !== 2) return encryptedText; // Legacy plaintext fallback
    
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedData = textParts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return null; // Decryption failed
  }
}
