# OTPShare — Security Fixes (All Free)

Yes, all the critical security fixes are **free** — they're code changes, not paid services. Here's how to handle each:

---

### 1. Encrypt OTPs before storing (fixes plaintext storage)
Use **AES-256 encryption in the app** before sending to Supabase. The key is derived from the group ID + a secret never stored on the server.

```typescript
// lib/crypto.ts — using expo-crypto (free, built-in)
import * as Crypto from 'expo-crypto';
import * as aesjs from 'aes-js'; // free npm package

async function encryptOTP(otp: string, groupKey: string): Promise<string> {
  const key = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256, groupKey
  );
  // encrypt → store cipher text in DB, not raw OTP
}
```

Supabase only ever sees encrypted blobs — even a DB breach reveals nothing.

---

### 2. Certificate Pinning (fixes MITM)
**Expo's `expo-build-properties`** lets you add network security config for free:

```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<network-security-config>
  <domain-config>
    <domain includeSubdomains="true">your-project.supabase.co</domain>
    <pin-set>
      <pin digest="SHA-256">YOUR_SUPABASE_CERT_HASH</pin>
    </pin-set>
  </domain-config>
</network-security-config>
```

Free, no third-party service needed.

---

### 3. Rate limiting on invite codes (fixes brute force)
Supabase Edge Functions support this natively using a simple in-memory counter or the free `upstash/redis` free tier:

```typescript
// supabase/functions/join-group/index.ts
const attempts = await redis.incr(`join_attempts:${ip}`);
if (attempts > 5) {
  return new Response("Too many attempts", { status: 429 });
}
await redis.expire(`join_attempts:${ip}`, 300); // reset after 5 min
```

Upstash Redis free tier = 10,000 requests/day, enough for MVP.

---

### 4. Fix notification privacy (1 line change)
```typescript
// Don't do this:
title: `OTP: ${otp_code}`

// Do this instead:
title: "New OTP received",
body: "Tap to view" // OTP only shown inside the app
```

---

### 5. Drop `full_message` storage (fixes unnecessary data retention)
Just don't insert it. Store only the extracted OTP code and sender name — nothing else.

---

### Summary — All Free

| Fix | Tool/Cost |
|---|---|
| OTP encryption | `aes-js` + `expo-crypto` — free npm |
| Cert pinning | Android network security config — free |
| Rate limiting | Upstash Redis free tier |
| Notification privacy | Code change — free |
| Drop full SMS storage | Remove a DB column — free |
