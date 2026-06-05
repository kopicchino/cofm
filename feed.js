// =========================================================
//  feed.js — Live memory feed, like, comment, delete
// =========================================================

import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { ref, deleteObject } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

import { auth, db, storage } from "./init.js";
import { showToast }          from "./toast.js";
import { escapeHtml, formatDate, buildAvatarEl } from "./utils.js";

// SVG icon strings (no emoji)
const ICON_HEART        = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const ICON_HEART_FILLED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const ICON_COMMENT      = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const ICON_TRASH        = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
const ICON_EXPAND       = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
const ICON_SEND         = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

let allMemories     = [];
let unsubscribeFeed = null;
let showOwnOnly     = false;

// ── Lightbox ──────────────────────────────────────────────
function openLightbox(url) {
  const lb    = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  if (!lb || !lbImg) return;
  lbImg.src = url;
  lb.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  lb.classList.add('hidden');
  document.getElementById('lightbox-img').src = '';
  document.body.style.overflow = '';
}

export function initLightbox() {
  document.getElementById('lightbox-close')?.addEventListener('click', closeLightbox);
  document.getElementById('lightbox')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

// ── Build a single memory card DOM element ────────────────
function buildMemoryCard(memory) {
  const uid   = auth.currentUser?.uid;
  const own   = uid && memory.userId === uid;
  const liked = uid && Array.isArray(memory.likes) && memory.likes.includes(uid);

  const displayName = memory.displayName || memory.username || 'User';
  const photoURL    = memory.userPhotoURL || '';

  const card = document.createElement('article');
  card.className = 'memory-card';
  card.setAttribute('role', 'listitem');
  card.setAttribute('data-id', memory.id);

  // Image section
  const imgWrap = document.createElement('div');
  imgWrap.className = 'memory-img-wrap';
  imgWrap.innerHTML = `
    <img src="${memory.imageUrl}" alt="Memory by ${escapeHtml(displayName)}" loading="lazy" />
    <div class="memory-img-overlay">
      <span class="expand-hint">${ICON_EXPAND} View full size</span>
    </div>
  `;
  imgWrap.addEventListener('click', () => openLightbox(memory.imageUrl));

  // Body
  const body = document.createElement('div');
  body.className = 'memory-body';

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'memory-meta';

  const authorWrap = document.createElement('div');
  authorWrap.className = 'memory-author';
  authorWrap.appendChild(buildAvatarEl('xs', displayName, photoURL));
  const authorName = document.createElement('span');
  authorName.className = 'author-name';
  authorName.textContent = displayName;
  authorWrap.appendChild(authorName);
  if (own) {
    const badge = document.createElement('span');
    badge.className = 'badge badge-accent';
    badge.textContent = 'You';
    authorWrap.appendChild(badge);
  }

  const time = document.createElement('span');
  time.className = 'memory-time';
  time.textContent = formatDate(memory.createdAt);

  meta.appendChild(authorWrap);
  meta.appendChild(time);

  // Caption
  let captionEl = null;
  if (memory.caption) {
    captionEl = document.createElement('p');
    captionEl.className = 'memory-caption';
    captionEl.textContent = memory.caption;
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'memory-actions';

  // Like button
  const likeBtn = document.createElement('button');
  likeBtn.className = `action-btn${liked ? ' action-btn--liked' : ''}`;
  likeBtn.innerHTML = `${liked ? ICON_HEART_FILLED : ICON_HEART} <span>${memory.likes?.length || 0}</span>`;
  likeBtn.setAttribute('aria-label', liked ? 'Unlike' : 'Like');
  likeBtn.addEventListener('click', async () => {
    if (!auth.currentUser) return showToast('Sign in to like memories.', 'info');
    const memRef = doc(db, 'memories', memory.id);
    await updateDoc(memRef, {
      likes: liked ? arrayRemove(uid) : arrayUnion(uid)
    });
  });

  // Comment toggle
  const commentBtn = document.createElement('button');
  commentBtn.className = 'action-btn';
  commentBtn.innerHTML = `${ICON_COMMENT} <span>${memory.comments?.length || 0}</span>`;
  commentBtn.setAttribute('aria-expanded', 'false');

  // Delete (own only)
  let deleteBtn = null;
  if (own) {
    deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn action-btn--delete';
    deleteBtn.innerHTML = ICON_TRASH;
    deleteBtn.setAttribute('aria-label', 'Delete memory');
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Delete this memory permanently?')) return;
      try {
        if (memory.storagePath) {
          await deleteObject(ref(storage, memory.storagePath)).catch(() => {});
        }
        await deleteDoc(doc(db, 'memories', memory.id));
        showToast('Memory deleted.', 'info');
      } catch (err) {
        showToast('Could not delete. Try again.', 'error');
      }
    });
  }

  actions.appendChild(likeBtn);
  actions.appendChild(commentBtn);
  if (deleteBtn) actions.appendChild(deleteBtn);

  // Comment section
  const commentSection = document.createElement('div');
  commentSection.className = 'comment-section hidden';

  const inputRow = document.createElement('div');
  inputRow.className = 'comment-input-row';
  const commentInput = document.createElement('textarea');
  commentInput.placeholder = 'Add a comment...';
  commentInput.setAttribute('aria-label', 'Write a comment');
  commentInput.rows = 1;
  const sendBtn = document.createElement('button');
  sendBtn.className = 'send-btn';
  sendBtn.innerHTML = ICON_SEND;
  sendBtn.setAttribute('aria-label', 'Post comment');
  sendBtn.addEventListener('click', async () => {
    if (!auth.currentUser) return showToast('Sign in to comment.', 'info');
    const text = commentInput.value.trim();
    if (!text) return;
    const memRef = doc(db, 'memories', memory.id);
    await updateDoc(memRef, {
      comments: arrayUnion({
        id:          `${uid}_${Date.now()}`,
        userId:      uid,
        username:    auth.currentUser.email?.split('@')[0] || 'user',
        displayName: memory.displayName || auth.currentUser.email?.split('@')[0] || 'user',
        text,
        createdAt:   new Date().toISOString(),
      })
    });
    commentInput.value = '';
    showToast('Comment posted.', 'success', 2000);
  });
  inputRow.appendChild(commentInput);
  inputRow.appendChild(sendBtn);

  const commentList = document.createElement('div');
  commentList.className = 'comment-list';

  const sorted = [...(memory.comments || [])].sort((a, b) =>
    new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  if (sorted.length) {
    sorted.forEach((c) => {
      const item = document.createElement('div');
      item.className = 'comment-item';
      const cName = c.displayName || c.username || 'User';
      item.innerHTML = `
        ${buildAvatarEl('xs', cName, '').outerHTML}
        <div class="comment-content">
          <div class="comment-author">${escapeHtml(cName)}</div>
          <div class="comment-text">${escapeHtml(c.text)}</div>
        </div>`;
      commentList.appendChild(item);
    });
  } else {
    const empty = document.createElement('p');
    empty.className = 'comment-empty';
    empty.textContent = 'No comments yet. Be the first!';
    commentList.appendChild(empty);
  }

  commentSection.appendChild(inputRow);
  commentSection.appendChild(commentList);

  // Toggle comments
  commentBtn.addEventListener('click', () => {
    const open = commentSection.classList.toggle('hidden');
    commentBtn.setAttribute('aria-expanded', String(!open));
  });

  // Assemble body
  body.appendChild(meta);
  if (captionEl) body.appendChild(captionEl);
  body.appendChild(actions);
  body.appendChild(commentSection);

  card.appendChild(imgWrap);
  card.appendChild(body);

  return card;
}

// ── Render / filter / sort the feed ──────────────────────
export function renderFeed() {
  const feedList    = document.getElementById('feed-list');
  const searchInput = document.getElementById('search-input');
  const sortSelect  = document.getElementById('sort-select');
  const statTotal   = document.getElementById('stat-total-label');
  const statMine    = document.getElementById('stat-mine-label');

  if (!feedList) return;

  const term = searchInput?.value.trim().toLowerCase() || '';
  const sort = sortSelect?.value || 'newest';
  const uid  = auth.currentUser?.uid;

  let list = allMemories.filter((m) => {
    if (showOwnOnly && uid && m.userId !== uid) return false;
    if (!term) return true;
    const cap  = (m.caption || '').toLowerCase();
    const name = (m.displayName || m.username || '').toLowerCase();
    return cap.includes(term) || name.includes(term);
  });

  if (sort === 'oldest') list = [...list].reverse();
  else if (sort === 'most-liked') list = [...list].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));

  // Stats
  const mineCount = uid ? allMemories.filter(m => m.userId === uid).length : 0;
  if (statTotal) statTotal.textContent = `${allMemories.length} ${allMemories.length === 1 ? 'memory' : 'memories'}`;
  if (statMine)  statMine.textContent  = `${mineCount} yours`;

  feedList.innerHTML = '';

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'feed-empty';
    empty.innerHTML = `
      <div class="feed-empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      </div>
      <p>No memories found</p>
      <span>${term ? `No results for "${escapeHtml(term)}"` : showOwnOnly ? 'You have not uploaded anything yet.' : 'Be the first to upload a memory!'}</span>`;
    feedList.appendChild(empty);
    return;
  }

  list.forEach((m) => feedList.appendChild(buildMemoryCard(m)));
}

