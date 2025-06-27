'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthForm } from '@/hooks/useAuthForm'
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
    setEmail,
    setPassword,
    setIsSignUp,
    handleAuth,
    formatRemainingTime,
  } = useAuthForm()

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
          </form>
        </CardContent>
      </Card>
    </div>
  )
}