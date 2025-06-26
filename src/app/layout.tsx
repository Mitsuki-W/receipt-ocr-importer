'use client'

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { useAuth } from '@/hooks/useAuth'
import AuthForm from '@/components/auth/auth-form'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Upload, Package, History } from 'lucide-react'

const inter = Inter({ subsets: ['latin'] })

interface NavLinkProps {
  href: string
  pathname: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  mobile?: boolean
  tablet?: boolean
}

function NavLink({ href, pathname, icon: Icon, children, mobile = false, tablet = false }: NavLinkProps) {
  const isActive = pathname === href
  
  if (mobile) {
    return (
      <Link
        href={href}
        className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs font-medium transition-colors ${
          isActive
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        <Icon className="h-5 w-5" />
        <span className="text-center">{children}</span>
      </Link>
    )
  }
  
  if (tablet) {
    return (
      <Link
        href={href}
        className={`flex flex-col items-center gap-1 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        <Icon className="h-6 w-6" />
        <span className="text-center">{children}</span>
      </Link>
    )
  }
  
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  )
}

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
              {/* デスクトップヘッダー（大画面のみ） */}
              <div className="hidden lg:flex justify-between items-center h-16">
                <h1 className="text-xl font-semibold text-gray-900">
                  レシートOCRインポーター
                </h1>
                <div className="flex items-center space-x-4">
                  <nav className="flex space-x-1">
                    <NavLink href="/" pathname={pathname} icon={Home}>
                      ダッシュボード
                    </NavLink>
                    <NavLink href="/upload" pathname={pathname} icon={Upload}>
                      アップロード
                    </NavLink>
                    <NavLink href="/items" pathname={pathname} icon={Package}>
                      食材管理
                    </NavLink>
                    <NavLink href="/history" pathname={pathname} icon={History}>
                      履歴
                    </NavLink>
                  </nav>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{user.email}</span>
                    <Button variant="outline" size="sm" onClick={signOut}>
                      ログアウト
                    </Button>
                  </div>
                </div>
              </div>

              {/* タブレットヘッダー */}
              <div className="hidden md:block lg:hidden">
                <div className="flex justify-between items-center h-16">
                  <h1 className="text-lg font-semibold text-gray-900">
                    レシートOCR
                  </h1>
                  <Button variant="outline" size="sm" onClick={signOut}>
                    ログアウト
                  </Button>
                </div>
                {/* タブレットナビゲーション */}
                <div className="pb-3 border-t">
                  <nav className="grid grid-cols-4 gap-2 pt-3">
                    <NavLink href="/" pathname={pathname} icon={Home} tablet>
                      ダッシュボード
                    </NavLink>
                    <NavLink href="/upload" pathname={pathname} icon={Upload} tablet>
                      アップロード
                    </NavLink>
                    <NavLink href="/items" pathname={pathname} icon={Package} tablet>
                      食材管理
                    </NavLink>
                    <NavLink href="/history" pathname={pathname} icon={History} tablet>
                      履歴
                    </NavLink>
                  </nav>
                </div>
              </div>

              {/* モバイルヘッダー */}
              <div className="md:hidden">
                <div className="flex justify-between items-center h-16">
                  <h1 className="text-lg font-semibold text-gray-900">
                    レシートOCR
                  </h1>
                  <Button variant="outline" size="sm" onClick={signOut}>
                    ログアウト
                  </Button>
                </div>
                {/* モバイルナビゲーション */}
                <div className="pb-3 border-t">
                  <nav className="grid grid-cols-2 gap-1 pt-3">
                    <NavLink href="/" pathname={pathname} icon={Home} mobile>
                      ダッシュボード
                    </NavLink>
                    <NavLink href="/upload" pathname={pathname} icon={Upload} mobile>
                      アップロード
                    </NavLink>
                    <NavLink href="/items" pathname={pathname} icon={Package} mobile>
                      食材管理
                    </NavLink>
                    <NavLink href="/history" pathname={pathname} icon={History} mobile>
                      履歴
                    </NavLink>
                  </nav>
                </div>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>

        {/* セッション警告ダイアログ */}
        {sessionWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                セッション期限警告
              </h2>
              <p className="text-gray-600 mb-6">
                あと5分でセッションが期限切れになります。
                継続する場合は「セッション延長」をクリックしてください。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={extendSession}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  セッション延長
                </button>
                <button
                  onClick={() => signOut()}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        )}
      </body>
    </html>
  )
}