// ── Subscribe to Firestore live feed ──────────────────────
export function subscribeFeed() {
  if (unsubscribeFeed) { unsubscribeFeed(); unsubscribeFeed = null; }
  const q = query(collection(db, 'memories'), orderBy('createdAt', 'desc'));
  unsubscribeFeed = onSnapshot(q, (snap) => {
    allMemories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFeed();
  }, (err) => {
    console.error('Feed subscription error:', err);
    showToast('Could not load feed. Check console for details.', 'error');
  });
}

export function unsubFeed() {
  if (unsubscribeFeed) { unsubscribeFeed(); unsubscribeFeed = null; }
}

// ── Wire up feed page controls ────────────────────────────
export function initFeedPage() {
  document.getElementById('search-input')?.addEventListener('input', renderFeed);
  document.getElementById('sort-select')?.addEventListener('change', renderFeed);

  const filterBtn = document.getElementById('filter-mine-btn');
  filterBtn?.addEventListener('click', () => {
    showOwnOnly = !showOwnOnly;
    filterBtn.textContent = showOwnOnly ? 'Show All' : 'My Uploads';
    filterBtn.classList.toggle('btn-active', showOwnOnly);
    filterBtn.setAttribute('aria-pressed', String(showOwnOnly));
    renderFeed();
  });
}
