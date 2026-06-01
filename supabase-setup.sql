-- ═══════════════════════════════════════════════
--  DZ vs MA Rap Beef Tracker — Supabase Setup
--  Paste this entire file into:
--  Supabase Dashboard → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════

-- 1. BEEFS TABLE
create table if not exists beefs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  title       text not null,
  status      text default 'hot' check (status in ('hot','ongoing','settled')),
  views       text,
  description text,
  is_fresh    boolean default true,
  dz_name     text,
  dz_sub      text,
  dz_bio      text,
  dz_tracks   jsonb default '[]',
  ma_name     text,
  ma_sub      text,
  ma_bio      text,
  ma_tracks   jsonb default '[]'
);

-- 2. VOTES TABLE
create table if not exists votes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  beef_id     uuid references beefs(id) on delete cascade,
  side        text not null check (side in ('dz','ma')),
  voter_id    text not null,
  unique (beef_id, voter_id)   -- one vote per person per beef
);

-- 3. ROW LEVEL SECURITY
alter table beefs enable row level security;
alter table votes enable row level security;

-- Anyone can read beefs
create policy "Public read beefs"
  on beefs for select using (true);

-- Anyone can insert votes (anon users)
create policy "Public insert votes"
  on votes for insert with check (true);

-- Anyone can read votes (for tallying)
create policy "Public read votes"
  on votes for select using (true);

-- Only authenticated (admin) can insert/update/delete beefs
create policy "Admin write beefs"
  on beefs for all using (auth.role() = 'service_role');

-- 4. REALTIME — enable for votes table
-- (Do this in Supabase Dashboard → Database → Replication → enable votes table)
-- Or run:
alter publication supabase_realtime add table votes;

-- 5. SEED — 3 starting beefs (the 2026 war)
insert into beefs (title, status, views, description, is_fresh, dz_name, dz_sub, dz_bio, dz_tracks, ma_name, ma_sub, ma_bio, ma_tracks)
values
(
  'Trap King — JUGURTHA vs tout le Maroc',
  'hot',
  '241K views · May 27, 2026',
  'Trap King opens the 2026 war naming his nuke after Jugurtha — the ancient Berber king who defied Rome. Dark prod by TBB ODW, precise flow, punchlines acérées. Instantly viral. Called "Clash le Maroc en entier 2026." The whole DZ rap scene rallied behind it.',
  true,
  'Trap King',
  'Algérie 🇩🇿 — Trap Throne',
  'Named his diss after the ancient Numidian king who crushed foreign invasions. Beat by TBB ODW. Directed by Issam-Isack. Flow millimétré, prod explosive. Opened the 2026 war.',
  '[{"name":"JUGURTHA 🔥","url":"https://www.youtube.com/watch?v=-Lrkx9IRG8o"}]',
  'Maroc Rap Scene',
  '🇲🇦 Tout le Maroc — en attente',
  'Entire Moroccan scene called out in one track. Diib answered 3 days later with Trappink. MA reaction channels flooded with responses.',
  '[{"name":"Diib — TRAPPINK (réponse)","url":"https://www.youtube.com/watch?v=El89EikPar8"}]'
),
(
  'Youppi بوخوص vs Diib TRAPPINK',
  'hot',
  'Both dropped May 30, 2026',
  'THE MAIN EVENT. Youppi drops بوخوص — a precision lyrical strike at Diib. Diib answers the same day with TRAPPINK (prod INNER BEATS, mixed by Diib himself). The title mocks Trap King''s name while targeting both DZ rappers simultaneously. The most intense back-and-forth North African rap has seen in years.',
  true,
  'Youppi (Ayoub Kafi)',
  'Bouira 🇩🇿 — Le Kicker',
  'Real name Ayoub Kafi. Fastest pen in DZ rap — known for responding within 24h. بوخوص is his direct missile at Diib. Poetic, precise, cuts deep. The whole DZ community rallied behind him.',
  '[{"name":"بوخوص / BOUKHOS 🔥","url":"https://www.youtube.com/watch?v=Zgn7wOM6yA0"}]',
  'Diib — Le Loup',
  'Mrirt 🇲🇦 — Le Loup',
  'From Mrirt (province Khenifra). Back in 2021 he dropped 5 diss tracks in ONE WEEK against Youppi. Now in 2026 he drops TRAPPINK — the title mocks Trap King while firing at both DZ rappers. Prod INNER BEATS, mixed by Diib himself.',
  '[{"name":"TRAPPINK 🔥","url":"https://www.youtube.com/watch?v=El89EikPar8"}]'
),
(
  'The Original War — Youppi vs 7liwa & Diib',
  'settled',
  'Millions of views · 2021',
  'The beef that started everything. 7liwa disrespected the Algerian jersey on social media and made historical claims. Youppi dropped GAARA within 24h. Diib jumped in dropping 5 tracks in one week. Don Bigg joined with the legendary airport punchline. The 2026 beef is a direct continuation of this unfinished war.',
  false,
  'Youppi',
  'Bouira 🇩🇿 — 2021',
  'Dropped GAARA — considered by many the greatest diss in North African rap history. Named all his disses after Naruto characters. Battled multiple MA rappers simultaneously and was praised by the entire DZ community.',
  '[{"name":"GAARA"},{"name":"HASHIRAMA"},{"name":"EDO TENSEI"},{"name":"Big Mom / Kaguya"}]',
  '7liwa + Diib + Don Bigg',
  '🇲🇦 Coalition MA · 2021',
  '7liwa opened with Didine Cartoon. Diib dropped Saitama: "rap algérien n''est qu''une bougie, il suffit juste de souffler." Don Bigg joined with the legendary bar about Algerian airports having no planes.',
  '[{"name":"Didine Cartoon (7liwa)"},{"name":"Saitama (Diib) — une bougie"},{"name":"16 L dindinne Immak (Don Bigg)"}]'
);
