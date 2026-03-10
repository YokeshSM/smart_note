import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { NotesPage } from './pages/NotesPage'
import { TrashPage } from './pages/TrashPage'
import { SetupPage } from './pages/SetupPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { isConfigured } from './lib/supabase'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function AppRoutes() {
  const { isAuthenticated, isLoading, isRecovery } = useAuth()
  if (isLoading) return <Spinner />

  // After clicking password reset email link, always show the reset form
  if (isRecovery) return <ResetPasswordPage />

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/notes" replace /> : <LoginPage />}
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/notes" element={<NotesPage />} />
      <Route path="/trash" element={<TrashPage />} />
      <Route path="*" element={<Navigate to="/notes" replace />} />
    </Routes>
  )
}

function App() {
  if (!isConfigured) return <SetupPage />

  return (
    <ThemeProvider>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
