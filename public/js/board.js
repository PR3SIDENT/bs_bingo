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
let boardStatus = null;
let boardReward = null;
let rewardSaveTimer = null;
let activeInspirationCategory = null;
let winCounts = {};
let topicIdsAtGameStart = new Set();
let ideaBankTopics = [];

// Inspiration DOM refs
const inspirationPills = document.getElementById('inspiration-pills');
const inspirationChips = document.getElementById('inspiration-chips');

// Idea Bank DOM refs
const ideaBankEl = document.getElementById('idea-bank');
const ideaBankChipsEl = document.getElementById('idea-bank-chips');

// Next Round DOM refs
const nextRoundSection = document.getElementById('next-round-section');
const nextRoundToggle = document.getElementById('next-round-toggle');
const nextRoundBadge = document.getElementById('next-round-badge');
const nextRoundBody = document.getElementById('next-round-body');
const nextRoundForm = document.getElementById('next-round-form');
const nextRoundInput = document.getElementById('next-round-input');
const nextRoundList = document.getElementById('next-round-list');

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
    .select('id, name, created_by, created_at, reward, status')
    .eq('id', boardId)
    .single();

  if (error || !board) {
    document.body.innerHTML = '<div class="glass-card" style="margin:4rem auto;max-width:400px;padding:2rem;text-align:center"><h2>Board not found</h2><a href="/" class="btn btn-primary" style="margin-top:1rem;display:inline-block">Go Home</a></div>';
    return;
  }

  boardNameEl.innerHTML = `What does <span class="board-name-highlight">${escapeHtml(board.name)}</span> always say?`;
  boardCreatorId = board.created_by;
  boardStatus = board.status || 'staging';
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
    if (boardStatus === 'playing') {
      await tryLoadMyCard();
      await loadOtherCards();
      // If board is playing but we don't have a card yet, generate one
      if (!myCard) {
        await enterPlayMode();
      }
    } else {
      // Board is in staging — show setup regardless of any stale card data
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
    const wins = winCounts[player.id] || 0;
    const winBadge = wins > 0 ? `<span class="roster-divider">|</span><span class="roster-wins">Wins: ${wins}</span>` : '';
    chip.innerHTML = `<span class="player-dot" style="background:${player.color}"></span>${escapeHtml(player.name)}${isYou ? ' (you)' : ''}${winBadge}`;
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
  renderTopicList();
  updateTopicCount();
  initInspiration();
  loadIdeaBank();
}

function showJoinWithSetup() {
  joinSection.classList.remove('hidden');
  if (isCreator()) {
    // Creator still needs to see setup to add topics
    setupSection.classList.remove('hidden');
    playBtn.classList.remove('hidden');
    waitingHostEl.classList.add('hidden');
    updateTopicCount();
    initInspiration();
    loadIdeaBank();
  }
  // Non-creators just see the join bar until they join
  joinNameInput.focus();
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
        renderIdeaBank();
      }
      if (isInPlayMode()) renderNextRoundList();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'topics', filter: `board_id=eq.${boardId}` }, (payload) => {
      const id = payload.old.id;
      topics = topics.filter((t) => t.id !== id);
      renderTopicList();
      updateTopicCount();
      renderQuoteChips();
      renderIdeaBank();
      if (isInPlayMode()) renderNextRoundList();
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
        topicIdsAtGameStart = new Set();
        renderOwnCard();
        renderOtherCards();
        bingoOverlay.classList.add('hidden');
        if (!playSection.classList.contains('hidden')) {
          playSection.classList.add('hidden');
          showSetupForEveryone();
        }
      }, 200);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'boards', filter: `id=eq.${boardId}` }, async (payload) => {
      const newStatus = payload.new.status;
      if (newStatus === boardStatus) return; // no change
      boardStatus = newStatus;

      if (boardStatus === 'playing') {
        // Game started — auto-generate card and enter play mode
        if (myPlayer && !myCard) {
          await enterPlayMode();
        }
      } else if (boardStatus === 'staging') {
        // Game reset — clear cards and return to setup
        myCard = null;
        otherCards = {};
        topicIdsAtGameStart = new Set();
        renderOwnCard();
        renderOtherCards();
        bingoOverlay.classList.add('hidden');
        playSection.classList.add('hidden');
        showSetupForEveryone();
      }
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

  // If game is already running, jump straight into play mode
  if (boardStatus === 'playing') {
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
  topicCountEl.textContent = `${count} topic${count !== 1 ? 's' : ''}`;

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

  // Optimistic: remove immediately from UI
  const removed = topics.find((t) => t.id === id);
  topics = topics.filter((t) => t.id !== id);
  renderTopicList();
  updateTopicCount();
  renderQuoteChips();
  renderIdeaBank();

  const { error } = await supabase.from('topics').delete().eq('id', id);
  if (error) {
    // Restore on failure
    if (removed) {
      topics.push(removed);
      renderTopicList();
      updateTopicCount();
      renderQuoteChips();
      renderIdeaBank();
    }
  }
});

