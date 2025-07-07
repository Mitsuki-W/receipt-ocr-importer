import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface AuthFormAlertsProps {
  error: string
  message: string
  onCreateAccount?: () => void
}

export default function AuthFormAlerts({ error, message, onCreateAccount }: AuthFormAlertsProps) {
  const isAccountNotFoundError = error?.includes('このメールアドレスはまだ登録されていません')
  
  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            {isAccountNotFoundError && onCreateAccount && (
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto ml-2 text-sm underline"
                onClick={onCreateAccount}
              >
                新規アカウントを作成
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </>
  )
}