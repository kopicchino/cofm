// =========================================================
//  app.js — Main entry point. Wires everything together.
// =========================================================

import { initAuth, watchAuthState } from "./auth.js";
import { initRouter, navigateTo }   from "./router.js";
import { initFeedPage, subscribeFeed, unsubFeed, initLightbox, renderFeed } from "./feed.js";
import { initUploadPage }           from "./upload.js";
import { initProfilePage }          from "./profile.js";
import { loadMembers, initMembersPage } from "./members.js";

// ── DOM references ────────────────────────────────────────
const authScreen  = document.getElementById('auth-screen');
const appShell    = document.getElementById('app-shell');

// ── Initialization ────────────────────────────────────────
function bootApp() {
  // Set up lightbox (available on all pages)
  initLightbox();

  // Set up auth forms (login / register / logout)
  initAuth();

  // Set up sidebar navigation + mobile menu
  initRouter((pageName) => {
    handlePageChange(pageName);
  });

  // Watch Firebase auth state
  watchAuthState(
    // ── User logged IN ─────────────────────────────────
    (user, profile) => {
      authScreen?.classList.add('hidden');
      appShell?.classList.remove('hidden');

      // Start the live feed subscription
      subscribeFeed();

      // Initialize page-specific logic
      initFeedPage();
      initUploadPage();
      initMembersPage();

      // Navigate to feed by default
      navigateTo('feed');
    },

    // ── User logged OUT ────────────────────────────────
    () => {
      // Tear down live subscription
      unsubFeed();

      appShell?.classList.add('hidden');
      authScreen?.classList.remove('hidden');
    }
  );
}

// ── Handle page changes (load data lazily) ────────────────
async function handlePageChange(pageName) {
  switch (pageName) {
    case 'feed':
      renderFeed();
      break;

    case 'members':
      await loadMembers();
      break;

    case 'profile':
      await initProfilePage();
      break;

    case 'upload':
      // Upload page is already initialized — nothing extra needed
      break;
  }
}

// ── Start the app ─────────────────────────────────────────
bootApp();
