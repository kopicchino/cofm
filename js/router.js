// =========================================================
//  router.js — SPA page navigation
// =========================================================

const PAGES = ['feed', 'upload', 'members', 'profile'];

/** Navigate to a named page, hiding all others */
export function navigateTo(pageName) {
  if (!PAGES.includes(pageName)) return;

  // Show/hide page sections
  PAGES.forEach((p) => {
    const section = document.getElementById(`page-${p}`);
    if (section) section.classList.toggle('hidden', p !== pageName);
  });

  // Update sidebar nav links
  document.querySelectorAll('.nav-link').forEach((link) => {
    const isActive = link.dataset.page === pageName;
    link.classList.toggle('nav-link--active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  // Scroll main content to top
  const main = document.querySelector('.main-content');
  if (main) main.scrollTo({ top: 0, behavior: 'smooth' });

  // Close mobile sidebar if open
  closeMobileSidebar();
}

/** Get the currently active page name */
export function getCurrentPage() {
  for (const p of PAGES) {
    const section = document.getElementById(`page-${p}`);
    if (section && !section.classList.contains('hidden')) return p;
  }
  return 'feed';
}

/** Wire up sidebar nav clicks */
export function initRouter(onNavigate) {
  document.querySelectorAll('.nav-link[data-page]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      navigateTo(page);
      if (typeof onNavigate === 'function') onNavigate(page);
    });
  });

  // Mobile menu toggle
  const menuToggle = document.getElementById('mobile-menu-toggle');
  const overlay    = document.getElementById('sidebar-overlay');

  menuToggle?.addEventListener('click', () => {
    toggleMobileSidebar();
  });
  overlay?.addEventListener('click', () => {
    closeMobileSidebar();
  });
}

function toggleMobileSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const toggle   = document.getElementById('mobile-menu-toggle');
  const isOpen   = sidebar?.classList.contains('sidebar--open');

  sidebar?.classList.toggle('sidebar--open', !isOpen);
  overlay?.classList.toggle('hidden', isOpen);
  toggle?.setAttribute('aria-expanded', String(!isOpen));
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const toggle  = document.getElementById('mobile-menu-toggle');

  sidebar?.classList.remove('sidebar--open');
  overlay?.classList.add('hidden');
  toggle?.setAttribute('aria-expanded', 'false');
}
