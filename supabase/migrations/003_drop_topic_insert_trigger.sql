-- Drop the on_topic_insert trigger so that adding topics during an active game
-- does not delete all player_cards. The on_topic_delete trigger is kept because
-- deleting a topic that is on an active card is still disruptive.
DROP TRIGGER IF EXISTS on_topic_insert ON public.topics;
