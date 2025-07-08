import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types'

export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: {
        getItem: (key: string) => {
          return localStorage.getItem(key)
        },
        setItem: (key: string, value: string) => {
          localStorage.setItem(key, value)
        },
        removeItem: (key: string) => {
          localStorage.removeItem(key)
        },
      },
    },
  }
)