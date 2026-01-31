-- Drop the on_topic_delete trigger so that removing a next-round topic during
-- an active game does not destroy all player_cards. The schema already has
-- ON DELETE SET NULL on player_cards.topic_id, so deleting a topic that is on
-- an active card simply blanks that cell rather than wiping the whole game.
DROP TRIGGER IF EXISTS on_topic_delete ON public.topics;
