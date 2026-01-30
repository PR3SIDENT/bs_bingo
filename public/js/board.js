import { supabase } from './supabase-client.js';
import { getSession, getProfile, signOut } from './auth.js';

const boardId = window.location.pathname.replace(/^\//, '');

const GRID_TIERS = [
  { size: 3, need: 8 },
  { size: 4, need: 15 },
  { size: 5, need: 24 },
];
const MIN_TOPICS = GRID_TIERS[0].need;

function getGridSize(topicCount) {
  for (let i = GRID_TIERS.length - 1; i >= 0; i--) {
    if (topicCount >= GRID_TIERS[i].need) return GRID_TIERS[i].size;
  }
  return GRID_TIERS[0].size;
}

// DOM refs
const boardNameEl = document.getElementById('board-name');
const setupSection = document.getElementById('setup-section');
const playSection = document.getElementById('play-section');
const topicForm = document.getElementById('topic-form');
const topicInput = document.getElementById('topic-input');
const topicListEl = document.getElementById('topic-list');
const topicCountEl = document.getElementById('topic-count');
const playBtn = document.getElementById('play-btn');
const backSetupBtn = document.getElementById('back-setup-btn');
const reshuffleBtn = document.getElementById('reshuffle-btn');
const bingoGrid = document.getElementById('bingo-grid');
const bingoOverlay = document.getElementById('bingo-overlay');
const bingoWinnerEl = document.getElementById('bingo-winner');
const shareBtn = document.getElementById('share-btn');
const joinModal = document.getElementById('join-modal');
const joinForm = document.getElementById('join-form');
const joinNameInput = document.getElementById('join-name');
const joinSubmitBtn = document.getElementById('join-submit-btn');
const myCardLabel = document.getElementById('my-card-label');
const otherPlayersEl = document.getElementById('other-players');

let session = null;
let topics = [];
let myPlayer = null;
let myCard = null;
let allPlayers = [];
let otherCards = {};
let selectedColor = null;
let realtimeChannel = null;

// Debounce for card invalidation (trigger fires per-row)
let invalidateTimer = null;

// --- Init ---

async function init() {
  session = await getSession();
  if (!session) {
    window.location.href = '/';
    return;
  }

  // Load board
  const { data: board, error } = await supabase
    .from('boards')
    .select('id, name')
    .eq('id', boardId)
    .single();

  if (error || !board) {
    document.body.innerHTML = '<div class="glass-card" style="margin:4rem auto;max-width:400px;padding:2rem;text-align:center"><h2>Board not found</h2><a href="/" class="btn btn-primary" style="margin-top:1rem;display:inline-block">Go Home</a></div>';
    return;
  }

  boardNameEl.textContent = board.name;
  document.title = `${board.name} — Bull$hit Bingo`;

  // Load topics
  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, text, created_by')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true });
  topics = topicsData || [];
  renderTopicList();
  updateTopicCount();

  // Load players
  const { data: playersData } = await supabase
    .from('players')
    .select('id, user_id, name, color')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true });
  allPlayers = playersData || [];

  // Check if current user already has a player
  myPlayer = allPlayers.find((p) => p.user_id === session.user.id) || null;

  if (myPlayer) {
    await tryLoadMyCard();
    await loadOtherCards();
  } else {
    // Pre-fill name from profile
    const profile = await getProfile(session.user.id);
    if (profile?.display_name) {
      joinNameInput.value = profile.display_name;
      updateJoinButton();
    }
    showJoinModal();
  }

  subscribeRealtime();
}

function showJoinModal() {
  joinModal.classList.remove('hidden');
  joinNameInput.focus();
}

// --- Realtime ---