// --- Play Mode ---

async function startGame() {
  // Host-only: transition the board to 'playing' via the API
  const res = await fetch('/api/start-game', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ boardId }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error(err.error || 'Failed to start game');
    return;
  }

  boardStatus = 'playing';
  await enterPlayMode();
}

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

  // Snapshot current topic IDs so we can distinguish next-round additions
  topicIdsAtGameStart = new Set(topics.map((t) => t.id));

  setupSection.classList.add('hidden');
  playSection.classList.remove('hidden');
  renderNextRoundList();

  // Show host-only controls
  if (isCreator()) {
    resetGameBtn.classList.remove('hidden');
  }

  await loadOtherCards();
}

playBtn.addEventListener('click', startGame);

let resetConfirmPending = false;

function clearResetConfirm() {
  resetConfirmPending = false;
  resetGameBtn.textContent = 'Reset';
  resetGameBtn.classList.remove('btn-reset--confirm');
}

document.addEventListener('click', (e) => {
  if (resetConfirmPending && !e.target.closest('#reset-game-btn')) {
    clearResetConfirm();
  }
});

resetGameBtn.addEventListener('click', async () => {
  if (!isCreator()) return;

  if (!resetConfirmPending) {
    resetConfirmPending = true;
    resetGameBtn.textContent = 'Are you sure?';
    resetGameBtn.classList.add('btn-reset--confirm');
    return;
  }

  clearResetConfirm();
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
    topicIdsAtGameStart = new Set();
    renderOwnCard();
    renderOtherCards();
    bingoOverlay.classList.add('hidden');
    playSection.classList.add('hidden');
    showSetupForEveryone();
  }

  resetGameBtn.disabled = false;
  resetGameBtn.textContent = 'Reset';
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

  // Snapshot current topic IDs so we can distinguish next-round additions
  topicIdsAtGameStart = new Set(topics.map((t) => t.id));

  setupSection.classList.add('hidden');
  playSection.classList.remove('hidden');
  renderNextRoundList();

  if (isCreator()) {
    resetGameBtn.classList.remove('hidden');
  }
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

const overlayResetBtn = document.getElementById('overlay-reset-btn');

function showBingoOverlay(playerName, playerColor) {
  bingoWinnerEl.innerHTML = `<span class="player-dot big" style="background:${playerColor}"></span> ${escapeHtml(playerName)} called it.`;
  if (isCreator()) {
    overlayResetBtn.classList.remove('hidden');
  } else {
    overlayResetBtn.classList.add('hidden');
  }
  bingoOverlay.classList.remove('hidden');
  window.launchConfetti();
}

bingoOverlay.addEventListener('click', (e) => {
  if (e.target.closest('#overlay-reset-btn')) return;
  bingoOverlay.classList.add('hidden');
});

overlayResetBtn.addEventListener('click', async () => {
  overlayResetBtn.disabled = true;
  overlayResetBtn.textContent = 'Resetting...';

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
    myCard = null;
    otherCards = {};
    topicIdsAtGameStart = new Set();
    renderOwnCard();
    renderOtherCards();
    bingoOverlay.classList.add('hidden');
    playSection.classList.add('hidden');
    showSetupForEveryone();
  }

  overlayResetBtn.disabled = false;
  overlayResetBtn.textContent = 'New Round';
});

// --- Share ---

const shareCodeEl = document.getElementById('share-code');
const shareCodeLabel = `Join Code: ${boardId}`;
shareCodeEl.textContent = shareCodeLabel;

shareCodeEl.addEventListener('click', () => {
  navigator.clipboard.writeText(boardId).then(() => {
    shareCodeEl.textContent = 'Code Copied!';
    setTimeout(() => (shareCodeEl.textContent = shareCodeLabel), 1500);
  });
});

shareBtn.addEventListener('click', () => {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    shareBtn.textContent = 'Copied!';
    setTimeout(() => (shareBtn.textContent = 'Copy Link'), 1500);
  }).catch(() => {});
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

  winCounts = {};
  if (events) {
    events.forEach((e) => {
      winCounts[e.player_id] = (winCounts[e.player_id] || 0) + 1;
    });
  }
  renderPlayerRoster();
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

  activeInspirationCategory = INSPIRATION_CATEGORIES[0].name;
  renderCategoryPills();
  renderQuoteChips();
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
      chip._handler = () => addInspirationTopic(quote, chip);
      chip.addEventListener('click', chip._handler);
    }
    inspirationChips.appendChild(chip);
  });
}

