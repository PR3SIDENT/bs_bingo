import { supabaseAdmin } from '../lib/supabase-admin.js';

const GRID_TIERS = [
  { size: 3, need: 8 },
  { size: 4, need: 15 },
  { size: 5, need: 24 },
];
const MIN_TOPICS = GRID_TIERS[0].need;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  const { boardId } = req.body;
  if (!boardId) return res.status(400).json({ error: 'boardId required' });

  // Verify user is the board creator
  const { data: board, error: boardErr } = await supabaseAdmin
    .from('boards')
    .select('id, created_by')
    .eq('id', boardId)
    .single();

  if (boardErr || !board) return res.status(404).json({ error: 'Board not found' });
  if (board.created_by !== user.id) return res.status(403).json({ error: 'Only the host can start the game' });

  // Verify enough topics
  const { count, error: countErr } = await supabaseAdmin
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .eq('board_id', boardId);

  if (countErr) return res.status(500).json({ error: 'Failed to count topics' });
  if (count < MIN_TOPICS) return res.status(400).json({ error: `Need at least ${MIN_TOPICS} topics` });

  // Set board status to 'playing'
  const { error: updateErr } = await supabaseAdmin
    .from('boards')
    .update({ status: 'playing' })
    .eq('id', boardId);

  if (updateErr) return res.status(500).json({ error: 'Failed to start game' });

  return res.status(200).json({ ok: true });
}
