import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LogoPlai from './LogoPlai'

export default function Layout({ children }) {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <nav className="plai-nav">
        <Link to="/adapter" className="flex items-center gap-2">
          <LogoPlai size={32} />
          <span className="font-bold text-lg" style={{ color: 'var(--teal)' }}>MathActif</span>
          <span className="text-xs text-gray-400 hidden sm:inline">Maths S3-S6 FWB</span>
        </Link>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-800">
          Déconnexion
        </button>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="plai-footer">
        <LogoPlai size={40} />
        <span>MathActif — PLAI · Pôle Territorial de la Ville de Liège</span>
      </footer>
    </div>
  )
}
