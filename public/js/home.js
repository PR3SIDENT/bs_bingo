import { supabase } from './supabase-client.js';
import { getSession, getProfile, ensureSession, signInWithGoogle, signInWithMagicLink, signOut, onAuthStateChange } from './auth.js';

const userBar = document.getElementById('user-bar');
const userNameEl = document.getElementById('user-name');
const signInPrompt = document.getElementById('sign-in-prompt');
const showSignInBtn = document.getElementById('show-sign-in-btn');
const authModal = document.getElementById('auth-modal');
const closeAuthModalBtn = document.getElementById('close-auth-modal');
const googleBtn = document.getElementById('google-btn');
const magicForm = document.getElementById('magic-form');
const magicEmailInput = document.getElementById('magic-email');
const magicStatus = document.getElementById('magic-status');
const userNameInput = document.getElementById('user-name-input');
const signOutBtn = document.getElementById('sign-out-btn');
const createForm = document.getElementById('create-form');
const joinForm = document.getElementById('join-form');
const creatorNameInput = document.getElementById('creator-name');

// Landing page (index.html) has no forms — only /create does
const hasAppForms = !!createForm;

let currentProfile = null;

function isAnonymous(session) {
  return session?.user?.is_anonymous === true;
}

function updateUserUI(session, profile) {
  if (!hasAppForms) return;
  if (session && !isAnonymous(session)) {
    const displayName = profile?.display_name || session.user.email || 'Player';
    userNameEl.textContent = displayName;
    userBar.classList.remove('hidden');
    signInPrompt.classList.add('hidden');
  } else {
    userBar.classList.add('hidden');
    signInPrompt.classList.remove('hidden');
  }
}

// Auth state changes
onAuthStateChange(async (session) => {
  if (session && !isAnonymous(session)) {
    const profile = await getProfile(session.user.id);
    updateUserUI(session, profile);
    authModal.classList.add('hidden');
  } else {
    updateUserUI(session, null);
  }
});

// Initial load: ensure session (anonymous if needed), show app immediately
(async () => {
  const session = await ensureSession();
  if (session && !isAnonymous(session)) {
    const profile = await getProfile(session.user.id);
    currentProfile = profile;
    updateUserUI(session, profile);
    // Hide creator name input if user already has a display name
    if (creatorNameInput && profile?.display_name) {
      creatorNameInput.classList.add('hidden');
    }
  } else {
    updateUserUI(session, null);
  }
})();

// --- App form event listeners (only on /create page) ---
if (hasAppForms) {
  // Sign-in modal controls
  showSignInBtn.addEventListener('click', () => {
    authModal.classList.remove('hidden');
  });

  closeAuthModalBtn.addEventListener('click', () => {
    authModal.classList.add('hidden');
  });

  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) authModal.classList.add('hidden');
  });

  // Google sign-in
  googleBtn.addEventListener('click', () => {
    signInWithGoogle();
  });

  // Magic link
  magicForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = magicEmailInput.value.trim();
    if (!email) return;

    const btn = magicForm.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    magicStatus.textContent = '';

    const { error } = await signInWithMagicLink(email);
    if (error) {
      magicStatus.textContent = error.message;
      magicStatus.style.color = '#f43f5e';
    } else {
      magicStatus.textContent = 'Check your email for a login link!';
      magicStatus.style.color = '#22c55e';
    }
    btn.disabled = false;
    btn.textContent = 'Send Magic Link';
  });

  // Sign out
  signOutBtn.addEventListener('click', () => signOut());

  // Inline name editing
  userNameEl.addEventListener('click', () => {
    userNameInput.value = userNameEl.textContent;
    userNameEl.classList.add('hidden');
    userNameInput.classList.remove('hidden');
    userNameInput.focus();
    userNameInput.select();
  });

  async function saveName() {
    const newName = userNameInput.value.trim();
    userNameInput.classList.add('hidden');
    userNameEl.classList.remove('hidden');

    if (!newName || newName === userNameEl.textContent) return;

    const session = await getSession();
    if (!session) return;

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: newName })
      .eq('id', session.user.id);

    if (error) {
      console.error('Failed to update name:', error.message);
      return;
    }
    userNameEl.textContent = newName;
  }

  userNameInput.addEventListener('blur', saveName);
  userNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); userNameInput.blur(); }
    if (e.key === 'Escape') { userNameInput.classList.add('hidden'); userNameEl.classList.remove('hidden'); }
  });

  // Create board
  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('board-name').value.trim();
    if (!name) return;

    const btn = createForm.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    const session = await ensureSession();
    if (!session) {
      btn.disabled = false;
      btn.textContent = 'Create Board';
      return;
    }

    // Store pending name for auto-join on board page
    const creatorName = creatorNameInput ? creatorNameInput.value.trim() : '';
    const pendingName = creatorName || currentProfile?.display_name || '';
    if (pendingName) {
      try { localStorage.setItem('pending_name', pendingName); } catch {}
    }

    // Generate short ID
    const id = crypto.randomUUID().split('-')[0];

    const { data, error } = await supabase
      .from('boards')
      .insert({ id, name, created_by: session.user.id })
      .select()
      .single();

    if (error) {
      console.error('Failed to create board:', error.message, error);
      btn.disabled = false;
      btn.textContent = "Let's Go";
      return;
    }

    console.log('Board created:', data);

    // Smooth fade-out before navigating
    const main = document.querySelector('.home');
    if (main) {
      main.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      main.style.opacity = '0';
      main.style.transform = 'scale(0.98)';
      await new Promise((r) => setTimeout(r, 350));
    }
    window.location.href = `/${id}`;
  });

  // Join board
  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('board-code').value.trim();
    if (!input) return;

    let code = input;
    try {
      const url = new URL(input);
      code = url.pathname.replace(/^\//, '');
    } catch {
      // Not a URL, use as-is
    }

    if (code) {
      window.location.href = `/${code}`;
    }
  });
}

