import { supabaseAdmin } from '../lib/supabase-admin.js';

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
  if (board.created_by !== user.id) return res.status(403).json({ error: 'Only the host can reset' });

  // Delete all cards and bingo events for this board
  await supabaseAdmin.from('bingo_events').delete().eq('board_id', boardId);
  await supabaseAdmin.from('player_cards').delete().eq('board_id', boardId);

  return res.status(200).json({ ok: true });
}
