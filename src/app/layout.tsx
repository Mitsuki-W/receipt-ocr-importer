'use client'

import { Inter } from 'next/font/google'
import './globals.css'
import { useAuth } from '@/hooks/useAuth'
import AuthForm from '@/components/auth/auth-form'
import { usePathname } from 'next/navigation'
import DesktopHeader from '@/components/layout/desktop-header'
import TabletHeader from '@/components/layout/tablet-header'
import MobileHeader from '@/components/layout/mobile-header'
import SessionWarningDialog from '@/components/layout/session-warning-dialog'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, signOut, sessionWarning, extendSession } = useAuth()
  const pathname = usePathname()

  // パスワードリセットページは認証不要でヘッダーも非表示
  if (pathname === '/reset-password') {
    return (
      <html lang="ja">
        <body className={inter.className}>
          {children}
        </body>
      </html>
    )
  }

  if (loading) {
    return (
      <html lang="ja">
        <body className={inter.className}>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-lg">読み込み中...</div>
          </div>
        </body>
      </html>
    )
  }

  if (!user) {
    return (
      <html lang="ja">
        <body className={inter.className}>
          <AuthForm />
        </body>
      </html>
    )
  }

  return (
    <html lang="ja">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100">
          <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200/60 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <DesktopHeader
                pathname={pathname}
                userEmail={user.email!}
                onSignOut={() => signOut(false)}
              />
              <TabletHeader
                pathname={pathname}
                onSignOut={() => signOut(false)}
              />
              <MobileHeader
                pathname={pathname}
                onSignOut={() => signOut(false)}
              />
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>

        {/* セッション警告ダイアログ */}
        {sessionWarning && (
          <SessionWarningDialog
            onExtendSession={extendSession}
            onSignOut={() => signOut(false)}
          />
        )}
      </body>
    </html>
  )
}