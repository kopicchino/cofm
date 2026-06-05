// =========================================================
//  init.js — Firebase initialization and shared exports
// =========================================================

import { initializeApp }  from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage }     from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { firebaseConfig } from "../firebase.js";

const firebaseApp = initializeApp(firebaseConfig);

export const auth    = getAuth(firebaseApp);
export const db      = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
