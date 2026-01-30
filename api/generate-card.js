import { supabaseAdmin } from '../lib/supabase-admin.js';
import { GRID_TIERS, getGridSize, shuffle } from '../lib/bingo-logic.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  const { boardId, playerId } = req.body;
  if (!boardId || !playerId) {
    return res.status(400).json({ error: 'boardId and playerId required' });
  }

  // Verify player belongs to this user
  const { data: player, error: playerErr } = await supabaseAdmin
    .from('players')
    .select('id, user_id, board_id')
    .eq('id', playerId)
    .single();

  if (playerErr || !player) return res.status(404).json({ error: 'Player not found' });
  if (player.user_id !== user.id) return res.status(403).json({ error: 'Not your player' });
  if (player.board_id !== boardId) return res.status(400).json({ error: 'Player not on this board' });

  // Fetch topics
  const { data: topics, error: topicsErr } = await supabaseAdmin
    .from('topics')
    .select('id, text')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true });

  if (topicsErr) return res.status(500).json({ error: 'Failed to fetch topics' });

  const topicCount = topics.length;
  if (topicCount < GRID_TIERS[0].need) {
    return res.status(400).json({ error: `Need at least ${GRID_TIERS[0].need} topics` });
  }

  const gridSize = getGridSize(topicCount);
  const totalCells = gridSize * gridSize;
  const centerIndex = Math.floor(totalCells / 2);

  // Delete existing card
  await supabaseAdmin
    .from('player_cards')
    .delete()
    .eq('player_id', playerId)
    .eq('board_id', boardId);

  // Shuffle and pick topics
  const shuffled = shuffle(topics).slice(0, totalCells - 1);
  let si = 0;

  const rows = [];
  for (let i = 0; i < totalCells; i++) {
    if (i === centerIndex) {
      rows.push({
        player_id: playerId,
        board_id: boardId,
        grid_size: gridSize,
        cell_index: i,
        topic_id: null,
        marked: true,
      });
    } else {
      const topic = shuffled[si++];
      rows.push({
        player_id: playerId,
        board_id: boardId,
        grid_size: gridSize,
        cell_index: i,
        topic_id: topic.id,
        marked: false,
      });
    }
  }

  const { error: insertErr } = await supabaseAdmin
    .from('player_cards')
    .insert(rows);

  if (insertErr) return res.status(500).json({ error: 'Failed to create card' });

  // Build response with topic text
  const topicMap = Object.fromEntries(topics.map(t => [t.id, t.text]));
  const cells = rows.map(r => ({
    cellIndex: r.cell_index,
    topicId: r.topic_id,
    marked: r.marked,
    text: r.topic_id === null ? 'FREE' : (topicMap[r.topic_id] || ''),
  }));

  return res.status(201).json({ playerId, boardId, gridSize, cells });
}
