import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import MathAdapter from './pages/MathAdapter'
import Layout from './components/Layout'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Chargement…</div>
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/adapter" element={
            <PrivateRoute>
              <Layout><MathAdapter /></Layout>
            </PrivateRoute>
          } />
          <Route path="*" element={<Navigate to="/adapter" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
