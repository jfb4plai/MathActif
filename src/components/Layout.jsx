import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LogoPlai from './LogoPlai'

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoPlai size="sm" />
            <div>
              <span className="font-bold text-jfb-noir text-sm">MathActif</span>
              <span className="text-xs text-gray-400 ml-2">Maths S3-S6 — PLAI</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-xs text-gray-400 hidden sm:block">{user.email}</span>
            )}
            <button
              onClick={handleSignOut}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  )
}
