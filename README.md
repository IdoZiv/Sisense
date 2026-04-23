# Firebase React Auth (Email/Password)

This repo contains a simple React app (Vite) with Firebase Authentication (email/password) and Firebase Hosting deployment config.

## Local dev

```bash
cd web
npm install
npm run dev
```

## Enable Email/Password auth

In Firebase Console → **Authentication** → **Sign-in method** → enable **Email/Password**.

## Deploy to Firebase Hosting

First build the app:

```bash
cd web
npm run build
```

Then deploy from the repo root:

```bash
cd ..
npx firebase-tools deploy --only hosting
```

