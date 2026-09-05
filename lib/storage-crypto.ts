/**
 * Storage Encryption at Rest Utility for Mnemósyne Reflection Journal
 * Uses native Web Crypto API (SubtleCrypto AES-GCM 256-bit)
 */

const ENCRYPTION_PREFIX = '__mn_enc_v1__:';
const SALT = '_mnemosyne_intimate_journal_salt_2026_';

function getCrypto(): Crypto | null {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto;
  }
  return null;
}

async function deriveKey(userId: string): Promise<CryptoKey | null> {
  const cryptoObj = getCrypto();
  if (!cryptoObj || !cryptoObj.subtle) {
    return null;
  }
  try {
    const encoder = new TextEncoder();
    const keyMaterial = encoder.encode(userId + SALT);
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', keyMaterial);
    return await cryptoObj.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (err) {
    console.warn('Crypto key derivation failed:', err);
    return null;
  }
}

/**
 * Encrypts a plain-text serialized string using AES-GCM 256-bit.
 * Returns a prefixed payload containing the initialization vector (IV) and ciphertext.
 */
export async function encryptLocalData(plainText: string, userId: string): Promise<string> {
  if (!plainText) return plainText;
  try {
    const cryptoObj = getCrypto();
    const key = await deriveKey(userId);
    if (!key || !cryptoObj) {
      return plainText; // Fallback if crypto is unavailable
    }

    const iv = cryptoObj.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(plainText);
    const cipherBuffer = await cryptoObj.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );

    const payload = {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(cipherBuffer)),
    };

    return ENCRYPTION_PREFIX + JSON.stringify(payload);
  } catch (e) {
    console.warn('Failed to encrypt local storage data, storing plaintext fallback:', e);
    return plainText;
  }
}

/**
 * Decrypts a stored payload. If the string is legacy plaintext (unencrypted),
 * it returns the string immediately for backwards compatibility.
 */
export async function decryptLocalData(storedText: string, userId: string): Promise<string> {
  if (!storedText) return storedText;

  // If not encrypted with our prefix, return plaintext directly
  if (!storedText.startsWith(ENCRYPTION_PREFIX)) {
    return storedText;
  }

  try {
    const cryptoObj = getCrypto();
    const key = await deriveKey(userId);
    if (!key || !cryptoObj) {
      return storedText;
    }

    const jsonStr = storedText.slice(ENCRYPTION_PREFIX.length);
    const { iv, data } = JSON.parse(jsonStr);

    const decryptedBuffer = await cryptoObj.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(data)
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (e) {
    console.warn('Failed to decrypt local storage data:', e);
    return storedText;
  }
}
