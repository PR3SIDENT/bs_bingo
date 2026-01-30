-- ============================================================
-- Bull$hit Bingo — Full Postgres Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. PROFILES (auto-created on signup)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. BOARDS
create table if not exists public.boards (
  id text primary key,
  name text not null,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.boards enable row level security;

create policy "Boards are viewable by authenticated users"
  on public.boards for select
  to authenticated
  using (true);

create policy "Authenticated users can create boards"
  on public.boards for insert
  to authenticated
  with check (auth.uid() = created_by);

-- 3. TOPICS
create table if not exists public.topics (
  id bigint generated always as identity primary key,
  board_id text not null references public.boards on delete cascade,
  text text not null,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.topics enable row level security;

create policy "Topics are viewable by authenticated users"
  on public.topics for select
  to authenticated
  using (true);

create policy "Authenticated users can add topics"
  on public.topics for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Topic creator or board creator can delete"
  on public.topics for delete
  to authenticated
  using (
    auth.uid() = created_by
    or auth.uid() = (select created_by from public.boards where id = board_id)
  );

-- 4. PLAYERS
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  board_id text not null references public.boards on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  unique (user_id, board_id)
);

alter table public.players enable row level security;

create policy "Players are viewable by authenticated users"
  on public.players for select
  to authenticated
  using (true);

create policy "Users can join boards"
  on public.players for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 5. PLAYER_CARDS
create table if not exists public.player_cards (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players on delete cascade,
  board_id text not null references public.boards on delete cascade,
  grid_size integer not null,
  cell_index integer not null,
  topic_id bigint references public.topics on delete set null,
  marked boolean not null default false,
  unique (player_id, cell_index)
);

alter table public.player_cards enable row level security;

create policy "Cards are viewable by authenticated users"
  on public.player_cards for select
  to authenticated
  using (true);

-- Mutations via serverless functions only (service role bypasses RLS)

-- 6. BINGO_EVENTS
create table if not exists public.bingo_events (
  id bigint generated always as identity primary key,
  board_id text not null references public.boards on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  winning_line integer[] not null,
  created_at timestamptz not null default now()
);

alter table public.bingo_events enable row level security;

create policy "Bingo events are viewable by authenticated users"
  on public.bingo_events for select
  to authenticated
  using (true);

-- Inserts via serverless function only

-- 7. AUTO-INVALIDATE CARDS when topics change
create or replace function public.invalidate_board_cards()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  target_board_id text;
begin
  if (tg_op = 'DELETE') then
    target_board_id := old.board_id;
  else
    target_board_id := new.board_id;
  end if;

  delete from public.player_cards where board_id = target_board_id;
  return coalesce(new, old);
end;
$$;

create or replace trigger on_topic_insert
  after insert on public.topics
  for each row execute function public.invalidate_board_cards();

create or replace trigger on_topic_delete
  after delete on public.topics
  for each row execute function public.invalidate_board_cards();

-- 8. REALTIME — enable on tables that need live updates
alter publication supabase_realtime add table public.topics;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.player_cards;
alter publication supabase_realtime add table public.bingo_events;
