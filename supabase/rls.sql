-- ============================================================
-- OTPShare — Row Level Security Policies
-- Run this AFTER schema.sql in Supabase SQL Editor.
-- Idempotent: safe to re-run (drops policies before recreating).
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.otps enable row level security;
alter table public.otp_views enable row level security;

-- ============================================================
-- MEMBERSHIP HELPERS (SECURITY DEFINER)
-- These run with the definer's rights, bypassing RLS on the
-- tables they read. That is what breaks the infinite recursion:
-- a policy ON group_members can call these WITHOUT re-triggering
-- the group_members policy. Keep search_path pinned for safety.
-- ============================================================

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.can_see_otp(oid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.otps o
    join public.group_members gm on gm.group_id = o.group_id
    where o.id = oid and gm.user_id = auth.uid()
  );
$$;

grant execute on function public.is_group_member(uuid) to authenticated, anon;
grant execute on function public.is_group_admin(uuid) to authenticated, anon;
grant execute on function public.can_see_otp(uuid) to authenticated, anon;

-- ============================================================
-- PROFILES
-- ============================================================
drop policy if exists "profiles: read any" on public.profiles;
create policy "profiles: read any"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================
-- GROUPS
-- ============================================================
drop policy if exists "groups: read if member" on public.groups;
create policy "groups: read if member"
  on public.groups for select
  using (public.is_group_member(id));

drop policy if exists "groups: create" on public.groups;
create policy "groups: create"
  on public.groups for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "groups: update if admin" on public.groups;
create policy "groups: update if admin"
  on public.groups for update
  using (public.is_group_admin(id));

drop policy if exists "groups: delete if admin" on public.groups;
create policy "groups: delete if admin"
  on public.groups for delete
  using (public.is_group_admin(id));

-- ============================================================
-- GROUP MEMBERS
-- ============================================================
-- Read via the SECURITY DEFINER helper so the policy does NOT
-- re-query group_members under RLS (the original recursion bug).
drop policy if exists "group_members: read if in group" on public.group_members;
create policy "group_members: read if in group"
  on public.group_members for select
  using (public.is_group_member(group_id));

-- Anyone authenticated can join (insert themselves)
drop policy if exists "group_members: join" on public.group_members;
create policy "group_members: join"
  on public.group_members for insert
  with check (auth.uid() = user_id);

-- User can leave (delete themselves), admin can remove others
drop policy if exists "group_members: leave or remove" on public.group_members;
create policy "group_members: leave or remove"
  on public.group_members for delete
  using (
    auth.uid() = user_id
    or public.is_group_admin(group_id)
  );

-- ============================================================
-- OTPS
-- ============================================================
drop policy if exists "otps: read if group member" on public.otps;
create policy "otps: read if group member"
  on public.otps for select
  using (public.is_group_member(group_id));

drop policy if exists "otps: insert if group member" on public.otps;
create policy "otps: insert if group member"
  on public.otps for insert
  with check (
    auth.uid() = sender_user_id
    and public.is_group_member(group_id)
  );

-- No one can update OTPs
-- No manual delete (pg_cron handles it)

-- ============================================================
-- OTP VIEWS
-- ============================================================
drop policy if exists "otp_views: read if group member" on public.otp_views;
create policy "otp_views: read if group member"
  on public.otp_views for select
  using (public.can_see_otp(otp_id));

drop policy if exists "otp_views: insert" on public.otp_views;
create policy "otp_views: insert"
  on public.otp_views for insert
  with check (
    auth.uid() = viewer_id
    and public.can_see_otp(otp_id)
  );
