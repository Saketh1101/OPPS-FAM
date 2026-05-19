# 📱 OTPShare — Family OTP Sharing App
## Full Project Context for LLM-Assisted Development

---

## 🧠 The Problem

In Indian families, multiple people share the same phone number for bank accounts, government portals (Aadhaar, DigiLocker, IRCTC, etc.), and other services. Every time an OTP is needed, someone has to call or message the person whose phone received it — this is slow, annoying, and sometimes not possible (e.g., the person is busy, unreachable, or asleep).

**The goal:** Build an app where OTPs received on one phone are automatically and instantly visible to trusted family members — no calls, no WhatsApp forwarding, no manual copying.

---

## 🎯 App Name
**OTPShare** (working title)

---

## 👥 Target Users
- Indian families with 2–6 members sharing accounts
- Joint families, PG roommates, business partners
- Anyone who needs to share OTPs frequently with trusted people

---

## ✅ Core Features (MVP)

### 1. Family Group
- User creates a "Family Group" and invites members via a 6-digit invite code or link
- Max 6 members per group (free tier)
- Each group has a name (e.g., "Sharma Family")

### 2. OTP Forwarding (Android)
- Android foreground service reads incoming SMS
- Filters messages containing keywords: "OTP", "one-time", "verification code", "use", "expire"
- Forwards extracted OTP + sender name + timestamp to the backend in real time
- iOS: Manual copy-paste mode (due to iOS SMS restrictions)

### 3. Real-time OTP Feed
- All group members see a live feed of incoming OTPs
- Each OTP card shows:
  - Sender (e.g., "SBI Bank", "IRCTC", "Zomato")
  - The OTP code (large, bold, easy to read)
  - Which family member's phone received it
  - Time received + auto-expiry countdown (usually 30–120 seconds)
  - One-tap copy button
- OTPs disappear after 10 minutes (privacy)

### 4. Notifications
- Push notification to all group members when a new OTP arrives
- Notification shows OTP directly (no need to open app)
- Silent mode option (no sound, just banner)

### 5. Auth
- Phone number + OTP login (ironic, but standard)
- Google Sign-In as alternative
- No passwords required

### 6. Privacy & Security
- OTPs are end-to-end encrypted in transit (HTTPS + encryption at rest)
- OTPs are auto-deleted from server after 10 minutes
- Users can leave a group or kick members
- Activity log: see who viewed which OTP

---

