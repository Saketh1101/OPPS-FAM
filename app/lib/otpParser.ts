/**
 * Extracts an OTP code from an SMS body.
 * Returns null if the SMS doesn't look like an OTP message.
 */

const OTP_KEYWORDS = [
  'otp',
  'one-time',
  'one time',
  'verification code',
  'verification pin',
  'security code',
  'auth code',
  'login code',
  'passcode',
  'use code',
  'code is',
  'do not share',
  'dont share',
  'never share',
];

const CODE_REGEX = /\b(\d{4,8})\b/g;

export interface ParsedOTP {
  code: string;
  sender: string;
}

export function parseOTP(body: string, sender: string): ParsedOTP | null {
  if (!body) return null;

  const lower = body.toLowerCase();
  const hasKeyword = OTP_KEYWORDS.some((k) => lower.includes(k));
  if (!hasKeyword) return null;

  // Find all 4-8 digit numbers; pick the one most likely to be the code
  const matches = Array.from(body.matchAll(CODE_REGEX)).map((m) => m[1]);
  if (matches.length === 0) return null;

  // Prefer 6-digit codes (most common), then 4, then anything else
  const code =
    matches.find((m) => m.length === 6) ??
    matches.find((m) => m.length === 4) ??
    matches[0];

  return {
    code,
    sender: cleanSender(sender),
  };
}

/**
 * Cleans up sender IDs like "VM-SBIINB" → "SBIINB"
 */
function cleanSender(raw: string): string {
  if (!raw) return 'Unknown';
  // Strip telco prefixes (VM-, AX-, JD-, etc.)
  return raw.replace(/^[A-Z]{2}-/i, '').trim() || raw;
}
