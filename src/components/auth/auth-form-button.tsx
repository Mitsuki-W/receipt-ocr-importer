import { Button } from '@/components/ui/button'

interface AuthFormButtonProps {
  isLoading: boolean
  isLocked: boolean
  isSignUp: boolean
  remainingTime: number
  formatRemainingTime: (seconds: number) => string
}

export default function AuthFormButton({
  isLoading,
  isLocked,
  isSignUp,
  remainingTime,
  formatRemainingTime,
}: AuthFormButtonProps) {
  return (
    <Button 
      type="submit" 
      className="w-full" 
      disabled={isLoading || isLocked}
    >
      {isLoading 
        ? '処理中...' 
        : isLocked
          ? `ロック中 (${formatRemainingTime(remainingTime)})`
        : isSignUp 
          ? 'アカウント作成' 
          : 'ログイン'
      }
    </Button>
  )
}