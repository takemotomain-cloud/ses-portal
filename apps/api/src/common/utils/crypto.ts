import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function encrypt(plaintext: string, key: string): string | null {
  if (!plaintext) return null;
  const keyBuf = Buffer.from(key, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encrypted: string, key: string): string | null {
  if (!encrypted) return null;
  try {
    const [ivHex, authTagHex, ciphertextHex] = encrypted.split(':');
    if (!ivHex || !authTagHex || !ciphertextHex) return null;
    const keyBuf = Buffer.from(key, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuf, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}
