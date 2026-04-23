import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../auth/useAuth'

export default function MainPage() {
  const { user } = useAuth()
  return (
    <div className="page">
      <div className="card">
        <h1>Main</h1>
        <p className="muted">Signed in as {user?.email ?? 'unknown'}.</p>

        <div className="row">
          <button className="primary" type="button" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

