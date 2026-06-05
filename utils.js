// =========================================================
//  utils.js — Shared utility functions
// =========================================================

/** Get 1-2 character initials from a display name */
export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Escape HTML to prevent XSS */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format a Firestore timestamp as a relative or absolute date string */
export function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff  = (Date.now() - date.getTime()) / 1000;

  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Format a date as short month + year (e.g. "Jun 2026") */
export function formatMonthYear(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/** Build an avatar element — returns the DOM element */
export function buildAvatarEl(size, displayName, photoURL) {
  const el = document.createElement('div');
  el.className = `avatar avatar--${size}`;
  if (photoURL) {
    const img = document.createElement('img');
    img.src = photoURL;
    img.alt = displayName;
    el.appendChild(img);
  } else {
    el.textContent = getInitials(displayName);
  }
  return el;
}
