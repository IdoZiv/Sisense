# Firebase React Auth (Email/Password)

This repo contains a simple React app (Vite) with Firebase Authentication (email/password) and Firebase Hosting deployment config.

## Local dev

```bash
cd web
npm install
cp .env.example .env.local
# Fill in the VITE_FIREBASE_* values from Firebase Console → Project settings → Your apps
npm run dev
```

## Enable Email/Password auth

In Firebase Console → **Authentication** → **Sign-in method** → enable **Email/Password**.

## Firebase web config (Vite env vars)

This app reads Firebase config from `VITE_FIREBASE_*` variables (see `web/.env.example`).

Notes:

- These values still ship to browsers in production builds; the goal is **not** to treat them like server secrets, but to **avoid committing them to git** and to make **GitHub secret scanning** / rotation workflows safer.
- If GitHub flagged a leaked Google API key, follow Google’s guidance to **restrict**, **rotate**, and **revoke** the old key in **Google Cloud Console → APIs & Services → Credentials**. If the repo was public, also plan to **remove the secret from git history** (GitHub remediation / `git filter-repo`) because deleting it from the latest commit is not enough.

## Deploy to Firebase Hosting

First build the app:

```bash
cd web
npm install
# Ensure VITE_FIREBASE_* are available in the environment for the build (e.g. `.env.production.local` locally,
# or CI secrets injected as env vars).
npm run build
```

Then deploy from the repo root:

```bash
cd ..
npx firebase-tools deploy --only hosting
```

