import { randomUUID } from 'crypto'
import * as admin from 'firebase-admin'
import type { Request, Response } from 'express'
import { setGlobalOptions } from 'firebase-functions'
import { defineSecret, defineString } from 'firebase-functions/params'
import { onRequest } from 'firebase-functions/v2/https'
import jwt from 'jsonwebtoken'

setGlobalOptions({ region: 'us-central1' })

admin.initializeApp()

const sisenseJwtSecret = defineSecret('SISENSE_JWT_SECRET')
const sisenseBaseUrl = defineString('SISENSE_BASE_URL', { default: '' })
const sisenseDashboardId = defineString('SISENSE_DASHBOARD_ID', {
  default: '69e5f2179ec678ed9f06acdf',
})

const SESSION_COOKIE_NAME = '__session'
const SESSION_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000 // 5 days

function setSessionCookie(res: Response, value: string) {
  // Minimal cookie serializer (avoid extra deps)
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    // Needed so the cookie is sent when Sisense navigates the iframe to our Remote Login URL.
    'SameSite=None',
    // CHIPS: allow cookie in third-party iframes (partitioned by top-level site).
    // Helps avoid redirect loops when third-party cookies are blocked.
    'Partitioned',
    `Max-Age=${Math.floor(SESSION_EXPIRES_IN_MS / 1000)}`,
  ]
  res.setHeader('Set-Cookie', parts.join('; '))
}

function clearSessionCookie(res: Response) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`,
  )
}

function getCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie
  if (!raw) return null
  const match = raw
    .split(';')
    .map((s: string) => s.trim())
    .find((c: string) => c.startsWith(`${name}=`))
  if (!match) return null
  return decodeURIComponent(match.slice(name.length + 1))
}

function buildSisenseJwt(email: string): string {
  const secret = sisenseJwtSecret.value()
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 5 * 60 // 5 minutes
  return jwt.sign(
    {
      iat: now,
      exp,
      jti: randomUUID(),
      sub: email,
      email,
    },
    secret,
    { algorithm: 'HS256', header: { typ: 'JWT', alg: 'HS256' } },
  )
}

/**
 * Returns a Sisense JWT SSO URL (for iframe src or top-level navigation).
 * POST/GET with Authorization: Bearer <Firebase ID token>.
 */
export const sisenseSso = onRequest(
  {
    secrets: [sisenseJwtSecret],
    cors: true,
    invoker: 'public',
    memory: '256MiB',
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('')
      return
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const base = sisenseBaseUrl.value().replace(/\/$/, '')
    if (!base) {
      res.status(503).json({
        error: 'Sisense is not configured',
        hint: 'Set the SISENSE_BASE_URL parameter for Cloud Functions (see README).',
      })
      return
    }

    try {
      const authHeader = req.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' })
        return
      }

      const idToken = authHeader.slice('Bearer '.length).trim()
      const decoded = await admin.auth().verifyIdToken(idToken)
      const email = decoded.email
      if (!email) {
        res.status(400).json({ error: 'Signed-in user must have an email for Sisense SSO' })
        return
      }

      const secret = sisenseJwtSecret.value()
      const now = Math.floor(Date.now() / 1000)
      const sisenseToken = jwt.sign(
        {
          iat: now,
          jti: randomUUID(),
          sub: email,
        },
        secret,
        { algorithm: 'HS256', header: { typ: 'JWT', alg: 'HS256' } },
      )

      const dashboardId = sisenseDashboardId.value()
      const returnTo = `${base}/app/main#/dashboards/${dashboardId}?embed=true`
      const embedUrl = `${base}/jwt?jwt=${encodeURIComponent(sisenseToken)}&return_to=${encodeURIComponent(returnTo)}`

      res.json({ embedUrl })
    } catch (e) {
      console.error('sisenseSso error', e)
      const message = e instanceof Error ? e.message : 'Unknown error'
      res.status(500).json({ error: 'Failed to build Sisense SSO URL', detail: message })
    }
  },
)

/**
 * Called by the web app after Firebase login to mint an HttpOnly session cookie.
 * POST with Authorization: Bearer <Firebase ID token>.
 */