## 🚫 Out of Scope (MVP)
- iOS automatic SMS reading (Apple doesn't allow it)
- Multiple groups per user
- OTP history beyond 10 minutes
- Monetization / premium tier
- Web dashboard

---

## 🛠️ Tech Stack (All Free Tier)

### Frontend (Mobile App)
- **Framework:** React Native (Expo)
- **Why:** Single codebase for Android + iOS, free to build, large community
- **UI Library:** NativeWind (Tailwind for React Native)
- **State Management:** Zustand
- **Real-time:** Supabase Realtime (websockets)
- **Notifications:** Expo Push Notifications

### Backend
- **Platform:** Supabase (free tier)
  - PostgreSQL database
  - Auth (phone OTP + Google)
  - Realtime subscriptions
  - Row Level Security (RLS) for data privacy
  - Edge Functions (Deno) for server logic

### SMS Reading (Android Only)
- **Library:** `expo-sms` + `react-native-receive-sms` or a custom native module
- Runs as a background/foreground service on Android
- Requires `RECEIVE_SMS` permission

### Hosting / Deployment
- **Backend:** Supabase (free, hosted)
- **App Distribution:** Expo Go (development), EAS Build (production APK — free tier)

---

## 🗄️ Database Schema

### `users`
```
id          uuid (PK, from Supabase Auth)
phone       text
name        text
avatar_url  text
created_at  timestamp
```

### `groups`
```
id          uuid (PK)
name        text
invite_code text (unique, 6-char)
created_by  uuid (FK → users.id)
created_at  timestamp
```

### `group_members`
```
id          uuid (PK)
group_id    uuid (FK → groups.id)
user_id     uuid (FK → users.id)
role        text ('admin' | 'member')
joined_at   timestamp
```

### `otps`
```
id            uuid (PK)
group_id      uuid (FK → groups.id)
received_by   uuid (FK → users.id)  -- whose phone got the SMS
sender        text                   -- e.g. "SBI-OTP", "IRCTC"
otp_code      text                   -- the extracted OTP number
full_message  text                   -- original SMS (optional, privacy toggle)
received_at   timestamp
expires_at    timestamp              -- received_at + 10 minutes
```

### `activity_log`
```
id         uuid (PK)
otp_id     uuid (FK → otps.id)
user_id    uuid (FK → users.id)
action     text ('viewed' | 'copied')
created_at timestamp
```

---

## 🔒 Security Rules (Supabase RLS)

- Users can only read `otps` where they are a member of the `group_id`
- Users can only insert `otps` for groups they belong to
- OTPs older than 10 minutes are excluded from all queries (using `expires_at < now()`)
- Only group admins can remove members
- Invite codes expire after 24 hours if unused

---

## 📱 App Screens

### 1. Onboarding
- Welcome screen
- Phone number input → OTP verification
- OR Google Sign-In
- Set display name + profile photo (optional)

### 2. Home Screen
- Shows current group name
- Live OTP feed (real-time updates via websocket)
- Each OTP card: sender, code, device, time, copy button, countdown timer
- Empty state: "Waiting for OTPs..." with animation

### 3. Group Screen
- Group name + invite code (with share button)
- List of members (name, phone, online status)
- Leave group button
- Admin: remove member, regenerate invite code

### 4. Join Group Screen
- Enter 6-digit invite code
- OR tap a shared link

### 5. Settings Screen
- Notification preferences
- SMS permission status (enable/disable)
- Privacy toggle (show/hide full SMS body)
- App version, logout

---

## 🔄 Core Data Flow

```
[Family Member's Android Phone]
        ↓ SMS received
[Background SMS Listener Service]
        ↓ Extracts OTP using regex
[API call to Supabase Edge Function]
        ↓ Validates user + group membership
[Inserts into `otps` table]
        ↓ Supabase Realtime broadcasts to group
[All group members' apps receive websocket event]
        ↓ OTP card appears in feed instantly
[Push notification sent via Expo Push]
        ↓
[Members see OTP without calling anyone ✅]
```

---

## 🧩 OTP Extraction Logic

Use this regex to extract OTP from SMS:

```javascript
// Matches 4–8 digit OTP codes
const OTP_REGEX = /\b(\d{4,8})\b/;

// Common OTP SMS patterns to detect
const OTP_KEYWORDS = [
  "otp", "one-time", "one time", "verification code",
  "is your", "use", "valid for", "expires in", "do not share"
];

function extractOTP(smsBody) {
  const lower = smsBody.toLowerCase();
  const isOTPMessage = OTP_KEYWORDS.some(k => lower.includes(k));
  if (!isOTPMessage) return null;
  const match = smsBody.match(OTP_REGEX);
  return match ? match[1] : null;
}
```

---

## 🎨 Design Guidelines

- **Theme:** Clean, minimal, trust-inspiring (like a banking app, not flashy)
- **Primary Color:** Deep blue (`#1E3A8A`) — conveys security
- **Accent:** Amber (`#F59E0B`) — for OTP codes (urgent, readable)
- **Font:** System font (fast load, familiar)
- **OTP Code Display:** Large monospace font, high contrast, easy to read at a glance
- **Animations:** Subtle fade-in for new OTP cards, countdown ring animation

---

## 📦 Folder Structure

```
otpshare/
├── app/                        # Expo Router screens
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── verify.tsx
│   ├── (app)/
│   │   ├── index.tsx           # Home / OTP Feed
│   │   ├── group.tsx           # Group management
│   │   ├── join.tsx            # Join group
│   │   └── settings.tsx
│   └── _layout.tsx
├── components/
│   ├── OTPCard.tsx             # Individual OTP display card
│   ├── CountdownTimer.tsx      # Expiry countdown
│   ├── MemberAvatar.tsx
│   └── EmptyFeed.tsx
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── smsParser.ts            # OTP extraction logic
│   ├── notifications.ts        # Push notification helpers
│   └── store.ts                # Zustand state store
├── supabase/
│   ├── migrations/             # DB schema files
│   └── functions/
│       └── forward-otp/        # Edge function
│           └── index.ts
├── assets/
├── app.json
├── package.json
└── CONTEXT.md                  # ← This file
```

---

## 🚀 Development Phases

### Phase 1 — Foundation (Week 1)
- [ ] Set up Expo project + Supabase
- [ ] Phone auth + Google login
- [ ] Create/join group flow
- [ ] Database schema + RLS policies

### Phase 2 — Core Feature (Week 2)
- [ ] Android SMS listener service
- [ ] OTP extraction + forwarding to Supabase
- [ ] Real-time OTP feed with websockets
- [ ] OTP card UI with copy + countdown

### Phase 3 — Polish (Week 3)
- [ ] Push notifications
- [ ] Activity log
- [ ] Settings screen
- [ ] Auto-delete expired OTPs (cron job via Supabase)

### Phase 4 — Ship (Week 4)
- [ ] Test on real Android devices
- [ ] EAS Build → generate APK
- [ ] Share with family for beta testing
- [ ] Bug fixes

---

## ⚠️ Known Challenges

| Challenge | Solution |
|---|---|
| iOS SMS restriction | Manual copy-paste mode for iOS users |
| Battery optimization killing background service | Guide users to whitelist app in battery settings |
| False positive OTP detection | Tune regex + keyword list; allow manual dismiss |
| Privacy concerns | Encrypt OTPs, auto-delete after 10 min, no logs |
| Multiple groups per number | Limit to 1 group in MVP |

---

## 💬 Key Prompts to Use When Vibe Coding

When asking an LLM to help you build a specific part, use these prompts:

- **Auth:** *"Build phone number OTP login screen in React Native Expo using Supabase Auth"*
- **SMS Listener:** *"Create an Android foreground service in Expo that listens for incoming SMS and extracts OTP using regex"*
- **Real-time Feed:** *"Build a real-time OTP feed in React Native using Supabase Realtime websockets, showing OTP cards with countdown timers"*
- **Group Flow:** *"Build create group + join group by invite code flow in React Native with Supabase"*
- **Push Notifications:** *"Set up Expo Push Notifications to send alerts to all group members when a new OTP row is inserted in Supabase"*

---

*This file is the single source of truth for the OTPShare project. Share this with any AI coding assistant before starting a new session.*
