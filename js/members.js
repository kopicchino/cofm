// =========================================================
//  members.js — Load and display the members directory
// =========================================================

import {
  collection, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { db }         from "./init.js";
import { showToast }  from "./toast.js";
import { getInitials, formatMonthYear } from "./utils.js";

const ICON_IMAGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

let allMembers = [];

// ─── Build a member card DOM element ─────────────────────
function buildMemberCard(user, memCount) {
  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const username    = user.email?.split('@')[0] || 'user';

  const card = document.createElement('div');
  card.className = 'member-card';
  card.setAttribute('role', 'listitem');

  // Avatar
  const avatarEl = document.createElement('div');
  avatarEl.className = 'member-header';

  const av = document.createElement('div');
  av.className = 'avatar avatar--md';
  if (user.photoURL) {
    av.innerHTML = `<img src="${user.photoURL}" alt="${displayName}" />`;
  } else {
    av.textContent = getInitials(displayName);
  }

  const info = document.createElement('div');
  info.className = 'member-info';
  info.innerHTML = `
    <p class="member-name">${displayName}</p>
    <p class="member-username">@${username}</p>
  `;

  avatarEl.appendChild(av);
  avatarEl.appendChild(info);

  // Bio
  const bio = document.createElement('p');
  bio.className = 'member-bio';
  bio.textContent = user.bio || 'No bio yet.';

  // Footer stats
  const footer = document.createElement('div');
  footer.className = 'member-footer';
  footer.innerHTML = `
    <span class="member-stat">
      ${ICON_IMAGE}
      <strong>${memCount}</strong> ${memCount === 1 ? 'memory' : 'memories'}
    </span>
    <span class="member-stat">
      Joined ${user.createdAt ? formatMonthYear(user.createdAt) : '—'}
    </span>
  `;

  card.appendChild(avatarEl);
  card.appendChild(bio);
  card.appendChild(footer);
  return card;
}

// ─── Render members list with optional search filter ─────
function renderMembers(searchTerm = '') {
  const grid = document.getElementById('members-grid');
  if (!grid) return;

  grid.innerHTML = '';
  const term = searchTerm.toLowerCase().trim();

  const filtered = term
    ? allMembers.filter((m) => {
        const name = (m.displayName || '').toLowerCase();
        const user = (m.email || '').toLowerCase();
        const bio  = (m.bio || '').toLowerCase();
        return name.includes(term) || user.includes(term) || bio.includes(term);
      })
    : allMembers;

  if (!filtered.length) {
    grid.innerHTML = `<p class="members-empty">${
      term ? `No members found matching "${searchTerm}".` : 'No members have joined yet.'
    }</p>`;
    return;
  }

  filtered.forEach((m) => {
    grid.appendChild(buildMemberCard(m, m._memCount || 0));
  });
}

// ─── Fetch all users + their memory counts ───────────────
export async function loadMembers() {
  const grid = document.getElementById('members-grid');
  if (!grid) return;

  try {
    // Load all users
    const usersSnap = await getDocs(collection(db, 'users'));
    const users     = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Load memory counts per user (use stored memoryCount if available)
    // For accuracy, also tally from memories collection
    let memoryCounts = {};
    try {
      const memSnap = await getDocs(collection(db, 'memories'));
      memSnap.docs.forEach(d => {
        const uid = d.data().userId;
        if (uid) memoryCounts[uid] = (memoryCounts[uid] || 0) + 1;
      });
    } catch (_) { /* non-critical */ }

    allMembers = users.map(u => ({
      ...u,
      _memCount: memoryCounts[u.uid] || u.memoryCount || 0,
    }));

    renderMembers();
  } catch (err) {
    console.error('Members load error:', err);
    showToast('Could not load members.', 'error');
  }
}

// ─── Wire up members search ───────────────────────────────
export function initMembersPage() {
  const searchInput = document.getElementById('members-search');
  searchInput?.addEventListener('input', () => {
    renderMembers(searchInput.value);
  });
}
