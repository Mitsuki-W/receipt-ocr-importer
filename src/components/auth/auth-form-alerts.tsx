import { Alert, AlertDescription } from '@/components/ui/alert'

interface AuthFormAlertsProps {
  error: string
  message: string
}

export default function AuthFormAlerts({ error, message }: AuthFormAlertsProps) {
  return (
    <>
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
    </>
  )
}