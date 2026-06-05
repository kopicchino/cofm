# Circle Memories Vault

A simple static web app built with HTML, CSS, and vanilla JavaScript that uses Firebase Authentication, Firestore, and Storage.

## Features
- Email/password signup and login
- Image upload to Firebase Storage
- Memory feed stored in Firestore
- Live updates using Firestore `onSnapshot`
- Search and profile filter
- Like and comment support

## Setup
1. Create a Firebase project.
2. Enable Email/Password authentication.
3. Create a Firestore database in production mode.
4. Create a Firebase Storage bucket.
5. Copy your Firebase config into `firebase.js`.

## Deploy to GitHub Pages
1. Push the repository to GitHub.
2. In the repository settings, enable GitHub Pages using the `main` branch and root folder.
3. Your app will be available at `https://<username>.github.io/<repo-name>/`.

## Notes
- No backend server is required.
- Firebase rules should restrict access to authenticated users and allow users to create memories.
