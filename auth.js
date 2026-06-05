// =========================================================
//  auth.js — Login, Register, Logout, Auth state
// =========================================================

import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { auth, db }    from "./init.js";
import { showToast }   from "./toast.js";
import { getInitials } from "./utils.js";

// ── Friendly error messages ───────────────────────────────
const ERROR_MAP = {
  'auth/user-not-found':       'No account found with that email.',
  'auth/wrong-password':       'Incorrect password. Please try again.',
  'auth/invalid-credential':   'Invalid email or password.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email':        'Please enter a valid email address.',
  'auth/weak-password':        'Password must be at least 6 characters.',
  'auth/too-many-requests':    'Too many attempts — please wait a moment.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

function friendlyError(code) {
  return ERROR_MAP[code] || 'Something went wrong. Please try again.';
}

// ── Create user profile document in Firestore ─────────────
async function createUserProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return; // already created

  const username = user.email?.split('@')[0] || 'user';
  await setDoc(ref, {
    uid:         user.uid,
    email:       user.email,
    displayName: username,
    bio:         '',
    photoURL:    '',
    createdAt:   serverTimestamp(),
    memoryCount: 0,
  });
}

// ── Button loading helper ─────────────────────────────────
function setLoading(btn, loading, defaultLabel) {
  const label = btn.querySelector('.btn-label');
  btn.disabled = loading;
  if (label) label.textContent = loading ? 'Please wait...' : defaultLabel;
}

// ── Initialize auth event listeners ──────────────────────
export function initAuth() {
  const loginForm     = document.getElementById('login-form');
  const registerForm  = document.getElementById('register-form');
  const showLoginBtn  = document.getElementById('show-login');
  const showRegBtn    = document.getElementById('show-register');
  const authError     = document.getElementById('auth-error');
  const logoutBtn     = document.getElementById('logout-btn');

  // Tab switching
  function showTab(tab) {
    const isLogin = tab === 'login';
    showLoginBtn.classList.toggle('tab-btn--active', isLogin);
    showRegBtn.classList.toggle('tab-btn--active', !isLogin);
    showLoginBtn.setAttribute('aria-selected', String(isLogin));
    showRegBtn.setAttribute('aria-selected', String(!isLogin));
    loginForm.classList.toggle('hidden', !isLogin);
    registerForm.classList.toggle('hidden', isLogin);
    authError.textContent = '';
  }

  showLoginBtn?.addEventListener('click', () => showTab('login'));
  showRegBtn?.addEventListener('click',   () => showTab('register'));

  // Login submit
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';
    const btn   = document.getElementById('login-submit');
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-password').value;
    setLoading(btn, true, 'Sign In');
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      authError.textContent = friendlyError(err.code);
      setLoading(btn, false, 'Sign In');
    }
  });

  // Register submit
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';
    const btn   = document.getElementById('register-submit');
    const email = document.getElementById('register-email').value.trim();
    const pass  = document.getElementById('register-password').value;
    setLoading(btn, true, 'Create Account');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await createUserProfile(cred.user);
    } catch (err) {
      authError.textContent = friendlyError(err.code);
      setLoading(btn, false, 'Create Account');
    }
  });

  // Logout
  logoutBtn?.addEventListener('click', async () => {
    await signOut(auth);
    showToast('You have been signed out.', 'info');
  });
}

// ── Auth state observer ───────────────────────────────────
/**
 * @param {(user: import('firebase/auth').User) => void} onLogin
 * @param {() => void} onLogout
 */
export function watchAuthState(onLogin, onLogout) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Ensure profile document exists (handles OAuth or manual creation)
      await createUserProfile(user);

      // Update sidebar user info
      const username    = user.email?.split('@')[0] || 'user';
      const profileRef  = doc(db, 'users', user.uid);
      const profileSnap = await getDoc(profileRef);
      const profile     = profileSnap.exists() ? profileSnap.data() : {};

      const displayName = profile.displayName || username;
      const photoURL    = profile.photoURL || '';

      const nameEl   = document.getElementById('sidebar-display-name');
      const emailEl  = document.getElementById('sidebar-email');
      const avatarEl = document.getElementById('sidebar-avatar');
      const mobAvatarEl = document.getElementById('mobile-avatar');

      if (nameEl)  nameEl.textContent  = displayName;
      if (emailEl) emailEl.textContent = user.email;

      setAvatarEl(avatarEl,   displayName, photoURL);
      setAvatarEl(mobAvatarEl, displayName, photoURL);

      onLogin(user, profile);
    } else {
      onLogout();
    }
  });
}

// ── Avatar helper ─────────────────────────────────────────
export function setAvatarEl(el, displayName, photoURL) {
  if (!el) return;
  if (photoURL) {
    el.innerHTML = `<img src="${photoURL}" alt="${displayName}" />`;
  } else {
    el.textContent = getInitials(displayName);
  }
}
