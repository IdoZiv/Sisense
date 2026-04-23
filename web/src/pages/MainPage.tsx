import { signOut } from 'firebase/auth'
import { useEffect, useMemo, useRef, useState } from 'react'
import { auth } from '../firebase'
import { useAuth } from '../auth/useAuth'

declare global {
  interface Window {
    // Sisense exposes the Embed SDK under this key: window['sisense.embed']
    // (see Sisense docs). We intentionally access it via bracket notation.
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve()
      else existing.addEventListener('load', () => resolve(), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    })
    script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)))
    document.head.appendChild(script)
  })
}

export default function MainPage() {
  const { user } = useAuth()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [embedError, setEmbedError] = useState<string | null>(null)

  const sisenseUrl = useMemo(() => (import.meta.env.VITE_SISENSE_URL as string | undefined) ?? '', [])
  const dashboardOid = useMemo(
    () => ((import.meta.env.VITE_SISENSE_DASHBOARD_OID as string | undefined) ?? '').trim(),
    [],
  )

  useEffect(() => {
    let cancelled = false

    async function run() {
      setEmbedError(null)

      if (!sisenseUrl) {
        setEmbedError('Missing VITE_SISENSE_URL. Set it in web/.env.local and restart dev server.')
        return
      }
      if (!dashboardOid) {
        setEmbedError('Missing VITE_SISENSE_DASHBOARD_OID. Set it in web/.env.local and restart dev server.')
        return
      }
      if (!iframeRef.current) return

      try {
        // Ensure the backend has an HttpOnly session cookie for Sisense SSO.
        // This is needed even if Firebase auth state was restored from local storage.
        if (user) {
          const idToken = await user.getIdToken()
          await fetch('/api/sessionLogin', {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
            credentials: 'include',
          })
        }

        await loadScript(`${sisenseUrl}/js/frame.js`)
        if (cancelled) return

        const sdk = (window as unknown as Record<string, unknown>)['sisense.embed'] as
          | {
              SisenseFrame?: new (args: unknown) => { render: () => Promise<void> }
            }
          | undefined

        const SisenseFrame = sdk?.SisenseFrame
        if (!SisenseFrame) {
          setEmbedError(
            "Sisense Embed SDK not available (frame.js loaded but window['sisense.embed'].SisenseFrame is missing).",
          )
          return
        }

        const frame = new SisenseFrame({
          url: sisenseUrl,
          dashboard: dashboardOid,
          settings: {
            showToolbar: false,
            showLeftPane: false,
            showRightPane: false,
          },
          element: iframeRef.current,
        })

        await frame.render()
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to embed Sisense dashboard'
        setEmbedError(message)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [sisenseUrl, dashboardOid, user])

  return (
    <div className="page page--dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Signed in as {user?.email ?? 'unknown'}.</p>
        </div>
        <div className="row">
          <button
            className="primary"
            type="button"
            onClick={async () => {
              await fetch('/api/sessionLogout', { method: 'POST', credentials: 'include' })
              await signOut(auth)
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="dashboard-frame-wrap">
        {embedError ? <div className="dashboard-placeholder error">{embedError}</div> : null}
        <iframe ref={iframeRef} className="dashboard-iframe" title="Sisense dashboard" />
      </div>
    </div>
  )
}