async function addInspirationTopic(text, chipEl) {
  if (!myPlayer) return;

  // Brief amber pulse animation before dimming
  chipEl.classList.add('inspiration-chip--adding');
  chipEl.removeEventListener('click', chipEl._handler);

  await new Promise((r) => setTimeout(r, 300));
  chipEl.classList.remove('inspiration-chip--adding');
  chipEl.classList.add('inspiration-chip--used');

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

// --- Idea Bank ---

async function loadIdeaBank() {
  if (!session?.user?.id) return;

  const { data, error } = await supabase
    .from('topics')
    .select('text')
    .eq('created_by', session.user.id)
    .neq('board_id', boardId);

  if (error || !data) return;

  // Deduplicate by lowercase text
  const seen = new Set();
  ideaBankTopics = [];
  for (const row of data) {
    const key = row.text.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      ideaBankTopics.push(row.text);
    }
  }

  renderIdeaBank();
}

function renderIdeaBank() {
  if (ideaBankTopics.length === 0) {
    ideaBankEl.classList.add('hidden');
    return;
  }

  ideaBankEl.classList.remove('hidden');
  ideaBankChipsEl.innerHTML = '';

  const existingTexts = new Set(topics.map((t) => t.text.toLowerCase()));

  ideaBankTopics.forEach((text) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    const isUsed = existingTexts.has(text.toLowerCase());
    chip.className = 'inspiration-chip' + (isUsed ? ' inspiration-chip--used' : '');
    chip.textContent = text;
    if (!isUsed) {
      chip._handler = () => addIdeaBankTopic(text, chip);
      chip.addEventListener('click', chip._handler);
    }
    ideaBankChipsEl.appendChild(chip);
  });
}

async function addIdeaBankTopic(text, chipEl) {
  if (!myPlayer) return;

  chipEl.classList.add('inspiration-chip--adding');
  chipEl.removeEventListener('click', chipEl._handler);

  await new Promise((r) => setTimeout(r, 300));
  chipEl.classList.remove('inspiration-chip--adding');
  chipEl.classList.add('inspiration-chip--used');

  // Optimistic: add topic immediately
  const tempId = `temp-${Date.now()}`;
  topics.push({ id: tempId, text, created_by: session.user.id });
  renderTopicList();
  updateTopicCount();
  renderQuoteChips();

  const { data, error } = await supabase
    .from('topics')
    .insert({ board_id: boardId, text, created_by: session.user.id })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to add idea bank topic:', error.message);
    topics = topics.filter((t) => t.id !== tempId);
    renderTopicList();
    updateTopicCount();
    renderQuoteChips();
    renderIdeaBank();
  } else {
    const t = topics.find((t) => t.id === tempId);
    if (t) t.id = data.id;
    renderIdeaBank();
  }
}

// --- Next Round Topics ---

function isInPlayMode() {
  return !playSection.classList.contains('hidden');
}

function renderNextRoundList() {
  const nextTopics = topics.filter((t) => !topicIdsAtGameStart.has(t.id));
  const count = nextTopics.length;

  // Update badge
  if (count > 0) {
    nextRoundBadge.textContent = count;
    nextRoundBadge.classList.remove('hidden');
  } else {
    nextRoundBadge.classList.add('hidden');
  }

  // Render list
  nextRoundList.innerHTML = '';
  nextTopics.forEach((topic) => {
    const canRemove = isCreator() || (session && topic.created_by === session.user.id);
    const el = document.createElement('div');
    el.className = 'topic-item';
    el.innerHTML = `
      <span class="topic-text">${escapeHtml(topic.text)}</span>
      ${canRemove ? `<button class="topic-remove" data-id="${topic.id}" title="Remove">&times;</button>` : ''}
    `;
    nextRoundList.appendChild(el);
  });
  nextRoundList.scrollTop = nextRoundList.scrollHeight;
}

nextRoundToggle.addEventListener('click', () => {
  nextRoundBody.classList.toggle('hidden');
});

nextRoundForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = nextRoundInput.value.trim();
  if (!text) return;

  nextRoundInput.value = '';

  // Optimistic: show topic immediately with a temp id
  const tempId = `temp-${Date.now()}`;
  topics.push({ id: tempId, text, created_by: session.user.id });
  renderNextRoundList();

  const { data, error } = await supabase
    .from('topics')
    .insert({ board_id: boardId, text, created_by: session.user.id })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to add topic:', error.message);
    topics = topics.filter((t) => t.id !== tempId);
    renderNextRoundList();
  } else {
    const t = topics.find((t) => t.id === tempId);
    if (t) t.id = data.id;
  }
  nextRoundInput.focus();
});

nextRoundList.addEventListener('click', async (e) => {
  const btn = e.target.closest('.topic-remove');
  if (!btn) return;
  const id = parseInt(btn.dataset.id);

  const removed = topics.find((t) => t.id === id);
  topics = topics.filter((t) => t.id !== id);
  renderNextRoundList();

  const { error } = await supabase.from('topics').delete().eq('id', id);
  if (error) {
    if (removed) {
      topics.push(removed);
      renderNextRoundList();
    }
  }
});

// --- Go ---
init();
