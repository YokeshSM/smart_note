import React, { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'

type Mode = 'signin' | 'signup' | 'forgot'

export const LoginPage: React.FC = () => {
  const { login, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const switchMode = (m: Mode) => {
    setMode(m)
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)
    try {
      if (mode === 'signin') {
        await login(email, password)
      } else if (mode === 'signup') {
        await signUp(email, password)
        setSuccess('Account created! Check your email to confirm, then sign in.')
        switchMode('signin')
      } else {
        await resetPassword(email)
        setSuccess('Reset link sent! Check your email.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-indigo-500/30 mb-4">
            <Sparkles size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Smart Notes</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Capture your thoughts, beautifully.</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          {mode !== 'forgot' ? (
            <>
              {/* Sign in / Sign up tabs */}
              <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-5">
                {(['signin', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      mode === m
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {m === 'signin' ? 'Sign in' : 'Sign up'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
                {success && <p className="text-xs text-green-600 dark:text-green-400">{success}</p>}

                <Button type="submit" size="lg" className="w-full mt-1" isLoading={isLoading}>
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                </Button>

                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="w-full text-center text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                  >
                    Forgot password?
                  </button>
                )}
              </form>
            </>
          ) : (
            /* Forgot password form */
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Reset your password</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter your email and we'll send a reset link.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
              {success && <p className="text-xs text-green-600 dark:text-green-400">{success}</p>}

              <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
                Send reset link
              </Button>
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="w-full text-center text-xs text-gray-500 dark:text-gray-400 hover:underline"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-600">
          By continuing, you agree to our Terms of Service.
        </p>
      </div>
    </div>
  )
}
