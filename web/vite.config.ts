import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const projectId = env.VITE_FIREBASE_PROJECT_ID || 'sisense-7e442'
  const region = 'us-central1'

  const functionsOrigin = `http://127.0.0.1:5001/${projectId}/${region}`

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Requires: `firebase emulators:start --only functions`
        '/api/sessionLogin': {
          target: `${functionsOrigin}/sessionLogin`,
          changeOrigin: true,
        },
        '/api/sessionLogout': {
          target: `${functionsOrigin}/sessionLogout`,
          changeOrigin: true,
        },
        '/sso/sisense/login': {
          target: `${functionsOrigin}/sisenseLogin`,
          changeOrigin: true,
          // Let the browser follow the 302 Location to Sisense.
          followRedirects: false,
        },
      },
    },
  }
})
