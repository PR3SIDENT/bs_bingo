import { supabase } from './supabase-client.js';
import { getSession, getProfile, ensureSession, signOut } from './auth.js';
import { INSPIRATION_CATEGORIES } from './inspiration-data.js';

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
const resetGameBtn = document.getElementById('reset-game-btn');
const bingoGrid = document.getElementById('bingo-grid');
const bingoOverlay = document.getElementById('bingo-overlay');
const bingoWinnerEl = document.getElementById('bingo-winner');
const shareBtn = document.getElementById('share-btn');
const joinSection = document.getElementById('join-section');
const joinForm = document.getElementById('join-form');
const joinNameInput = document.getElementById('join-name');
const joinSubmitBtn = document.getElementById('join-submit-btn');
const myCardLabel = document.getElementById('my-card-label');
const otherPlayersEl = document.getElementById('other-players');
const waitingHostEl = document.getElementById('waiting-host');
const leaderboardSection = document.getElementById('leaderboard-section');
const leaderboardListEl = document.getElementById('leaderboard-list');
const rewardRow = document.getElementById('reward-row');
const rewardInput = document.getElementById('reward-input');
const rewardDisplay = document.getElementById('reward-display');
const playerRosterEl = document.getElementById('player-roster');

let session = null;
let topics = [];
let myPlayer = null;
let myCard = null;
let allPlayers = [];
let otherCards = {};
let selectedColor = null;
let realtimeChannel = null;
let boardCreatorId = null;
let boardReward = null;
let rewardSaveTimer = null;
let activeInspirationCategory = null;

// Inspiration DOM refs
const inspirationToggle = document.getElementById('inspiration-toggle');
const inspirationBody = document.getElementById('inspiration-body');
const inspirationPills = document.getElementById('inspiration-pills');
const inspirationChips = document.getElementById('inspiration-chips');

// Debounce for card invalidation (trigger fires per-row)
let invalidateTimer = null;

// --- Init ---

async function init() {
  session = await ensureSession();
  if (!session) {
    document.body.innerHTML = '<div class="glass-card" style="margin:4rem auto;max-width:400px;padding:2rem;text-align:center"><h2>Unable to start session</h2><p style="margin-top:0.5rem;color:var(--text-dim)">Please try refreshing the page.</p><a href="/" class="btn btn-primary" style="margin-top:1rem;display:inline-block">Go Home</a></div>';
    return;
  }

  // Load board
  const { data: board, error } = await supabase
    .from('boards')
    .select('id, name, created_by, created_at, reward')
    .eq('id', boardId)
    .single();

  if (error || !board) {
    document.body.innerHTML = '<div class="glass-card" style="margin:4rem auto;max-width:400px;padding:2rem;text-align:center"><h2>Board not found</h2><a href="/" class="btn btn-primary" style="margin-top:1rem;display:inline-block">Go Home</a></div>';
    return;
  }

  boardNameEl.innerHTML = `What does <span class="board-name-highlight">${escapeHtml(board.name)}</span> always say?`;
  boardCreatorId = board.created_by;
  boardReward = board.reward || '';
  document.title = `${board.name}'s Bull$hit Bingo`;
  startGameTimer(board.created_at);

  // Load topics
  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, text, created_by')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true });
  topics = topicsData || [];
  renderTopicList();
  updateTopicCount();

  // Reward setup
  initReward();

  // Load players
  const { data: playersData } = await supabase
    .from('players')
    .select('id, user_id, name, color')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true });
  allPlayers = playersData || [];
  renderPlayerRoster();

  // Load leaderboard (after players so names resolve)
  await loadLeaderboard();

  // Check if current user already has a player
  myPlayer = allPlayers.find((p) => p.user_id === session.user.id) || null;

  if (myPlayer) {
    await tryLoadMyCard();
    await loadOtherCards();
    // If player exists but has no card yet and board has topics, generate one
    if (!myCard && topics.length >= MIN_TOPICS) {
      await enterPlayMode();
    } else if (!myCard) {
      // Show setup for everyone (host or non-creator)
      showSetupForEveryone();
    }
  } else {
    const profile = await getProfile(session.user.id);
    let pendingName = null;
    try { pendingName = localStorage.getItem('pending_name'); } catch {}
    const bestName = pendingName || profile?.display_name || '';

    if (isCreator() && bestName) {
      // Auto-join creator with their name, clear localStorage
      await autoJoin(bestName);
      try { localStorage.removeItem('pending_name'); } catch {}
      showSetupForEveryone();
    } else if (!isCreator() && bestName) {
      // Non-creator with a name: pre-fill join input, show join + setup
      joinNameInput.value = bestName;
      updateJoinButton();
      showJoinWithSetup();
    } else {
      // No name available: show join bar + setup
      showJoinWithSetup();
    }
  }

  subscribeRealtime();
  revealPage();
}

