alter table public.boards add column if not exists reward text;

-- Allow board creator to update their own board
create policy "Board creator can update own board"
  on public.boards for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);
