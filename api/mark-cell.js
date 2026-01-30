const { supabaseAdmin } = require('../lib/supabase-admin');
const { checkBingo } = require('../lib/bingo-logic');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  const { boardId, playerId, cellIndex } = req.body;
  if (!boardId || !playerId || cellIndex === undefined || cellIndex === null) {
    return res.status(400).json({ error: 'boardId, playerId, and cellIndex required' });
  }

  // Verify player belongs to this user
  const { data: player, error: playerErr } = await supabaseAdmin
    .from('players')
    .select('id, user_id, board_id, name, color')
    .eq('id', playerId)
    .single();

  if (playerErr || !player) return res.status(404).json({ error: 'Player not found' });
  if (player.user_id !== user.id) return res.status(403).json({ error: 'Not your player' });
  if (player.board_id !== boardId) return res.status(400).json({ error: 'Player not on this board' });

  // Get the cell
  const { data: cell, error: cellErr } = await supabaseAdmin
    .from('player_cards')
    .select('id, topic_id, marked')
    .eq('player_id', playerId)
    .eq('board_id', boardId)
    .eq('cell_index', cellIndex)
    .single();

  if (cellErr || !cell) return res.status(404).json({ error: 'Cell not found' });
  if (cell.topic_id === null) return res.status(400).json({ error: 'Cannot toggle FREE cell' });

  // Toggle
  const newMarked = !cell.marked;
  const { error: updateErr } = await supabaseAdmin
    .from('player_cards')
    .update({ marked: newMarked })
    .eq('id', cell.id);

  if (updateErr) return res.status(500).json({ error: 'Failed to update cell' });

  // Check bingo
  const { data: allCells, error: allErr } = await supabaseAdmin
    .from('player_cards')
    .select('cell_index, marked, grid_size')
    .eq('player_id', playerId)
    .eq('board_id', boardId)
    .order('cell_index', { ascending: true });

  if (allErr) return res.status(500).json({ error: 'Failed to check bingo' });

  const gridSize = allCells[0]?.grid_size || 5;
  const bingoResult = checkBingo(allCells, gridSize);

  if (bingoResult.bingo) {
    await supabaseAdmin
      .from('bingo_events')
      .insert({
        board_id: boardId,
        player_id: playerId,
        winning_line: bingoResult.winningLine,
      });
  }

  return res.json({
    cellIndex,
    marked: newMarked,
    bingo: bingoResult,
  });
};
