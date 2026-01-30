import { supabase } from './supabase-client.js';
import { getSession, getUser, getProfile, signInWithGoogle, signInWithMagicLink, signOut, onAuthStateChange } from './auth.js';

const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const userNameEl = document.getElementById('user-name');
const googleBtn = document.getElementById('google-btn');
const magicForm = document.getElementById('magic-form');
const magicEmailInput = document.getElementById('magic-email');
const magicStatus = document.getElementById('magic-status');
const signOutBtn = document.getElementById('sign-out-btn');
const createForm = document.getElementById('create-form');
const joinForm = document.getElementById('join-form');

function showAuth() {
  authSection.classList.remove('hidden');
  appSection.classList.add('hidden');
}

function showApp(displayName) {
  authSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  userNameEl.textContent = displayName || 'Player';
}

// Auth state
onAuthStateChange(async (session) => {
  if (session) {
    const profile = await getProfile(session.user.id);
    showApp(profile?.display_name || session.user.email);
  } else {
    showAuth();
  }
});

// Initial check
(async () => {
  const session = await getSession();
  if (session) {
    const profile = await getProfile(session.user.id);
    showApp(profile?.display_name || session.user.email);
  } else {
    showAuth();
  }
})();

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

// Create board
createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('board-name').value.trim();
  if (!name) return;

  const btn = createForm.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  const session = await getSession();
  if (!session) { showAuth(); return; }

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
