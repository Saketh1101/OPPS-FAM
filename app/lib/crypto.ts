import * as Crypto from 'expo-crypto';
import * as aesjs from 'aes-js';

/**
 * Derives a 32-byte AES key from the group ID using SHA-256.
 * The key never leaves the device — Supabase only stores cipher text.
 */
async function deriveKey(groupId: string): Promise<Uint8Array> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `otpshare:${groupId}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  // Convert hex string to byte array
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

const IV_BYTES = 16; // AES block size — also used as the CTR initial counter value

export async function encryptOTP(otp: string, groupId: string): Promise<string> {
  const key = await deriveKey(groupId);
  const iv = await Crypto.getRandomBytesAsync(IV_BYTES); // fresh per message — CTR mode must never reuse a counter under the same key
  const textBytes = aesjs.utils.utf8.toBytes(otp.padEnd(16, ' ')); // pad to block size
  const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
  const encrypted = aesCtr.encrypt(textBytes);

  // Prepend the IV so decryptOTP can recover it — it isn't secret, only the key is.
  const combined = new Uint8Array(iv.length + encrypted.length);
  combined.set(iv, 0);
  combined.set(encrypted, iv.length);
  return aesjs.utils.hex.fromBytes(combined);
}

export async function decryptOTP(cipherHex: string, groupId: string): Promise<string> {
  const key = await deriveKey(groupId);
  const combined = aesjs.utils.hex.toBytes(cipherHex);
  const iv = combined.slice(0, IV_BYTES);
  const encryptedBytes = combined.slice(IV_BYTES);
  const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
  const decrypted = aesCtr.decrypt(encryptedBytes);
  return aesjs.utils.utf8.fromBytes(decrypted).trim();
}