function revealPage() {
  const main = document.querySelector('.board-main');
  main.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  main.style.transform = 'translateY(0)';
  main.style.opacity = '1';
}

function isCreator() {
  return session && boardCreatorId === session.user.id;
}

function renderPlayerRoster() {
  playerRosterEl.innerHTML = '';
  if (allPlayers.length === 0) {
    playerRosterEl.innerHTML = '<span class="roster-empty">No players yet</span>';
    return;
  }
  allPlayers.forEach((player) => {
    const chip = document.createElement('span');
    const isYou = myPlayer && player.id === myPlayer.id;
    chip.className = 'roster-chip' + (isYou ? ' roster-chip--you' : '');
    chip.innerHTML = `<span class="player-dot" style="background:${player.color}"></span>${escapeHtml(player.name)}${isYou ? ' (you)' : ''}`;
    playerRosterEl.appendChild(chip);
  });
}

function showJoinSection() {
  joinSection.classList.remove('hidden');
  setupSection.classList.add('hidden');
  joinNameInput.focus();
}

function showSetupForEveryone() {
  setupSection.classList.remove('hidden');
  if (isCreator()) {
    playBtn.classList.remove('hidden');
    waitingHostEl.classList.add('hidden');
  } else {
    playBtn.classList.add('hidden');
    waitingHostEl.classList.remove('hidden');
  }
  updateTopicCount();
  initInspiration();
}

function showJoinWithSetup() {
  joinSection.classList.remove('hidden');
  setupSection.classList.remove('hidden');
  if (isCreator()) {
    playBtn.classList.remove('hidden');
    waitingHostEl.classList.add('hidden');
  } else {
    playBtn.classList.add('hidden');
    waitingHostEl.classList.remove('hidden');
  }
  updateTopicCount();
  joinNameInput.focus();
  initInspiration();
}

// --- Game Timer ---

const gameTimerEl = document.getElementById('game-timer');
const timerLabelEl = document.getElementById('timer-label');

function startGameTimer(createdAt) {
  const start = new Date(createdAt).getTime();
  gameTimerEl.classList.remove('hidden');

  function tick() {
    const elapsed = Date.now() - start;
    const secs = Math.floor(elapsed / 1000);
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    let label;
    if (days > 0) {
      label = `${days}d ${hrs % 24}h — still going`;
    } else if (hrs > 0) {
      label = `${hrs}h ${mins % 60}m — still going`;
    } else if (mins > 0) {
      label = `${mins}m ${secs % 60}s`;
    } else {
      label = `${secs}s — just started`;
    }

    timerLabelEl.textContent = label;
  }

  tick();
  setInterval(tick, 1000);
}

const AUTO_COLORS = ['#FF6B35', '#DAA520', '#6B8E23', '#B7410E', '#3b82f6', '#ec4899', '#06b6d4', '#D4A574'];

