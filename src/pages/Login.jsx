import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import logo from '../assets/images/sault-black.webp'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const { login, resetPassword } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (resetMode) {
        await resetPassword(email)
        setResetSent(true)
      } else {
        await login(email, password)
        navigate('/')
      }
    } catch (err) {
      setError(
        resetMode
          ? 'Failed to send password reset email'
          : 'Invalid email or password'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-habitat-green to-habitat-green-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={logo} alt="Sault Logo" className="h-16 w-auto" />
          </div>

          {resetSent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-habitat-green" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Check your email</h2>
              <p className="text-gray-600 mb-6">
                We sent a password reset link to {email}
              </p>
              <button
                onClick={() => {
                  setResetMode(false)
                  setResetSent(false)
                }}
                className="text-habitat-green hover:underline"
              >
                Back to login
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-center mb-6">
                {resetMode ? 'Reset Password' : 'Sign in to your account'}
              </h2>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field pl-10"
                      placeholder="admin@habitat.org"
                      required
                    />
                  </div>
                </div>

                {!resetMode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field pl-10"
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? 'Please wait...'
                    : resetMode
                    ? 'Send Reset Link'
                    : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setResetMode(!resetMode)
                    setError('')
                  }}
                  className="text-sm text-habitat-green hover:underline"
                >
                  {resetMode ? 'Back to login' : 'Forgot your password?'}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-white/80 text-sm mt-6">
          Habitat for Humanity Donation Pickup Management
        </p>
      </div>
    </div>
  )
}
