'use client'

// import type { Metadata } from 'next' // 現在未使用
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
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm border-b">
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