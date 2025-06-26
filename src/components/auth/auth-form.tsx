'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        
        if (error) {
          // 既存ユーザーの場合のエラーハンドリング
          if (error.message.includes('User already registered') || 
              error.message.includes('already been registered') ||
              error.message.includes('already registered') ||
              error.message.includes('Email address is already registered')) {
            setError('このメールアドレスは既に登録されています。ログインしてください。')
            return
          } else {
            throw error
          }
        } else if (data.user) {
          // Supabaseの設定によっては既存ユーザーでもsignUpが成功する場合がある
          // その場合、data.user.identitiesが空配列になることが多い
          if (data.user.identities && data.user.identities.length === 0) {
            setError('このメールアドレスは既に登録されています。ログインしてください。')
            return
          } else {
            setMessage('確認メールを送信しました。メールをチェックしてください。')
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        // ログイン成功時はページリロードで状態更新
        window.location.reload()
      }
    } catch (error: any) {
      // その他のエラーメッセージを適切に変換
      let errorMessage = error.message
      
      if (errorMessage.includes('Invalid login credentials')) {
        errorMessage = 'メールアドレスまたはパスワードが正しくありません。'
      } else if (errorMessage.includes('Email not confirmed')) {
        errorMessage = 'メールアドレスが確認されていません。確認メールをチェックしてください。'
      } else if (errorMessage.includes('Password should be at least')) {
        errorMessage = 'パスワードは6文字以上で入力してください。'
      } else if (errorMessage.includes('Invalid email')) {
        errorMessage = '有効なメールアドレスを入力してください。'
      }
      
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {isSignUp ? 'アカウント作成' : 'ログイン'}
          </CardTitle>
          <CardDescription className="text-center">
            {isSignUp 
              ? '新しいアカウントを作成してください' 
              : 'アカウントにログインしてください'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="パスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {message && (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading 
                ? '処理中...' 
                : isSignUp 
                  ? 'アカウント作成' 
                  : 'ログイン'
              }
            </Button>
            
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError('')
                  setMessage('')
                }}
                className="text-sm text-blue-600 hover:text-blue-500"
                disabled={isLoading}
              >
                {isSignUp 
                  ? 'すでにアカウントをお持ちですか？ログイン' 
                  : 'アカウントをお持ちでない方はこちら'
                }
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}