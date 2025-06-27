import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

interface ErrorAlertProps {
  error: string
}

export default function ErrorAlert({ error }: ErrorAlertProps) {
  if (!error) return null

  return (
    <Alert 
      variant="destructive" 
      className="bg-red-50/80 border-red-200/60 backdrop-blur-sm shadow-sm"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="text-red-800 font-medium">
        {error}
      </AlertDescription>
    </Alert>
  )
}