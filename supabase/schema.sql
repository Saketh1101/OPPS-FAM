-- ============================================================
-- OTPShare — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- Auto-created when a user signs up via Supabase Auth
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  phone text unique,
  display_name text,
  push_token text,               -- Expo push notification token
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, phone, display_name)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data->>'full_name', new.phone)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- GROUPS
-- ============================================================
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  invite_code char(6) unique not null default upper(substring(gen_random_uuid()::text, 1, 6)),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- GROUP MEMBERS
-- ============================================================
create table public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('admin', 'member')) default 'member',
  joined_at timestamptz default now(),
  unique (group_id, user_id)
);

-- ============================================================
-- OTPS
-- Stores encrypted OTP payloads (never plaintext)
-- Auto-deleted after 10 minutes via pg_cron
-- ============================================================
create table public.otps (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  sender_user_id uuid references public.profiles(id) on delete cascade not null,  -- whose phone got the SMS
  sender_name text not null,       -- e.g. "SBI Bank", "IRCTC"
  encrypted_otp text not null,     -- AES-256 encrypted, never plaintext
  received_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '10 minutes')
);

-- Index for fast group feed queries
create index otps_group_id_idx on public.otps(group_id, received_at desc);

-- ============================================================
-- OTP VIEW LOGS (Activity Log)
-- ============================================================
create table public.otp_views (
  id uuid default gen_random_uuid() primary key,
  otp_id uuid references public.otps(id) on delete cascade not null,
  viewer_id uuid references public.profiles(id) on delete cascade not null,
  viewed_at timestamptz default now()
);

-- ============================================================
-- AUTO-DELETE EXPIRED OTPS
-- Requires pg_cron extension (free on Supabase)
-- Enable via: Dashboard → Database → Extensions → pg_cron
-- ============================================================
-- select cron.schedule(
--   'delete-expired-otps',
--   '* * * * *',   -- every minute
--   $$ delete from public.otps where expires_at < now() $$
-- );
