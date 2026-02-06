-- Add status column with default 'staging'
alter table public.boards
  add column if not exists status text not null default 'staging';

-- Backfill: any board with existing player_cards is 'playing'
update public.boards set status = 'playing'
where id in (select distinct board_id from public.player_cards);

-- Enable realtime on boards table for status change broadcasts
alter publication supabase_realtime add table public.boards;