function subscribeRealtime() {
  realtimeChannel = supabase
    .channel(`board-${boardId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'topics', filter: `board_id=eq.${boardId}` }, (payload) => {
      const topic = payload.new;
      if (!topics.find((t) => t.id === topic.id)) {
        topics.push(topic);
        renderTopicList();
        updateTopicCount();
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'topics', filter: `board_id=eq.${boardId}` }, (payload) => {
      const id = payload.old.id;
      topics = topics.filter((t) => t.id !== id);
      renderTopicList();
      updateTopicCount();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `board_id=eq.${boardId}` }, (payload) => {
      const player = payload.new;
      if (!allPlayers.find((p) => p.id === player.id)) {
        allPlayers.push(player);
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'player_cards', filter: `board_id=eq.${boardId}` }, (payload) => {
      const row = payload.new;
      if (row.player_id !== myPlayer?.id) {
        // Another player got a new card — fetch summary
        loadOtherCardFor(row.player_id);
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'player_cards', filter: `board_id=eq.${boardId}` }, (payload) => {
      const row = payload.new;
      if (row.player_id === myPlayer?.id) {
        // Server confirmed our mark
        if (myCard) {
          const cell = myCard.cells.find((c) => c.cellIndex === row.cell_index);
          if (cell) cell.marked = row.marked;
        }
      } else {
        // Other player's mark changed
        if (otherCards[row.player_id]) {
          const cell = otherCards[row.player_id].cells.find((c) => c.cellIndex === row.cell_index);
          if (cell) {
            cell.marked = row.marked;
            renderMiniCard(row.player_id);
          }
        }
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'player_cards', filter: `board_id=eq.${boardId}` }, () => {
      // Cards invalidated — debounce since trigger fires per-row
      clearTimeout(invalidateTimer);
      invalidateTimer = setTimeout(() => {
        myCard = null;
        otherCards = {};
        renderOwnCard();
        renderOtherCards();
        if (!playSection.classList.contains('hidden')) {
          enterSetupMode();
        }
      }, 200);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bingo_events', filter: `board_id=eq.${boardId}` }, async (payload) => {
      const evt = payload.new;
      const player = allPlayers.find((p) => p.id === evt.player_id);
      if (player) {
        showBingoOverlay(player.name, player.color);
        if (evt.player_id === myPlayer?.id && evt.winning_line) {
          evt.winning_line.forEach((i) => {
            const cellEl = bingoGrid.children[i];
            if (cellEl) cellEl.classList.add('winner');
          });
        }
      }
    })
    .subscribe();
}

// --- Join Modal ---

const colorSwatches = document.querySelectorAll('.color-swatch');
colorSwatches.forEach((swatch) => {
  swatch.addEventListener('click', () => {
    colorSwatches.forEach((s) => s.classList.remove('selected'));
    swatch.classList.add('selected');
    selectedColor = swatch.dataset.color;
    updateJoinButton();
  });
});

function updateJoinButton() {
  joinSubmitBtn.disabled = !joinNameInput.value.trim() || !selectedColor;
}
joinNameInput.addEventListener('input', updateJoinButton);

joinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = joinNameInput.value.trim();
  if (!name || !selectedColor) return;

  joinSubmitBtn.disabled = true;
  joinSubmitBtn.textContent = 'Joining...';

  const { data: player, error } = await supabase
    .from('players')
    .insert({
      user_id: session.user.id,
      board_id: boardId,
      name,
      color: selectedColor,
    })
    .select()
    .single();

  if (error) {
    console.error('Join error:', error.message);
    joinSubmitBtn.disabled = false;
    joinSubmitBtn.textContent = 'Join';
    return;
  }

  myPlayer = player;
  if (!allPlayers.find((p) => p.id === player.id)) {
    allPlayers.push(player);
  }
  joinModal.classList.add('hidden');
});

// --- Topics ---

function renderTopicList() {
  topicListEl.innerHTML = '';
  topics.forEach((topic) => {
    const el = document.createElement('div');
    el.className = 'topic-item';
    el.innerHTML = `
      <span class="topic-text">${escapeHtml(topic.text)}</span>
      <button class="topic-remove" data-id="${topic.id}" title="Remove">&times;</button>
    `;
    topicListEl.appendChild(el);
  });
}

function updateTopicCount() {
  const count = topics.length;
  topicCountEl.textContent = `${count} topic${count !== 1 ? 's' : ''}`;
  playBtn.disabled = count < MIN_TOPICS;
  if (count < MIN_TOPICS) {
    playBtn.textContent = `Need ${MIN_TOPICS - count} more`;
  } else {
    const gs = getGridSize(count);
    playBtn.textContent = `Shuffle & Play (${gs}\u00d7${gs})`;
  }
}

topicForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = topicInput.value.trim();
  if (!text) return;

  topicInput.value = '';

  const { error } = await supabase
    .from('topics')
    .insert({ board_id: boardId, text, created_by: session.user.id });

  if (error) console.error('Failed to add topic:', error.message);
  topicInput.focus();
});

topicListEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('.topic-remove');
  if (!btn) return;
  const id = parseInt(btn.dataset.id);

  await supabase.from('topics').delete().eq('id', id);
});

// --- Play Mode ---

async function enterPlayMode() {
  if (!myPlayer) {
    showJoinModal();
    return;
  }

  const token = session.access_token;
  const res = await fetch('/api/generate-card', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ boardId, playerId: myPlayer.id }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error(err.error || 'Failed to generate card');
    return;
  }

  myCard = await res.json();
  bingoOverlay.classList.add('hidden');
  renderOwnCard();

  setupSection.classList.add('hidden');
  playSection.classList.remove('hidden');

  await loadOtherCards();
}

function enterSetupMode() {
  setupSection.classList.remove('hidden');
  playSection.classList.add('hidden');
}

playBtn.addEventListener('click', enterPlayMode);
backSetupBtn.addEventListener('click', enterSetupMode);
reshuffleBtn.addEventListener('click', enterPlayMode);

// --- Own card rendering ---

function renderOwnCard() {
  bingoGrid.innerHTML = '';
  if (!myCard) {
    myCardLabel.textContent = '';
    return;
  }

  myCardLabel.innerHTML = `<span class="player-dot" style="background:${myPlayer.color}"></span> ${escapeHtml(myPlayer.name)}`;
  bingoGrid.style.gridTemplateColumns = `repeat(${myCard.gridSize}, 1fr)`;

  myCard.cells.forEach((cell) => {
    const el = document.createElement('button');
    el.className = 'bingo-cell';
    if (cell.text === 'FREE') el.classList.add('free');
    if (cell.marked) el.classList.add('marked');
    el.dataset.index = cell.cellIndex;
    el.innerHTML = `<span>${escapeHtml(cell.text)}</span>`;
    bingoGrid.appendChild(el);
  });
}

// --- Cell click handler ---

bingoGrid.addEventListener('click', async (e) => {
  const cell = e.target.closest('.bingo-cell');
  if (!cell || cell.classList.contains('free') || !myPlayer || !myCard) return;

  const idx = parseInt(cell.dataset.index);
  const cellData = myCard.cells.find((c) => c.cellIndex === idx);
  if (!cellData) return;

  // Optimistic UI
  cellData.marked = !cellData.marked;
  if (cellData.marked) {
    cell.classList.add('marked');
    cell.classList.add('pop');
    setTimeout(() => cell.classList.remove('pop'), 300);
  } else {
    cell.classList.remove('marked');
  }

  const token = session.access_token;
  await fetch('/api/mark-cell', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ boardId, playerId: myPlayer.id, cellIndex: idx }),
  });
});

// --- Other players ---

async function loadOtherCardFor(playerId) {
  if (playerId === myPlayer?.id) return;

  const { data: cells } = await supabase
    .from('player_cards')
    .select('cell_index, marked, grid_size')
    .eq('player_id', playerId)
    .eq('board_id', boardId)
    .order('cell_index', { ascending: true });

  if (!cells || cells.length === 0) return;

  const gridSize = cells[0].grid_size;
  otherCards[playerId] = {
    gridSize,
    cells: cells.map((c) => ({ cellIndex: c.cell_index, marked: c.marked })),
  };
  renderOtherCards();
}

async function loadOtherCards() {
  if (!myPlayer) return;
  otherCards = {};

  for (const player of allPlayers) {
    if (player.id === myPlayer.id) continue;
    await loadOtherCardFor(player.id);
  }
  renderOtherCards();
}

async function tryLoadMyCard() {
  if (!myPlayer) return;

  // Fetch own card with topic text via join
  const { data: cells } = await supabase
    .from('player_cards')
    .select('cell_index, topic_id, marked, grid_size, topics(text)')
    .eq('player_id', myPlayer.id)
    .eq('board_id', boardId)
    .order('cell_index', { ascending: true });

  if (!cells || cells.length === 0) return;

  const gridSize = cells[0].grid_size;
  myCard = {
    playerId: myPlayer.id,
    boardId,
    gridSize,
    cells: cells.map((c) => ({
      cellIndex: c.cell_index,
      topicId: c.topic_id,
      marked: c.marked,
      text: c.topic_id === null ? 'FREE' : (c.topics?.text || ''),
    })),
  };

  renderOwnCard();
  setupSection.classList.add('hidden');
  playSection.classList.remove('hidden');
}

function renderOtherCards() {
  otherPlayersEl.innerHTML = '';

  for (const player of allPlayers) {
    if (player.id === myPlayer?.id) continue;
    const card = otherCards[player.id];
    if (!card) continue;

    const wrapper = document.createElement('div');
    wrapper.className = 'mini-card-wrapper';
    wrapper.dataset.playerId = player.id;

    const label = document.createElement('div');
    label.className = 'mini-card-label';
    label.innerHTML = `<span class="player-dot" style="background:${player.color}"></span> ${escapeHtml(player.name)}`;
    wrapper.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'mini-grid';
    grid.style.gridTemplateColumns = `repeat(${card.gridSize}, 1fr)`;

    card.cells.forEach((cell) => {
      const cellEl = document.createElement('div');
      cellEl.className = 'mini-cell';
      cellEl.dataset.index = cell.cellIndex;
      if (cell.marked) {
        cellEl.classList.add('mini-marked');
        cellEl.style.background = player.color;
      }
      grid.appendChild(cellEl);
    });

    wrapper.appendChild(grid);
    otherPlayersEl.appendChild(wrapper);
  }
}

function renderMiniCard(playerId) {
  const wrapper = otherPlayersEl.querySelector(`[data-player-id="${playerId}"]`);
  if (!wrapper) {
    renderOtherCards();
    return;
  }

  const card = otherCards[playerId];
  if (!card) return;

  const player = allPlayers.find((p) => p.id === playerId);
  if (!player) return;

  const grid = wrapper.querySelector('.mini-grid');
  card.cells.forEach((cell) => {
    const cellEl = grid.children[cell.cellIndex];
    if (!cellEl) return;
    if (cell.marked) {
      cellEl.classList.add('mini-marked');
      cellEl.style.background = player.color;
    } else {
      cellEl.classList.remove('mini-marked');
      cellEl.style.background = '';
    }
  });
}

// --- Bingo Overlay ---

function showBingoOverlay(playerName, playerColor) {
  bingoWinnerEl.innerHTML = `<span class="player-dot big" style="background:${playerColor}"></span> ${escapeHtml(playerName)} wins!`;
  bingoOverlay.classList.remove('hidden');
  window.launchConfetti();
}

bingoOverlay.addEventListener('click', () => {
  bingoOverlay.classList.add('hidden');
});

// --- Share ---

shareBtn.addEventListener('click', () => {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    shareBtn.textContent = 'Copied!';
    setTimeout(() => (shareBtn.textContent = 'Copy Link'), 2000);
  }).catch(() => {
    // fallback: just select the URL bar
  });
});

// --- Utility ---

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Go ---
init();
