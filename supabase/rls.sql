-- ============================================================
-- OTPShare — Row Level Security Policies
-- Run this AFTER schema.sql in Supabase SQL Editor
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.otps enable row level security;
alter table public.otp_views enable row level security;

-- ============================================================
-- PROFILES
-- ============================================================

-- Users can read any profile (needed to show member names in group)
create policy "profiles: read any"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- Users can only update their own profile
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================
-- GROUPS
-- ============================================================

-- Only group members can see a group
create policy "groups: read if member"
  on public.groups for select
  using (
    exists (
      select 1 from public.group_members
      where group_id = groups.id and user_id = auth.uid()
    )
  );

-- Any authenticated user can create a group
create policy "groups: create"
  on public.groups for insert
  with check (auth.role() = 'authenticated');

-- Only admin can update group
create policy "groups: update if admin"
  on public.groups for update
  using (
    exists (
      select 1 from public.group_members
      where group_id = groups.id and user_id = auth.uid() and role = 'admin'
    )
  );

-- Only admin can delete group
create policy "groups: delete if admin"
  on public.groups for delete
  using (
    exists (
      select 1 from public.group_members
      where group_id = groups.id and user_id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- GROUP MEMBERS
-- ============================================================

-- Members can see other members in their group
create policy "group_members: read if in group"
  on public.group_members for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
    )
  );

-- Anyone authenticated can join (insert themselves) — rate limiting handled in Edge Function
create policy "group_members: join"
  on public.group_members for insert
  with check (auth.uid() = user_id);

-- User can leave (delete themselves), admin can remove others
create policy "group_members: leave or remove"
  on public.group_members for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role = 'admin'
    )
  );

-- ============================================================
-- OTPS
-- ============================================================

-- Only group members can see OTPs for their group
create policy "otps: read if group member"
  on public.otps for select
  using (
    exists (
      select 1 from public.group_members
      where group_id = otps.group_id and user_id = auth.uid()
    )
  );

-- Any group member can insert an OTP (their phone received it)
create policy "otps: insert if group member"
  on public.otps for insert
  with check (
    auth.uid() = sender_user_id
    and exists (
      select 1 from public.group_members
      where group_id = otps.group_id and user_id = auth.uid()
    )
  );

-- No one can update OTPs
-- No manual delete (pg_cron handles it)

-- ============================================================
-- OTP VIEWS
-- ============================================================

-- Members can see view logs for OTPs in their group
create policy "otp_views: read if group member"
  on public.otp_views for select
  using (
    exists (
      select 1 from public.otps o
      join public.group_members gm on gm.group_id = o.group_id
      where o.id = otp_views.otp_id and gm.user_id = auth.uid()
    )
  );

-- Any authenticated user can log a view of an OTP they can see
create policy "otp_views: insert"
  on public.otp_views for insert
  with check (
    auth.uid() = viewer_id
    and exists (
      select 1 from public.otps o
      join public.group_members gm on gm.group_id = o.group_id
      where o.id = otp_views.otp_id and gm.user_id = auth.uid()
    )
  );