// ========== Quote Wall ==========
const featuredQuotes = new Set([
  "When are you having kids?",
  "Nobody wants to work anymore.",
  "Do your own research.",
  "Are you still single?",
  "We're like a family here.",
  "I'm not mad, I'm disappointed.",
]);

const allQuotes = [
  "Back in my day...",
  "When are you having kids?",
  "Nobody wants to work anymore.",
  "You should buy a house.",
  "I saw on Facebook...",
  "Have you tried yoga?",
  "Sleep when you're dead.",
  "Do your own research.",
  "Per my last email...",
  "Are you still single?",
  "We're like a family here.",
  "You're not getting any younger.",
  "Kids these days...",
  "Wake up, sheeple.",
  "I barely slept.",
  "I'm not mad, I'm disappointed.",
  "Just be positive!",
  "That's what they want you to think.",
  "I forgot to eat today.",
  "I just think it's funny how...",
  "Whatever you want.",
  "They don't want you to know.",
  "When I was your age...",
  "You should start a podcast.",
  "Not political, but...",
];

function populateQuotes(container) {
  const shuffled = [...allQuotes].sort(() => Math.random() - 0.5);

  shuffled.forEach((text, i) => {
    const el = document.createElement('span');
    const isFeatured = featuredQuotes.has(text);
    const isAmber = i % 3 === 0;
    const sizeClass = isFeatured ? 'fq--xl' : ['fq--sm', '', '', 'fq--lg'][i % 4];

    el.className = 'fq'
      + (sizeClass ? ' ' + sizeClass : '')
      + (isAmber ? ' fq--amber' : '');
    el.textContent = text;
    el.style.setProperty('--fq-d', (i * 0.04) + 's');
    // Slow drift after appear
    const driftDuration = 6 + (i % 5) * 2; // 6-14s varied
    const driftDelay = (i * 0.04) + 0.5; // after appear finishes
    el.style.setProperty('--fq-drift', driftDuration + 's');
    el.style.setProperty('--fq-drift-d', driftDelay + 's');
    container.appendChild(el);
  });
}

const fqContainer = document.getElementById('floating-quotes');
if (fqContainer) populateQuotes(fqContainer);

const createQuotesContainer = document.getElementById('create-quotes');
if (createQuotesContainer) populateQuotes(createQuotesContainer);

// ========== Landing Page Animations ==========

// --- Scroll reveal via IntersectionObserver ---
const revealEls = document.querySelectorAll('.reveal');
if (revealEls.length) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  revealEls.forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.1}s`;
    revealObserver.observe(el);
  });
}

// --- Flipper: word rotation with sizer ---
function initFlipper(el, words) {
  if (!el) return;

  // If a word list is provided, generate the flipper-text spans dynamically
  if (words) {
    const sizer = el.querySelector('.flipper-sizer');
    const existingTexts = el.querySelectorAll('.flipper-text');
    existingTexts.forEach(t => t.remove());

    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'flipper-text' + (i === 0 ? ' active' : '');
      span.textContent = w;
      el.appendChild(span);
    });

    if (sizer) sizer.textContent = words[0];
  }

  const texts = el.querySelectorAll('.flipper-text');
  let current = 0;

  // Create an invisible sizer span if one doesn't exist
  let sizer = el.querySelector('.flipper-sizer');
  if (!sizer) {
    sizer = document.createElement('span');
    sizer.className = 'flipper-sizer';
    sizer.textContent = texts[current].textContent;
    el.prepend(sizer);
  }

  setInterval(() => {
    const prev = current;
    current = (current + 1) % texts.length;

    texts[prev].classList.remove('active');
    sizer.textContent = texts[current].textContent;
    texts[current].classList.add('active');
  }, 2400);
}

// Landing page flipper
initFlipper(document.getElementById('flipper'));

// Create page flipper
initFlipper(document.getElementById('create-flipper'), [
  'redundant', 'mundane', 'annoying', 'repetitive',
  'loathsome', 'predictable', 'exhausting', 'insufferable'
]);

// --- Example card auto-marking ---
const demoGrid = document.getElementById('demo-grid');
if (demoGrid) {
  const demoCells = Array.from(demoGrid.querySelectorAll('.demo-cell:not(.demo-free)'));
  const marked = new Set();

  function autoMark() {
    if (marked.size >= demoCells.length) {
      // Reset all marks, start over
      demoCells.forEach((c) => c.classList.remove('auto-mark'));
      marked.clear();
    }

    let idx;
    do {
      idx = Math.floor(Math.random() * demoCells.length);
    } while (marked.has(idx));

    marked.add(idx);
    demoCells[idx].classList.add('auto-mark');
  }

  // Start after the section scrolls into view
  const demoObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      demoObserver.disconnect();
      // Mark a few cells with staggered timing
      let delay = 800;
      for (let i = 0; i < 5; i++) {
        setTimeout(autoMark, delay);
        delay += 1200;
      }
      // Then keep marking on an interval
      setInterval(autoMark, 3000);
    }
  }, { threshold: 0.3 });

  demoObserver.observe(demoGrid);
}


// --- Hide scroll hint on first scroll ---
const scrollHint = document.querySelector('.scroll-hint');
if (scrollHint) {
  const hideHint = () => {
    scrollHint.style.opacity = '0';
    scrollHint.style.transition = 'opacity 0.4s ease';
    window.removeEventListener('scroll', hideHint);
  };
  window.addEventListener('scroll', hideHint, { passive: true });
}
