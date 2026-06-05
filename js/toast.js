// =========================================================
//  toast.js — Toast notification system
// =========================================================

const SUCCESS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const ERROR_ICON   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const INFO_ICON    = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

const ICONS = { success: SUCCESS_ICON, error: ERROR_ICON, info: INFO_ICON };

/**
 * Display a toast notification.
 * @param {string} message  - The text to display
 * @param {'success'|'error'|'info'} type - Toast variant
 * @param {number} duration - Auto-dismiss after ms (default 3500)
 */
export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon">${ICONS[type] || INFO_ICON}</span>
    <span class="toast__message">${message}</span>
  `;

  container.appendChild(toast);

  // Auto-remove
  setTimeout(() => {
    toast.classList.add('toast--leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}