export const sessionLogin = onRequest(
  { cors: true, invoker: 'public', memory: '128MiB' },
  async (req, res) => {
    if (req.method === 'OPTIONS') return void res.status(204).send('')
    if (req.method !== 'POST') return void res.status(405).json({ error: 'Method not allowed' })

    try {
      const authHeader = req.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        return void res.status(401).json({ error: 'Missing or invalid Authorization header' })
      }

      const idToken = authHeader.slice('Bearer '.length).trim()
      const sessionCookie = await admin.auth().createSessionCookie(idToken, {
        expiresIn: SESSION_EXPIRES_IN_MS,
      })

      setSessionCookie(res, sessionCookie)
      return void res.status(204).send('')
    } catch (e) {
      console.error('sessionLogin error', e)
      return void res.status(401).json({ error: 'Failed to create session' })
    }
  },
)

/**
 * Clears the HttpOnly session cookie.
 */
export const sessionLogout = onRequest(
  { cors: true, invoker: 'public', memory: '128MiB' },
  async (req, res) => {
    if (req.method === 'OPTIONS') return void res.status(204).send('')
    if (req.method !== 'POST') return void res.status(405).json({ error: 'Method not allowed' })

    clearSessionCookie(res)
    return void res.status(204).send('')
  },
)

/**
 * Sisense "Remote Login URL" endpoint.
 * Sisense calls this in the user's browser; we read our Firebase session cookie,
 * then redirect to Sisense /jwt with a signed token and the desired return_to.
 *
 * Configure in Sisense to something like:
 *   https://<your-hosting-domain>/sso/sisense/login
 */
export const sisenseLogin = onRequest(
  { cors: true, invoker: 'public', memory: '256MiB', secrets: [sisenseJwtSecret] },
  async (req, res) => {
    if (req.method === 'OPTIONS') return void res.status(204).send('')
    if (req.method !== 'GET') return void res.status(405).send('Method not allowed')

    const base = sisenseBaseUrl.value().replace(/\/$/, '')
    if (!base) return void res.status(503).send('Sisense is not configured (SISENSE_BASE_URL).')

    try {
      const sessionCookie = getCookie(req, SESSION_COOKIE_NAME)
      if (!sessionCookie) return void res.status(401).send('Missing app session.')

      const decoded = await admin.auth().verifySessionCookie(sessionCookie, true)
      const email = decoded.email
      if (!email) return void res.status(400).send('Signed-in user must have an email for Sisense SSO.')

      const token = buildSisenseJwt(email)

      const q = req.query as Record<string, string | undefined>
      const returnToFromSisense = q.return_to
      const dashboardId = sisenseDashboardId.value()
      const defaultReturnToPath = `/app/main#/dashboards/${dashboardId}?embed=true`

      // Sisense /jwt is most reliable when return_to is a *relative path* on the Sisense domain.
      // If Sisense provided a full URL back to itself, strip the origin.
      let returnToPath = defaultReturnToPath
      if (returnToFromSisense) {
        if (returnToFromSisense.startsWith('/')) {
          returnToPath = returnToFromSisense
        } else if (returnToFromSisense.startsWith('http')) {
          try {
            const u = new URL(returnToFromSisense)
            const baseUrl = new URL(base)
            if (u.origin === baseUrl.origin) {
              returnToPath = `${u.pathname}${u.search}${u.hash}`
            }
          } catch {
            // ignore invalid URL, fall back
          }
        }
      }

      // Some Sisense flows provide `/app/main/dashboards/<oid>` (no hash router).
      // Normalize to the SPA hash route expected by Sisense UI.
      if (returnToPath.startsWith('/app/main/dashboards/')) {
        returnToPath = returnToPath.replace('/app/main/dashboards/', '/app/main#/dashboards/')
      }

      const location = `${base}/jwt?jwt=${encodeURIComponent(token)}&return_to=${encodeURIComponent(returnToPath)}`

      res.status(302).setHeader('Location', location)
      return void res.send('')
    } catch (e) {
      console.error('sisenseLogin error', e)
      return void res.status(401).send('Invalid or expired app session.')
    }
  },
)
