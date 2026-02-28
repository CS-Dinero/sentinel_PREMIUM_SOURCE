import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

/**
 * Handles Supabase magic-link / OAuth redirects.
 * Supabase JS will usually auto-detect the session in the URL, but this page
 * provides a dedicated landing route that:
 *  - allows time for session hydration
 *  - provides a stable post-auth redirect to /dashboard
 */
export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true

    async function finish() {
      // Force session hydration check
      const { data: { session } } = await supabase.auth.getSession()
      if (!isMounted) return

      if (session?.user) {
        navigate('/dashboard', { replace: true })
      } else {
        // If session isn't available yet, wait briefly and retry once
        setTimeout(async () => {
          const { data: { session: s2 } } = await supabase.auth.getSession()
          if (!isMounted) return
          if (s2?.user) navigate('/dashboard', { replace: true })
          else navigate('/login?error=auth_failed', { replace: true })
        }, 800)
      }
    }

    finish()
    return () => { isMounted = false }
  }, [navigate])

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="text-sm text-muted-foreground">Signing you in…</div>
      </div>
    </div>
  )
}
