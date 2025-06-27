interface AuthFormToggleProps {
  isSignUp: boolean
  isLoading: boolean
  onToggle: (isSignUp: boolean) => void
}

export default function AuthFormToggle({
  isSignUp,
  isLoading,
  onToggle,
}: AuthFormToggleProps) {
  return (
    <div className="text-center">
      <button
        type="button"
        onClick={() => onToggle(!isSignUp)}
        className="text-sm text-blue-600 hover:text-blue-500"
        disabled={isLoading}
      >
        {isSignUp 
          ? 'すでにアカウントをお持ちですか？ログイン' 
          : 'アカウントをお持ちでない方はこちら'
        }
      </button>
    </div>
  )
}