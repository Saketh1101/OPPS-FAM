import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 5;
const MAX_MEMBERS = 6;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code } = (await req.json()) as { code?: string };
    const inviteCode = (code ?? '').trim().toUpperCase();
    if (inviteCode.length !== 6) {
      return json({ error: 'Invalid invite code' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Missing Supabase env vars' }, 500);
    }

    // Identify the caller from their JWT — never trust a user id in the body.
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(jwt);
    if (userError || !user) {
      return json({ error: 'Not authenticated' }, 401);
    }

    // Rate limit: max 5 attempts per user per 5 minutes (brute-force protection)
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count: attempts } = await admin
      .from('join_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gt('attempted_at', windowStart);

    if ((attempts ?? 0) >= MAX_ATTEMPTS) {
      return json({ error: 'Too many attempts. Try again in a few minutes.' }, 429);
    }
    await admin.from('join_attempts').insert({ user_id: user.id });

    // Look up the group (service role — non-members can't see groups via RLS)
    const { data: group } = await admin
      .from('groups')
      .select('*')
      .eq('invite_code', inviteCode)
      .single();

    if (!group) {
      return json({ error: 'No group found with that invite code' }, 404);
    }

    const { count: memberCount } = await admin
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', group.id);

    if ((memberCount ?? 0) >= MAX_MEMBERS) {
      return json({ error: `This group already has ${MAX_MEMBERS} members` }, 409);
    }

    const { data: existing } = await admin
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return json({ error: 'You are already in this group' }, 409);
    }

    const { error: joinError } = await admin
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id, role: 'member' });

    if (joinError) {
      return json({ error: joinError.message }, 500);
    }

    return json({ group });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
