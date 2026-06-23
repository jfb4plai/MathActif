import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import LogoPlai from '../components/LogoPlai'

export default function Login() {
  const [mode, setMode]       = useState('login') // 'login' | 'register' | 'reset'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp }    = useAuth()
  const navigate              = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError('Email ou mot de passe incorrect.')
      else navigate('/dashboard')

    } else if (mode === 'register') {
      const { error } = await signUp(email, password)
      if (error) setError(error.message)
      else setSuccess('Compte créé. Vérifiez votre email pour confirmer votre inscription.')

    } else if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) setError(error.message)
      else setSuccess('Email envoyé. Vérifiez votre boîte mail.')
    }

    setLoading(false)
  }

  const titles = { login: 'Se connecter', register: 'Créer mon compte', reset: 'Réinitialiser' }

  return (
    <div className="min-h-screen bg-gradient-to-br from-jfb-beige to-jfb-beige-dk flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <LogoPlai size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-jfb-noir">DiffActif</h1>
          <p className="text-jfb-rose mt-1 text-sm">Différenciation pédagogique — PLAI</p>
        </div>

        <div className="card">
          {mode !== 'reset' && (
            <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === 'login' ? 'bg-white shadow text-jfb-rose' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Connexion
              </button>
              <button
                onClick={() => setMode('register')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === 'register' ? 'bg-white shadow text-jfb-rose' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Inscription
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800">Mot de passe oublié</h2>
              <p className="text-sm text-gray-500 mt-1">
                Entrez votre email — vous recevrez un lien pour créer un nouveau mot de passe.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email" className="input" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="prenom.nom@etablissement.be" required
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="label">Mot de passe</label>
                <input
                  type="password" className="input" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                />
                {mode === 'register' && (
                  <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères</p>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
                {success}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? 'Chargement...' : titles[mode]}
            </button>
          </form>

          <div className="mt-4 text-center">
            {mode === 'login' && (
              <button
                onClick={() => { setMode('reset'); setError(''); setSuccess('') }}
                className="text-xs text-gray-400 hover:text-jfb-rose transition-colors"
              >
                Mot de passe oublié ?
              </button>
            )}
            {mode === 'reset' && (
              <button
                onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                className="text-xs text-gray-400 hover:text-jfb-rose transition-colors"
              >
                ← Retour à la connexion
              </button>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            Un outil du Pôle Liégeois d'Accompagnement vers une École Inclusive
          </p>
        </div>
      </div>
    </div>
  )
}
