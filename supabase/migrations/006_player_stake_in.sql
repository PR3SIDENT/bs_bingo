-- Add stake_in column for Table Stakes wager system
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS stake_in boolean;

-- Allow players to update their own row (for toggling IN/OUT)
CREATE POLICY "Players can update own row"
  ON public.players FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
