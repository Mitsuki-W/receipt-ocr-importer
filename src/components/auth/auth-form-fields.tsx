import { Input } from '@/components/ui/input'

interface AuthFormFieldsProps {
  email: string
  password: string
  isLoading: boolean
  onEmailChange: (email: string) => void
  onPasswordChange: (password: string) => void
}

export default function AuthFormFields({
  email,
  password,
  isLoading,
  onEmailChange,
  onPasswordChange,
}: AuthFormFieldsProps) {
  return (
    <>
      <div>
        <Input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      <div>
        <Input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
          disabled={isLoading}
          minLength={6}
        />
      </div>
    </>
  )
}