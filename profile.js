// =========================================================
//  profile.js — Load, display, and save the user's profile.
//               Also renders the "My Memories" thumbnail grid.
// =========================================================

import {
  doc, getDoc, setDoc, updateDoc, collection, query,
  where, orderBy, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { auth, db }           from "./init.js";
import { showToast }           from "./toast.js";
import { formatMonthYear, getInitials } from "./utils.js";
import { setAvatarEl }         from "./auth.js";

// ─── Cloudinary config for avatar uploads ────────────────
const CLOUDINARY_CLOUD_NAME    = 'dixidxpca';
const CLOUDINARY_UPLOAD_PRESET = 'cofm111';

// ─── DOM helpers ─────────────────────────────────────────
const getEl = (id) => document.getElementById(id);

// ─── Load profile from Firestore ─────────────────────────
async function fetchProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

// ─── Render profile data into form ───────────────────────
function populateForm(profile, user) {
  const nameInput  = getEl('display-name-input');
  const bioInput   = getEl('bio-input');
  const emailEl    = getEl('profile-email');
  const avatarEl   = getEl('profile-avatar');
  const bioCount   = getEl('bio-count');
  const joinedEl   = getEl('profile-stat-joined');

  if (nameInput)  nameInput.value  = profile?.displayName || user.email?.split('@')[0] || '';
  if (bioInput)   bioInput.value   = profile?.bio || '';
  if (emailEl)    emailEl.textContent = user.email || '';
  if (bioCount)   bioCount.textContent = `${(profile?.bio || '').length} / 160`;
  if (joinedEl)   joinedEl.textContent = profile?.createdAt
    ? formatMonthYear(profile.createdAt) : '-';

  setAvatarEl(avatarEl, profile?.displayName || user.email?.split('@')[0] || '?', profile?.photoURL || '');
}

// ─── Load user's memory count + likes received ───────────
async function loadProfileStats(uid) {
  try {
    const q    = query(collection(db, 'memories'), where('userId', '==', uid));
    const snap = await getDocs(q);
    const memories = snap.docs.map(d => d.data());

    const memCount   = memories.length;
    const likesTotal = memories.reduce((sum, m) => sum + (m.likes?.length || 0), 0);

    const memEl   = getEl('profile-stat-memories');
    const likeEl  = getEl('profile-stat-likes');
    if (memEl)  memEl.textContent  = memCount;
    if (likeEl) likeEl.textContent = likesTotal;

    return memories;
  } catch (err) {
    console.error('Profile stats error:', err);
    return [];
  }
}

// ─── Render "My Memories" thumbnail grid ─────────────────
function renderMyMemories(memories) {
  const grid = getEl('my-memories-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!memories.length) {
    grid.innerHTML = '<p class="my-memories-empty">No memories uploaded yet.</p>';
    return;
  }

  // Sort newest first
  const sorted = [...memories].sort((a, b) => {
    const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bt - at;
  });

  sorted.forEach((m) => {
    const thumb = document.createElement('div');
    thumb.className = 'my-memory-thumb';
    thumb.innerHTML = `
      <img src="${m.imageUrl}" alt="${m.caption || 'Memory'}" loading="lazy" />
      <div class="my-memory-thumb-overlay">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
          <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
      </div>`;
    thumb.addEventListener('click', () => {
      const lb    = document.getElementById('lightbox');
      const lbImg = document.getElementById('lightbox-img');
      if (lb && lbImg) {
        lbImg.src = m.imageUrl;
        lb.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      }
    });
    grid.appendChild(thumb);
  });
}

// ─── Upload avatar to Cloudinary ──────────────────────────
async function uploadAvatar(file) {
  if (CLOUDINARY_UPLOAD_PRESET === 'YOUR_UPLOAD_PRESET') {
    showToast('Set up Cloudinary preset in js/profile.js first.', 'error', 5000);
    return null;
  }
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  fd.append('folder', 'circle-avatars');

  const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST', body: fd
  });
  if (!res.ok) throw new Error('Avatar upload failed.');
  const data = await res.json();
  return data.secure_url;
}

// ─── Initialize profile page ──────────────────────────────
export async function initProfilePage() {
  const user = auth.currentUser;
  if (!user) return;

  // Load and populate
  const profile  = await fetchProfile(user.uid);
  populateForm(profile, user);
  const memories = await loadProfileStats(user.uid);
  renderMyMemories(memories);

  // Bio char counter
  const bioInput = getEl('bio-input');
  const bioCount = getEl('bio-count');
  bioInput?.addEventListener('input', () => {
    const len = bioInput.value.length;
    if (bioCount) bioCount.textContent = `${len} / 160`;
  });

  // Avatar change button
  const avatarBtn   = getEl('change-avatar-btn');
  const avatarInput = getEl('avatar-input');
  avatarBtn?.addEventListener('click', () => avatarInput?.click());
  avatarInput?.addEventListener('change', async () => {
    const file = avatarInput.files[0];
    if (!file) return;
    showToast('Uploading avatar...', 'info', 2000);
    try {
      const url = await uploadAvatar(file);
      if (!url) return;
      await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
      setAvatarEl(getEl('profile-avatar'), profile?.displayName || '', url);
      setAvatarEl(document.getElementById('sidebar-avatar'), profile?.displayName || '', url);
      setAvatarEl(document.getElementById('mobile-avatar'), profile?.displayName || '', url);
      showToast('Profile picture updated!', 'success');
    } catch (err) {
      showToast('Avatar upload failed: ' + err.message, 'error');
    }
  });

  // Save profile form
  const form = getEl('profile-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn  = getEl('profile-save');
    const name = getEl('display-name-input')?.value.trim();
    const bio  = getEl('bio-input')?.value.trim();

    if (!name) { showToast('Display name cannot be empty.', 'error'); return; }

    const label = btn?.querySelector('.btn-label');
    if (btn)    btn.disabled = true;
    if (label)  label.textContent = 'Saving...';

    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName: name,
        bio:         bio || '',
        updatedAt:   serverTimestamp(),
      }, { merge: true });

      // Update sidebar name
      const sidebarName = document.getElementById('sidebar-display-name');
      if (sidebarName) sidebarName.textContent = name;

      showToast('Profile saved!', 'success');
    } catch (err) {
      showToast('Could not save profile: ' + err.message, 'error');
    } finally {
      if (btn)   btn.disabled = false;
      if (label) label.textContent = 'Save Changes';
    }
  });
}
