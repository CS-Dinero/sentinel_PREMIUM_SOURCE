import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Loader2, ArrowRight, AlertTriangle, Activity, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

type LoginView = 'login' | 'forgot'

export function Login() {
  const navigate = useNavigate()
  const { signInWithPassword, resetPassword, isAuthenticated, loading, isSupabaseReady } = useAuth()

  const [view, setView] = useState<LoginView>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }

  // Wait for loading to complete before redirecting — prevents loop
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, loading, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setIsSubmitting(true)
    try {
      await signInWithPassword(email, password)
      // navigate handled by useEffect above
    } catch (error: any) {
      toast.error(error.message || 'Login failed. Check your credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setIsSubmitting(true)
    try {
      await resetPassword(email)
      toast.success('Password reset link sent. Check your email.')
      setView('login')
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset link.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden spotlight"
      onMouseMove={handleMouseMove}
      style={{ '--x': `${mousePos.x}px`, '--y': `${mousePos.y}px` } as React.CSSProperties}
    >
      {/* Background imagery */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-[0.04] pointer-events-none grayscale brightness-150 mix-blend-overlay"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop")' }}
      />
      <div className="absolute inset-0 scan-line pointer-events-none opacity-[0.1]" />
      <div className="absolute -top-48 -left-48 w-full max-w-2xl h-full max-h-2xl bg-primary/5 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-48 -right-48 w-full max-w-2xl h-full max-h-2xl bg-blue-500/5 rounded-full blur-[160px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[480px] z-10"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-12">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="w-20 h-20 rounded-[28px] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center mb-6 shadow-2xl border border-white/10 p-4"
          >
            <img
              src="https://firebasestorage.googleapis.com/v0/b/blink-451505.firebasestorage.app/o/user-uploads%2Fxfd74AsMdZSB0UOLkbkA9ZsLJzU2%2Fsentinallogo__b6449232.png?alt=media&token=78cad279-9a65-4377-a904-96b381aa030e"
              alt="Sentinel Logo"
              className="w-full h-full object-contain"
            />
          </motion.div>
          <h1 className="text-4xl font-black tracking-[0.2em] mb-3 text-white">SENTINEL</h1>
          <div className="flex items-center gap-3">
            <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-slate-700" />
            <p className="text-slate-500 text-[10px] uppercase font-black tracking-[0.3em]">Enterprise Intelligence</p>
            <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-slate-700" />
          </div>
        </div>

        <Card className="glass-morphism border-white/[0.08] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] rounded-[32px] overflow-hidden p-2">
          <CardHeader className="space-y-2 pt-10 pb-8 text-center px-8">
            <CardTitle className="text-2xl font-black text-white tracking-tight">
              {view === 'login' ? 'Access Control' : 'Reset Password'}
            </CardTitle>
            <CardDescription className="text-slate-500 font-medium">
              {view === 'login'
                ? 'Securely authenticate to manage your compliance ecosystem.'
                : 'Enter your email and we\'ll send a reset link.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-8 pb-10">
            {!isSupabaseReady && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-400" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-300">Authentication Not Configured</p>
                  <p className="text-amber-200/80 mt-1">
                    Add <code className="bg-amber-500/20 px-1 rounded text-xs">VITE_SUPABASE_URL</code> and{' '}
                    <code className="bg-amber-500/20 px-1 rounded text-xs">VITE_SUPABASE_ANON_KEY</code> to your environment.
                  </p>
                </div>
              </div>
            )}

            {view === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div className="relative group">
                  <Mail className="absolute left-4 top-4 h-5 w-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                  <Input
                    placeholder="name@company.com"
                    type="email"
                    className="pl-12 h-14 bg-white/[0.02] border-white/[0.08] focus:border-primary/50 focus:bg-white/[0.05] transition-all duration-300 rounded-2xl font-medium"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                {/* Password */}
                <div className="relative group">
                  <Lock className="absolute left-4 top-4 h-5 w-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                  <Input
                    placeholder="Password"
                    type={showPassword ? 'text' : 'password'}
                    className="pl-12 pr-12 h-14 bg-white/[0.02] border-white/[0.08] focus:border-primary/50 focus:bg-white/[0.05] transition-all duration-300 rounded-2xl font-medium"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                {/* Forgot password link */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-[11px] text-slate-500 hover:text-primary transition-colors tracking-wide"
                    onClick={() => setView('forgot')}
                  >
                    Forgot password?
                  </button>
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 bg-primary text-primary-foreground hover:glow-blue transition-all duration-300 font-black uppercase tracking-[0.15em] text-xs rounded-2xl group shadow-[0_10px_30px_rgba(59,130,246,0.15)]"
                  disabled={isSubmitting || !isSupabaseReady}
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      Establish Connection
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="relative group">
                  <Mail className="absolute left-4 top-4 h-5 w-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                  <Input
                    placeholder="name@company.com"
                    type="email"
                    className="pl-12 h-14 bg-white/[0.02] border-white/[0.08] focus:border-primary/50 focus:bg-white/[0.05] transition-all duration-300 rounded-2xl font-medium"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 bg-primary text-primary-foreground hover:glow-blue transition-all duration-300 font-black uppercase tracking-[0.15em] text-xs rounded-2xl group shadow-[0_10px_30px_rgba(59,130,246,0.15)]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>

                <button
                  type="button"
                  className="w-full text-[11px] text-slate-500 hover:text-primary transition-colors tracking-wide text-center pt-2"
                  onClick={() => setView('login')}
                >
                  ← Back to login
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-10 text-center text-[10px] uppercase font-black tracking-[0.2em] text-slate-600 flex items-center justify-center gap-2">
          <Activity size={10} className="text-emerald-500" />
          {isSupabaseReady ? 'Authentication Ready' : 'Configuration Required'}
        </p>
      </motion.div>
    </div>
  )
}
