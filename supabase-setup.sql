-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SCRIPT D'INITIALISATION DE LA BASE SUPABASE — v3                  ║
-- ╠══════════════════════════════════════════════════════════════════╣
-- ║  Tables créées :                                                   ║
-- ║   - comments  (commentaires sous les médias)                       ║
-- ║   - profiles  (pseudo unique, avatar, bio, providers)              ║
-- ║   - reports   (signalements de commentaires)                       ║
-- ║   - bans      (utilisateurs bannis)                                ║
-- ║                                                                    ║
-- ║  Comment l'utiliser :                                              ║
-- ║   1. Créez un projet sur https://app.supabase.com                  ║
-- ║   2. Ouvrez SQL Editor (icône éclair à gauche)                     ║
-- ║   3. Collez et exécutez ce script intégralement                    ║
-- ║   Le script est IDEMPOTENT : vous pouvez le ré-exécuter sans       ║
-- ║   risque pour appliquer les évolutions.                            ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- 💬 TABLE COMMENTS
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  media_id    text not null,
  media_name  text not null,
  user_uid    text not null,
  user_email  text,                 -- nullable (auth téléphone)
  user_phone  text,                 -- nullable (auth email)
  user_name   text not null,
  content     text not null check (char_length(content) between 1 and 2000),
  created_at  timestamptz not null default now()
);
alter table public.comments alter column user_email drop not null;
alter table public.comments add column if not exists user_phone text;

create index if not exists comments_media_id_idx on public.comments (media_id, created_at desc);
create index if not exists comments_user_uid_idx on public.comments (user_uid);

-- ═══════════════════════════════════════════════════════════════════
-- 👤 TABLE PROFILES (pseudo unique, avatar, bio)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  user_uid    text primary key,
  username    text not null,
  email       text,
  phone       text,
  avatar_url  text,
  bio         text,
  providers   text[] default array[]::text[],
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index pour le lookup case-insensitive du pseudo (login par pseudo,
-- vérification de disponibilité). On utilise un UNIQUE INDEX sur lower().
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));
create index if not exists profiles_email_idx on public.profiles (lower(email));

-- ═══════════════════════════════════════════════════════════════════
-- 🚩 TABLE REPORTS (signalements)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  comment_id    uuid not null references public.comments(id) on delete cascade,
  reporter_uid  text not null,
  reason        text,
  created_at    timestamptz not null default now()
);

-- Un user ne peut signaler le même commentaire qu'une fois
create unique index if not exists reports_unique_idx
  on public.reports (comment_id, reporter_uid);
create index if not exists reports_comment_id_idx on public.reports (comment_id);

-- ═══════════════════════════════════════════════════════════════════
-- 🚫 TABLE BANS
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.bans (
  user_uid    text primary key,
  reason      text,
  until       timestamptz,           -- NULL = permanent
  created_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 🔒 ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
alter table public.comments enable row level security;
alter table public.profiles enable row level security;
alter table public.reports  enable row level security;
alter table public.bans     enable row level security;

-- ── COMMENTS ───────────────────────────────────────────────────────
drop policy if exists "Public read comments" on public.comments;
create policy "Public read comments"
  on public.comments for select using (true);

drop policy if exists "Anyone can insert comments" on public.comments;
create policy "Anyone can insert comments"
  on public.comments for insert with check (
    char_length(content) between 1 and 2000
    and char_length(user_uid) between 1 and 128
    and char_length(user_name) between 1 and 80
    and (
      (user_email is not null and char_length(user_email) between 3 and 320)
      or (user_phone is not null and char_length(user_phone) between 5 and 20)
    )
  );

drop policy if exists "Anyone can delete comments" on public.comments;
create policy "Anyone can delete comments"
  on public.comments for delete using (true);

-- ── PROFILES ───────────────────────────────────────────────────────
drop policy if exists "Public read profiles" on public.profiles;
create policy "Public read profiles"
  on public.profiles for select using (true);

drop policy if exists "Anyone can upsert profile" on public.profiles;
create policy "Anyone can upsert profile"
  on public.profiles for insert with check (
    char_length(user_uid) between 1 and 128
    and char_length(username) between 3 and 20
  );

drop policy if exists "Anyone can update own profile" on public.profiles;
create policy "Anyone can update own profile"
  on public.profiles for update using (true) with check (
    char_length(username) between 3 and 20
  );

-- ── REPORTS ────────────────────────────────────────────────────────
drop policy if exists "Public read reports" on public.reports;
create policy "Public read reports"
  on public.reports for select using (true);

drop policy if exists "Anyone can insert report" on public.reports;
create policy "Anyone can insert report"
  on public.reports for insert with check (
    char_length(reporter_uid) between 1 and 128
  );

drop policy if exists "Anyone can delete report" on public.reports;
create policy "Anyone can delete report"
  on public.reports for delete using (true);

-- ── BANS ───────────────────────────────────────────────────────────
drop policy if exists "Public read bans" on public.bans;
create policy "Public read bans"
  on public.bans for select using (true);

drop policy if exists "Anyone can insert ban" on public.bans;
create policy "Anyone can insert ban"
  on public.bans for insert with check (char_length(user_uid) between 1 and 128);

drop policy if exists "Anyone can update ban" on public.bans;
create policy "Anyone can update ban"
  on public.bans for update using (true) with check (true);

drop policy if exists "Anyone can delete ban" on public.bans;
create policy "Anyone can delete ban"
  on public.bans for delete using (true);

-- ⚠️  NIVEAU DE SÉCURITÉ : la vérification des droits (admin pour ban,
--     auteur pour delete son propre commentaire) se fait CÔTÉ CLIENT.
--     C'est acceptable pour un usage scolaire / communautaire.
--     Pour un usage en production critique, utilisez Supabase Auth
--     avec JWT et basez les policies sur auth.uid().

-- ═══════════════════════════════════════════════════════════════════
-- ✅ TERMINÉ ! Vérifications :
--   select count(*) from public.comments;
--   select count(*) from public.profiles;
--   select count(*) from public.reports;
--   select count(*) from public.bans;
-- ═══════════════════════════════════════════════════════════════════
