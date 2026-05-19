export interface Profile {
  id: string;
  phone: string | null;
  display_name: string | null;
  push_token: string | null;
}

export interface Group {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profiles: Profile;
}

export interface OTP {
  id: string;
  group_id: string;
  sender_user_id: string;
  sender_name: string;
  encrypted_otp: string;
  received_at: string;
  expires_at: string;
  // Decrypted locally, never stored
  otp_code?: string;
  sender_profile?: Profile;
}