async function autoJoin(name) {
  // Pick a color not already taken by other players
  const usedColors = new Set(allPlayers.map((p) => p.color));
  const color = AUTO_COLORS.find((c) => !usedColors.has(c)) || AUTO_COLORS[0];

  const { data: player, error } = await supabase
    .from('players')
    .insert({
      user_id: session.user.id,
      board_id: boardId,
      name,
      color,
    })
    .select()
    .single();

  if (error) {
    console.error('Auto-join error:', error.message);
    // Fall back to manual join modal
    showJoinSection();
    return;
  }

  myPlayer = player;
  if (!allPlayers.find((p) => p.id === player.id)) {
    allPlayers.push(player);
  }
  renderPlayerRoster();
}

// --- Realtime ---

function subscribeRealtime() {
  realtimeChannel = supabase
    .channel(`board-${boardId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'topics', filter: `board_id=eq.${boardId}` }, (payload) => {
      const topic = payload.new;
      // Check for optimistic entry (temp id) and replace it
      const tempIdx = topics.findIndex((t) => String(t.id).startsWith('temp-') && t.text === topic.text && t.created_by === topic.created_by);
      if (tempIdx !== -1) {
        topics[tempIdx].id = topic.id;
      } else if (!topics.find((t) => t.id === topic.id)) {
        topics.push(topic);
        renderTopicList();
        updateTopicCount();
        renderQuoteChips();
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'topics', filter: `board_id=eq.${boardId}` }, (payload) => {
      const id = payload.old.id;
      topics = topics.filter((t) => t.id !== id);
      renderTopicList();
      updateTopicCount();
      renderQuoteChips();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `board_id=eq.${boardId}` }, (payload) => {
      const player = payload.new;
      if (!allPlayers.find((p) => p.id === player.id)) {
        allPlayers.push(player);
        updateTopicCount();
        renderPlayerRoster();
        renderOtherCards();
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'player_cards', filter: `board_id=eq.${boardId}` }, (payload) => {
      const row = payload.new;
      if (row.player_id !== myPlayer?.id) {
        // Another player got a new card — fetch summary
        loadOtherCardFor(row.player_id);
        // If we don't have a card yet, auto-generate ours (e.g. after a reset)
        if (myPlayer && !myCard && !isCreator()) {
          enterPlayMode();
        }
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
        bingoOverlay.classList.add('hidden');
        if (!playSection.classList.contains('hidden')) {
          if (isCreator()) {
            enterSetupMode();
          } else {
            // Non-creators go back to setup — auto-rejoin when host generates new cards
            playSection.classList.add('hidden');
            showSetupForEveryone();
          }
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
      // Update leaderboard with new win
      await loadLeaderboard();
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
  joinSubmitBtn.disabled = !joinNameInput.value.trim();
}
joinNameInput.addEventListener('input', updateJoinButton);

joinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = joinNameInput.value.trim();
  if (!name) return;

  // Auto-assign a color if the user didn't pick one
  if (!selectedColor) {
    const usedColors = new Set(allPlayers.map((p) => p.color));
    selectedColor = AUTO_COLORS.find((c) => !usedColors.has(c)) || AUTO_COLORS[0];
  }

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
  renderPlayerRoster();

  // Animate join bar out
  joinSection.style.transition = 'opacity 0.3s ease, max-height 0.3s ease';
  joinSection.style.opacity = '0';
  joinSection.style.maxHeight = '0';
  joinSection.style.overflow = 'hidden';
  setTimeout(() => {
    joinSection.classList.add('hidden');
    joinSection.style.cssText = '';
  }, 300);

  // If game is already running (other players have cards), jump straight in
  const { count } = await supabase
    .from('player_cards')
    .select('id', { count: 'exact', head: true })
    .eq('board_id', boardId);

  if (topics.length >= MIN_TOPICS && (isCreator() || count > 0)) {
    await enterPlayMode();
  } else {
    showSetupForEveryone();
  }
});

// --- Topics ---

function renderTopicList() {
  topicListEl.innerHTML = '';
  topics.forEach((topic) => {
    const canRemove = isCreator() || (session && topic.created_by === session.user.id);
    const el = document.createElement('div');
    el.className = 'topic-item';
    el.innerHTML = `
      <span class="topic-text">${escapeHtml(topic.text)}</span>
      ${canRemove ? `<button class="topic-remove" data-id="${topic.id}" title="Remove">&times;</button>` : ''}
    `;
    topicListEl.appendChild(el);
  });
  // Auto-scroll to show newest topic
  topicListEl.scrollTop = topicListEl.scrollHeight;
}

function updateTopicCount() {
  const count = topics.length;
  const playerCount = allPlayers.length;
  const playerLabel = `${playerCount} player${playerCount !== 1 ? 's' : ''}`;
  topicCountEl.textContent = `${playerLabel} · ${count} topic${count !== 1 ? 's' : ''}`;

  if (isCreator()) {
    playBtn.disabled = count < MIN_TOPICS;
    if (count < MIN_TOPICS) {
      playBtn.textContent = `Need ${MIN_TOPICS - count} more`;
      rewardRow.classList.add('hidden');
    } else {
      const gs = getGridSize(count);
      playBtn.textContent = `Start Game (${gs}\u00d7${gs})`;
      rewardRow.classList.remove('hidden');
    }
  }
}

topicForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = topicInput.value.trim();
  if (!text) return;

  topicInput.value = '';

  // Optimistic: show topic immediately with a temp id
  const tempId = `temp-${Date.now()}`;
  topics.push({ id: tempId, text, created_by: session.user.id });
  renderTopicList();
  updateTopicCount();

  const { data, error } = await supabase
    .from('topics')
    .insert({ board_id: boardId, text, created_by: session.user.id })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to add topic:', error.message);
    // Remove optimistic topic on failure
    topics = topics.filter((t) => t.id !== tempId);
    renderTopicList();
    updateTopicCount();
  } else {
    // Replace temp id with real id
    const t = topics.find((t) => t.id === tempId);
    if (t) t.id = data.id;
  }
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
    showJoinSection();
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

  // Show host-only controls
  if (isCreator()) {
    backSetupBtn.classList.remove('hidden');
    resetGameBtn.classList.remove('hidden');
  }

  await loadOtherCards();
}

function enterSetupMode() {
  setupSection.classList.remove('hidden');
  playSection.classList.add('hidden');
}

playBtn.addEventListener('click', enterPlayMode);
backSetupBtn.addEventListener('click', enterSetupMode);

resetGameBtn.addEventListener('click', async () => {
  if (!isCreator()) return;
  resetGameBtn.disabled = true;
  resetGameBtn.textContent = 'Resetting...';

  const res = await fetch('/api/reset-game', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ boardId }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error('Reset failed:', err.error);
  } else {
    // Clear local state immediately (don't rely on realtime DELETE filter)
    myCard = null;
    otherCards = {};
    renderOwnCard();
    renderOtherCards();
    bingoOverlay.classList.add('hidden');
    enterSetupMode();
  }

  resetGameBtn.disabled = false;
  resetGameBtn.textContent = 'Reset Game';
});

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
  bingoWinnerEl.innerHTML = `<span class="player-dot big" style="background:${playerColor}"></span> ${escapeHtml(playerName)} called it.`;
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

// --- Leaderboard ---

async function loadLeaderboard() {
  const { data: events } = await supabase
    .from('bingo_events')
    .select('player_id')
    .eq('board_id', boardId);

  if (!events || events.length === 0) {
    leaderboardSection.classList.add('hidden');
    return;
  }

  // Count wins per player
  const counts = {};
  events.forEach((e) => {
    counts[e.player_id] = (counts[e.player_id] || 0) + 1;
  });

  // Sort by wins descending
  const sorted = Object.entries(counts)
    .map(([playerId, wins]) => ({ playerId, wins }))
    .sort((a, b) => b.wins - a.wins);

  leaderboardListEl.innerHTML = '';
  sorted.forEach((entry) => {
    const player = allPlayers.find((p) => p.id === entry.playerId);
    const name = player ? escapeHtml(player.name) : 'Unknown';
    const color = player ? player.color : '#999';
    const el = document.createElement('div');
    el.className = 'leaderboard-item';
    el.innerHTML = `<span class="player-dot" style="background:${color}"></span> <span class="leaderboard-name">${name}</span> <span class="leaderboard-wins">${entry.wins}</span>`;
    leaderboardListEl.appendChild(el);
  });

  leaderboardSection.classList.remove('hidden');
}

// --- Reward ---

function initReward() {
  if (isCreator()) {
    // Host sees editable input — visibility controlled by updateTopicCount
    rewardInput.value = boardReward;
    rewardInput.addEventListener('input', () => {
      clearTimeout(rewardSaveTimer);
      rewardSaveTimer = setTimeout(saveReward, 600);
    });
  }

  // Everyone sees display if reward is set
  updateRewardDisplay();
}

async function saveReward() {
  const value = rewardInput.value.trim();
  boardReward = value;
  updateRewardDisplay();

  await supabase
    .from('boards')
    .update({ reward: value || null })
    .eq('id', boardId);
}

function updateRewardDisplay() {
  if (boardReward) {
    rewardDisplay.innerHTML = `<span style="opacity:0.6">Stakes:</span> ${escapeHtml(boardReward)}`;
    rewardDisplay.classList.remove('hidden');
  } else {
    rewardDisplay.classList.add('hidden');
  }
}

// --- Inspiration ---

let inspirationInitialized = false;

function initInspiration() {
  if (inspirationInitialized) return;
  inspirationInitialized = true;

  inspirationToggle.addEventListener('click', () => {
    const isOpen = !inspirationBody.classList.contains('hidden');
    if (isOpen) {
      inspirationBody.classList.add('hidden');
      inspirationToggle.textContent = 'Need ideas?';
    } else {
      inspirationBody.classList.remove('hidden');
      inspirationToggle.textContent = 'Hide ideas';
      if (!activeInspirationCategory) {
        activeInspirationCategory = INSPIRATION_CATEGORIES[0].name;
      }
      renderCategoryPills();
      renderQuoteChips();
    }
  });
}

function renderCategoryPills() {
  inspirationPills.innerHTML = '';
  INSPIRATION_CATEGORIES.forEach((cat) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'inspiration-pill' + (cat.name === activeInspirationCategory ? ' inspiration-pill--active' : '');
    pill.textContent = cat.name;
    pill.addEventListener('click', () => {
      activeInspirationCategory = cat.name;
      renderCategoryPills();
      renderQuoteChips();
    });
    inspirationPills.appendChild(pill);
  });
}

function renderQuoteChips() {
  if (!activeInspirationCategory) return;
  const cat = INSPIRATION_CATEGORIES.find((c) => c.name === activeInspirationCategory);
  if (!cat) return;

  const existingTexts = new Set(topics.map((t) => t.text.toLowerCase()));
  inspirationChips.innerHTML = '';

  cat.quotes.forEach((quote) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    const isUsed = existingTexts.has(quote.toLowerCase());
    chip.className = 'inspiration-chip' + (isUsed ? ' inspiration-chip--used' : '');
    chip.textContent = quote;
    if (!isUsed) {
      chip.addEventListener('click', () => addInspirationTopic(quote, chip));
    }
    inspirationChips.appendChild(chip);
  });
}

async function addInspirationTopic(text, chipEl) {
  if (!myPlayer) return;

  // Optimistic: mark chip as used
  chipEl.classList.add('inspiration-chip--used');
  chipEl.replaceWith(chipEl.cloneNode(true)); // Remove listener

  // Optimistic: add topic immediately
  const tempId = `temp-${Date.now()}`;
  topics.push({ id: tempId, text, created_by: session.user.id });
  renderTopicList();
  updateTopicCount();

  const { data, error } = await supabase
    .from('topics')
    .insert({ board_id: boardId, text, created_by: session.user.id })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to add inspiration topic:', error.message);
    topics = topics.filter((t) => t.id !== tempId);
    renderTopicList();
    updateTopicCount();
    renderQuoteChips();
  } else {
    const t = topics.find((t) => t.id === tempId);
    if (t) t.id = data.id;
  }
}

// --- Go ---
init();
