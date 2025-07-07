'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthForm, validateEmailExists, checkUserRegistered } from '@/hooks/useAuthForm'
import { supabase } from '@/lib/supabase/client'
import AuthFormFields from './auth-form-fields'
import AuthFormAlerts from './auth-form-alerts'
import AuthFormButton from './auth-form-button'
import AuthFormToggle from './auth-form-toggle'

export default function AuthForm() {
  const {
    email,
    password,
    isLoading,
    isSignUp,
    message,
    error,
    isLocked,
    remainingTime,
    isRegisteredUser,
    setEmail,
    setPassword,
    setIsSignUp,
    handleAuth,
    formatRemainingTime,
  } = useAuthForm()

  const handleCreateAccount = () => {
    setIsSignUp(true)
  }

  const handlePasswordReset = async (email: string) => {
    try {
      // まずメールアドレスの有効性をチェック
      const isValidEmail = await validateEmailExists(email)
      if (!isValidEmail) {
        alert('入力されたメールアドレスは有効ではありません。正しいメールアドレスを入力してください。')
        return
      }

      // 登録済みユーザーかどうかをチェック
      const isRegistered = await checkUserRegistered(email)
      if (!isRegistered) {
        alert('このメールアドレスは登録されていません。先にアカウントを作成してください。')
        return
      }

      // 日時情報をクエリパラメータに追加
      const timestamp = Date.now()
      const requestTime = new Date().toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tokyo'
      })
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password?t=${timestamp}&request_time=${encodeURIComponent(requestTime)}`
      })
      
      if (error) {
        alert('パスワードリセットメールの送信に失敗しました: ' + error.message)
      } else {
        alert(`パスワードリセットメールを送信しました。\n\n📅 送信日時: ${requestTime}\n📧 送信先: ${email}\n\n注意：リンクの有効期限は1時間です。メール受信後はできるだけ早くクリックしてください。`)
      }
    } catch (err) {
      alert('予期しないエラーが発生しました')
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
            <AuthFormFields
              email={email}
              password={password}
              isLoading={isLoading}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
            />
            
            <AuthFormAlerts
              error={error}
              message={message}
              onCreateAccount={handleCreateAccount}
            />

            <AuthFormButton
              isLoading={isLoading}
              isLocked={isLocked}
              isSignUp={isSignUp}
              remainingTime={remainingTime}
              formatRemainingTime={formatRemainingTime}
            />
            
            <AuthFormToggle
              isSignUp={isSignUp}
              isLoading={isLoading}
              onToggle={setIsSignUp}
            />
            
            {!isSignUp && (
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-500 underline"
                  onClick={() => {
                    const emailInput = email.trim()
                    if (!emailInput) {
                      alert('パスワードをリセットするにはメールアドレスを入力してください')
                      return
                    }
                    
                    if (confirm(`${emailInput} にパスワードリセットメールを送信しますか？`)) {
                      handlePasswordReset(emailInput)
                    }
                  }}
                >
                  パスワードを忘れた場合
                </button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}