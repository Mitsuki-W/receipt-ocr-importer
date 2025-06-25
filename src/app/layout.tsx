'use client'

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { useAuth } from '@/hooks/useAuth'
import AuthForm from '@/components/auth/auth-form'
import { Button } from '@/components/ui/button'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, signOut } = useAuth()

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
              <div className="flex justify-between items-center h-16">
                <h1 className="text-xl font-semibold text-gray-900">
                  レシートOCRインポーター
                </h1>
                <div className="flex items-center space-x-4">
                  <nav className="space-x-4">
                    <a href="/" className="text-gray-600 hover:text-gray-900">ダッシュボード</a>
                    <a href="/upload" className="text-gray-600 hover:text-gray-900">アップロード</a>
                    <a href="/items" className="text-gray-600 hover:text-gray-900">食材管理</a>
                    <a href="/history" className="text-gray-600 hover:text-gray-900">履歴</a>
                  </nav>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{user.email}</span>
                    <Button variant="outline" size="sm" onClick={signOut}>
                      ログアウト
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}