import { Alert, AlertDescription } from '@/components/ui/alert'
import { X } from 'lucide-react'

interface ErrorAlertProps {
  error: string
}

export default function ErrorAlert({ error }: ErrorAlertProps) {
  if (!error) return null

  return (
    <Alert variant="destructive">
      <X className="h-4 w-4" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}