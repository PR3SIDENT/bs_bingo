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

function isAnonymous(session) {
  return session?.user?.is_anonymous === true;
}

function updateUserUI(session, profile) {
  if (session && !isAnonymous(session)) {
    // Signed-in user: show user bar, hide sign-in prompt
    const displayName = profile?.display_name || session.user.email || 'Player';
    userNameEl.textContent = displayName;
    userBar.classList.remove('hidden');
    signInPrompt.classList.add('hidden');
  } else {
    // Anonymous or no session: hide user bar, show sign-in prompt
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
    updateUserUI(session, profile);
  } else {
    updateUserUI(session, null);
  }
})();

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

  // Generate short ID
  const id = crypto.randomUUID().split('-')[0];

  const { error } = await supabase
    .from('boards')
    .insert({ id, name, created_by: session.user.id });

  if (error) {
    console.error('Failed to create board:', error.message);
    btn.disabled = false;
    btn.textContent = 'Create Board';
    return;
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
