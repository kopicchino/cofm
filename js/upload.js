// =========================================================
//  upload.js — Image upload using Cloudinary (free, no Firebase Storage)
//  Stores metadata in Firestore after a successful upload.
// =========================================================

import {
  collection, addDoc, serverTimestamp, doc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { auth, db }  from "./init.js";
import { showToast } from "./toast.js";

// ─── Cloudinary config ────────────────────────────────────
// Set these after creating a free Cloudinary account:
//   Dashboard → Cloud Name
//   Settings → Upload → Upload Presets → Add preset (Unsigned)
const CLOUDINARY_CLOUD_NAME    = 'dixidxpca';
const CLOUDINARY_UPLOAD_PRESET = 'cofm111';

// ─── State ────────────────────────────────────────────────
let selectedFile = null;

// ─── UI helpers ───────────────────────────────────────────
function getEl(id) { return document.getElementById(id); }

function setProgress(pct) {
  const bar   = getEl('upload-progress-bar');
  const label = getEl('upload-progress-text');
  if (bar)   bar.style.width = `${pct}%`;
  if (label) label.textContent = `${pct}%`;
}

function showProgress(visible) {
  getEl('upload-progress-wrap')?.classList.toggle('hidden', !visible);
}

function setUploadBtn(loading) {
  const btn   = getEl('upload-submit');
  const label = btn?.querySelector('.btn-label');
  if (!btn) return;
  btn.disabled = loading;
  if (label) label.textContent = loading ? 'Uploading...' : 'Upload Memory';
}

function resetUploadUI() {
  setUploadBtn(false);
  showProgress(false);
  setProgress(0);
  selectedFile = null;

  // Reset drop zone
  const preview     = getEl('image-preview');
  const placeholder = getEl('drop-placeholder');
  const clearBtn    = getEl('clear-image-btn');
  preview?.classList.add('hidden');
  placeholder?.classList.remove('hidden');
  clearBtn?.classList.add('hidden');
  if (preview) preview.src = '';
}

// ─── Drop zone / file picker ──────────────────────────────
export function initUploadPage() {
  const dropZone    = getEl('drop-zone');
  const fileInput   = getEl('image-input');
  const preview     = getEl('image-preview');
  const placeholder = getEl('drop-placeholder');
  const clearBtn    = getEl('clear-image-btn');
  const form        = getEl('upload-form');

  if (!dropZone || !fileInput) return;

  // Click to browse
  dropZone.addEventListener('click', (e) => {
    if (e.target === clearBtn || clearBtn?.contains(e.target)) return;
    fileInput.click();
  });
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });

  // Drag over
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drop-zone--over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drop-zone--over');
  });

  // Drop
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone--over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      applyFile(file, preview, placeholder, clearBtn);
    } else {
      showToast('Please drop a valid image file.', 'error');
    }
  });

  // File picker change
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
      applyFile(fileInput.files[0], preview, placeholder, clearBtn);
    }
  });

  // Clear selected image
  clearBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    preview?.classList.add('hidden');
    placeholder?.classList.remove('hidden');
    clearBtn.classList.add('hidden');
    if (preview) preview.src = '';
    fileInput.value = '';
  });

  // Form submit
  form?.addEventListener('submit', handleUpload);
}

function applyFile(file, preview, placeholder, clearBtn) {
  selectedFile = file;
  const url = URL.createObjectURL(file);
  if (preview) {
    preview.src = url;
    preview.classList.remove('hidden');
  }
  placeholder?.classList.add('hidden');
  clearBtn?.classList.remove('hidden');
}

// ─── Upload handler ────────────────────────────────────────
async function handleUpload(e) {
  e.preventDefault();

  if (!auth.currentUser) {
    showToast('You must be signed in to upload.', 'error');
    return;
  }
  if (!selectedFile) {
    showToast('Please select an image first.', 'error');
    return;
  }

  // Validate config
  if (CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME') {
    showToast('Cloudinary is not configured yet. Please set your Cloud Name and Upload Preset in js/upload.js.', 'error', 6000);
    return;
  }

  const caption  = getEl('caption-input')?.value.trim() || '';
  const file     = selectedFile;
  const user     = auth.currentUser;
  const username = user.email?.split('@')[0] || 'user';

  setUploadBtn(true);
  showProgress(true);
  setProgress(10); // show immediate activity

  try {
    // ── Upload to Cloudinary ──────────────────────────────
    const formData = new FormData();
    formData.append('file',           file);
    formData.append('upload_preset',  CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder',         'circle-memories');

    setProgress(30);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Cloudinary upload failed (${res.status})`);
    }

    setProgress(75);
    const data     = await res.json();
    const imageUrl = data.secure_url;

    // ── Save metadata to Firestore ────────────────────────
    // Fetch display name + avatar from user profile
    let displayName = username;
    let userPhotoURL = '';
    try {
      const { doc: fsDoc, getDoc } = await import(
        "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js"
      );
      const profileSnap = await getDoc(fsDoc(db, 'users', user.uid));
      if (profileSnap.exists()) {
        const p = profileSnap.data();
        displayName  = p.displayName || username;
        userPhotoURL = p.photoURL    || '';
      }
    } catch (_) { /* profile fetch is non-critical */ }

    setProgress(90);

    await addDoc(collection(db, 'memories'), {
      userId:      user.uid,
      username,
      displayName,
      userPhotoURL,
      imageUrl,
      cloudinaryId: data.public_id,
      caption,
      createdAt:   serverTimestamp(),
      likes:       [],
      comments:    [],
    });

    // Increment user's memory count
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        memoryCount: increment(1)
      });
    } catch (_) { /* non-critical */ }

    setProgress(100);
    showToast('Memory uploaded successfully!', 'success');

    // Reset form
    getEl('caption-input') && (getEl('caption-input').value = '');
    resetUploadUI();

  } catch (err) {
    console.error('Upload error:', err);
    showToast(`Upload failed: ${err.message}`, 'error', 6000);
    resetUploadUI();
  }
}
