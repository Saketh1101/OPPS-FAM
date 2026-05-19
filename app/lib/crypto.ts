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

export async function encryptOTP(otp: string, groupId: string): Promise<string> {
  const key = await deriveKey(groupId);
  const textBytes = aesjs.utils.utf8.toBytes(otp.padEnd(16, ' ')); // pad to block size
  const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
  const encrypted = aesCtr.encrypt(textBytes);
  return aesjs.utils.hex.fromBytes(encrypted);
}

export async function decryptOTP(cipherHex: string, groupId: string): Promise<string> {
  const key = await deriveKey(groupId);
  const encryptedBytes = aesjs.utils.hex.toBytes(cipherHex);
  const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
  const decrypted = aesCtr.decrypt(encryptedBytes);
  return aesjs.utils.utf8.fromBytes(decrypted).trim();
}
