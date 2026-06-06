'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Two-step admin login:
 *   1. Email + password -> POST /api/admin/auth/login
 *      -> 200: server emails a 6-digit OTP (5 min TTL)
 *   2. OTP code -> POST /api/admin/auth/verify-otp
 *      -> 200 + Set-Cookie admin_session; client-side window.location
 *         reload so the next /api/admin/* call carries the cookie.
 *
 * Errors are intentionally generic ("Invalid email or password") to
 * avoid leaking which field is wrong.
 *
 * The inner component uses useSearchParams; Next.js 15 requires that
 * to be wrapped in a Suspense boundary so the page can be statically
 * prerendered without bailing out the whole build.
 */
function AdminLoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') ?? '/admin/operations'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'creds' | 'otp'>('creds')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmitCreds(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.status === 429) {
        setError('Too many attempts. Wait a few minutes and try again.')
        return
      }
      const data = await res.json().catch(() => ({}))
      if (data.ok) {
        setStep('otp')
      } else {
        setError('Invalid email or password')
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function onSubmitOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.ok) {
        // Hard reload so the new cookie is sent on the next request
        window.location.href = next
      } else {
        setError('Invalid or expired code')
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900 mb-1">Sharma Bajaj Admin</h1>
        <p className="text-sm text-zinc-500 mb-6">
          {step === 'creds' ? 'Sign in to continue.' : `Enter the 6-digit code we sent to ${email}.`}
        </p>

        {step === 'creds' ? (
          <form onSubmit={onSubmitCreds} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded border border-zinc-300 px-3 py-2 pr-10 text-sm focus:border-zinc-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 hover:text-zinc-900"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-zinc-900 text-white py-2 text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmitOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                autoComplete="one-time-code"
                autoFocus
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm tracking-widest text-center font-mono text-lg focus:border-zinc-900 focus:outline-none"
              />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full rounded bg-zinc-900 text-white py-2 text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify and sign in'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('creds'); setOtp(''); setError(null) }}
              className="w-full text-sm text-zinc-500 hover:text-zinc-700"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-sm text-zinc-500">Loading…</div>
      </div>
    }>
      <AdminLoginForm />
    </Suspense>
  )
}
