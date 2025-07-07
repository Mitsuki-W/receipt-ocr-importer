import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // セッション情報を取得
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // APIルートの保護
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // 認証が不要なAPIルート（ログイン・サインアップなど）
    const publicApiRoutes = ['/api/auth']
    const isPublicApiRoute = publicApiRoutes.some(route => 
      req.nextUrl.pathname.startsWith(route)
    )

    if (!isPublicApiRoute && !session) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }
  }

  // 認証が必要なページの保護
  const protectedRoutes = ['/items', '/upload', '/history']
  const isProtectedRoute = protectedRoutes.some(route => 
    req.nextUrl.pathname.startsWith(route)
  )

  if (isProtectedRoute && !session) {
    // ログインページにリダイレクト
    const redirectUrl = new URL('/', req.url)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/api/:path*',
    '/items/:path*',
    '/upload/:path*',
    '/history/:path*',
  ]
}