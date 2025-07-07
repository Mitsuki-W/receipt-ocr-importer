'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isResetComplete, setIsResetComplete] = useState(false)
  const [isLinkValid, setIsLinkValid] = useState(true)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handlePasswordReset = async () => {
      // URLハッシュまたはクエリパラメータからパラメータを確認
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const queryParams = new URLSearchParams(window.location.search)
      
      // Supabaseエラーパラメータをチェック
      const error = queryParams.get('error')
      const errorCode = queryParams.get('error_code')
      const errorDescription = queryParams.get('error_description')
      
      // Supabase SSR形式のcodeパラメータをチェック
      const code = queryParams.get('code') || hashParams.get('code')
      
      // 旧形式のaccess_tokenもチェック（互換性のため）
      let accessToken = hashParams.get('access_token') || queryParams.get('access_token')
      let type = hashParams.get('type') || queryParams.get('type')

      console.log('パスワードリセットデバッグ:', {
        fullURL: window.location.href,
        hash: window.location.hash,
        search: window.location.search,
        hashParams: Object.fromEntries(hashParams.entries()),
        queryParams: Object.fromEntries(queryParams.entries()),
        code: code ? 'あり' : 'なし',
        accessToken: accessToken ? 'あり' : 'なし',
        type: type,
        error: error,
        errorCode: errorCode,
        errorDescription: errorDescription
      })

      // Supabaseからのエラーメッセージを優先的に処理
      if (error) {
        setIsLinkValid(false) // リンクが無効なのでフォームを無効化
        if (errorCode === 'otp_expired') {
          setError('パスワードリセットリンクの有効期限が切れています（有効期限：1時間）。新しいリンクを取得してください。')
        } else if (error === 'access_denied') {
          setError('アクセスが拒否されました。新しいパスワードリセットリンクを取得してください。')
        } else {
          setError(`エラーが発生しました: ${errorDescription || error}。新しいパスワードリセットリンクを取得してください。`)
        }
        return
      }

      // SSR形式のcode認証（パスワードリセット用）
      if (code) {
        try {
          console.log('パスワードリセットのためのコードとセッションの交換を試行中...')
          
          // URLからcode_verifierパラメータも取得を試行
          const codeVerifier = queryParams.get('code_verifier') || hashParams.get('code_verifier')
          
          if (codeVerifier) {
            // PKCE flow
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
            
            if (exchangeError) {
              console.error('コード交換エラー:', exchangeError)
              setError('認証コードの処理に失敗しました。新しいパスワードリセットリンクを取得してください。')
              return
            }
            
            if (data.session) {
              console.log('コードとセッションの交換に成功しました')
              setMessage('パスワードリセットの準備が完了しました。新しいパスワードを入力してください。')
              return
            }
          } else {
            // パスワードリセット専用のフロー - 単純にcodeの存在を確認
            console.log('パスワードリセットコードを検出、リセットフローを進行中')
            setMessage('パスワードリセットの準備が完了しました。新しいパスワードを入力してください。')
            
            // URLから認証情報を保存（パスワード更新時に使用）
            sessionStorage.setItem('reset_code', code)
            return
          }
        } catch (err) {
          console.error('コード処理が失敗しました:', err)
          setError('認証処理中にエラーが発生しました。新しいパスワードリセットリンクを取得してください。')
          return
        }
      }

      // 旧形式のaccess_token認証（後方互換性）
      if (accessToken && type === 'recovery') {
        try {
          console.log('レガシーaccess_token形式を使用中')
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || queryParams.get('refresh_token') || ''
          })
          setMessage('パスワードリセットの準備が完了しました。新しいパスワードを入力してください。')
          return
        } catch (err) {
          console.error('レガシートークン処理が失敗しました:', err)
          setError('認証トークンの設定に失敗しました。新しいパスワードリセットリンクを取得してください。')
          return
        }
      }

      // パラメータが不足している場合
      setIsLinkValid(false) // リンクが無効なのでフォームを無効化
      setError('パスワードリセットリンクが不完全です。メールから正しいリンクをクリックしてください。')
    }

    handlePasswordReset()
  }, [])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setMessage('')

    // バリデーション
    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      setIsLoading(false)
      return
    }

    try {
      // 保存されたreset_codeを取得
      const resetCode = sessionStorage.getItem('reset_code')
      
      if (resetCode) {
        // codeを使用してパスワードをリセット
        const { error: updateError } = await supabase.auth.updateUser({
          password: password
        })

        if (updateError) {
          setError('パスワードの更新に失敗しました: ' + updateError.message)
        } else {
          // reset_codeをクリア
          sessionStorage.removeItem('reset_code')
          setMessage('パスワードが正常に更新されました。')
          setIsResetComplete(true)
        }
      } else {
        // 通常のパスワード更新
        const { error: updateError } = await supabase.auth.updateUser({
          password: password
        })

        if (updateError) {
          setError('パスワードの更新に失敗しました: ' + updateError.message)
        } else {
          setMessage('パスワードが正常に更新されました。')
          setIsResetComplete(true)
        }
      }
    } catch (err) {
      setError('予期しないエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
          <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2m0 0V7a2 2 0 012-2m5 0V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2m5 0H9" />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold">
            🔒 パスワード再設定
          </CardTitle>
          <CardDescription className="text-blue-100 mt-2">
            セキュリティのため新しいパスワードを設定してください
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {isResetComplete ? (
            // パスワードリセット完了画面
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-green-800 mb-2">
                  ✅ パスワード更新完了
                </h3>
                <p className="text-green-700 text-lg">
                  パスワードが正常に更新されました
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  新しいパスワードでログインできます
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-green-800 font-medium">
                    セキュリティのため、このページは自動的にログアウトされています
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={async () => {
                    await supabase.auth.signOut()
                    router.push('/')
                  }}
                  className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    ログインページへ進む
                  </div>
                </Button>
              </div>
            </div>
          ) : (
            // パスワード入力フォーム
            <>
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-sm text-yellow-800 font-medium">
                    安全なパスワードを設定してください（6文字以上推奨）
                  </p>
                </div>
              </div>
              
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                    🔑 新しいパスワード
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={isLinkValid ? "新しいパスワードを入力してください" : "リンクが無効なため入力できません"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={isLoading || !isLinkValid}
                    className={`h-12 border-2 transition-colors ${
                      isLinkValid 
                        ? "focus:border-blue-500" 
                        : "bg-gray-100 border-gray-300 cursor-not-allowed"
                    }`}
                  />
                  <p className="text-xs text-gray-500">
                    ※ 6文字以上で設定してください
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700">
                    ✅ パスワード確認
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={isLinkValid ? "上記と同じパスワードを再入力" : "リンクが無効なため入力できません"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={isLoading || !isLinkValid}
                    className={`h-12 border-2 transition-colors ${
                      isLinkValid 
                        ? "focus:border-blue-500" 
                        : "bg-gray-100 border-gray-300 cursor-not-allowed"
                    }`}
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {error}
                      <div className="mt-3 pt-3 border-t border-red-200">
                        <p className="text-xs text-red-600 font-medium">トラブルシューティング:</p>
                        <ul className="text-xs text-red-600 mt-1 space-y-1">
                          <li>• メールから新しいパスワードリセットリンクを取得してください</li>
                          <li>• 古いメールのリンクは使用できません</li>
                          <li>• リンクの有効期限は送信から1時間です</li>
                          <li>• 同じメールアドレスでも新しいリクエストが必要です</li>
                        </ul>
                        <button
                          type="button"
                          onClick={async () => {
                            // セッションをクリアしてログイン画面に戻る
                            await supabase.auth.signOut()
                            router.push('/')
                          }}
                          className="mt-2 text-xs underline text-red-700 hover:text-red-800"
                        >
                          → ログイン画面で新しいリセットリンクを取得
                        </button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {message && !isResetComplete && (
                  <Alert>
                    <AlertDescription>{message}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className={`w-full h-12 font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 ${
                    isLinkValid 
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                  disabled={isLoading || !isLinkValid}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      パスワード更新中...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      {isLinkValid ? (
                        <>
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          パスワードを更新する
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          リンクが無効です
                        </>
                      )}
                    </div>
                  )}
                </Button>

                <div className="text-center pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={async () => {
                      await supabase.auth.signOut()
                      router.push('/')
                    }}
                    disabled={isLoading}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    ← ログインページに戻る
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}