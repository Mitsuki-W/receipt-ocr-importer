import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { AUTH_CONFIG, STORAGE_KEYS } from '@/constants/appConstants'

const { MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION } = AUTH_CONFIG

export interface AuthFormState {
  email: string
  password: string
  isLoading: boolean
  isSignUp: boolean
  message: string
  error: string
  loginAttempts: number
  isLocked: boolean
  lockoutEndTime: number | null
  remainingTime: number
}

export interface AuthFormActions {
  setEmail: (email: string) => void
  setPassword: (password: string) => void
  setIsSignUp: (isSignUp: boolean) => void
  handleAuth: (e: React.FormEvent) => Promise<void>
  formatRemainingTime: (seconds: number) => string
}

export function useAuthForm(): AuthFormState & AuthFormActions {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null)
  const [remainingTime, setRemainingTime] = useState(0)

  // メールアドレス変更時にロック状態をチェック
  useEffect(() => {
    if (!email) {
      // メールアドレスが空の場合はロック状態をクリア
      setIsLocked(false)
      setLockoutEndTime(null)
      setLoginAttempts(0)
      setRemainingTime(0)
      setError('')
      return
    }

    // メールアドレス別のロック情報を取得
    const lockKey = STORAGE_KEYS.LOCKOUT_TIME(email)
    const attemptsKey = STORAGE_KEYS.LOGIN_ATTEMPTS(email)
    
    const storedAttempts = localStorage.getItem(attemptsKey)
    const storedLockoutEnd = localStorage.getItem(lockKey)
    
    if (storedAttempts) {
      setLoginAttempts(parseInt(storedAttempts))
    } else {
      setLoginAttempts(0)
    }
    
    if (storedLockoutEnd) {
      const lockoutEnd = parseInt(storedLockoutEnd)
      const now = Date.now()
      
      if (now < lockoutEnd) {
        setIsLocked(true)
        setLockoutEndTime(lockoutEnd)
        setRemainingTime(Math.ceil((lockoutEnd - now) / 1000))
      } else {
        // ロック期間が終了している場合はクリア
        localStorage.removeItem(attemptsKey)
        localStorage.removeItem(lockKey)
        setLoginAttempts(0)
        setIsLocked(false)
        setLockoutEndTime(null)
        setError('')
      }
    } else {
      setIsLocked(false)
      setLockoutEndTime(null)
      setError('')
    }
  }, [email, lockoutEndTime])

  // 残り時間のカウントダウン
  useEffect(() => {
    if (!isLocked || !lockoutEndTime) return

    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.ceil((lockoutEndTime - now) / 1000)
      
      if (remaining <= 0) {
        // ロック解除
        setIsLocked(false)
        setLockoutEndTime(null)
        setLoginAttempts(0)
        setRemainingTime(0)
        setError('') // エラー文をクリア
        if (email) {
          localStorage.removeItem(STORAGE_KEYS.LOGIN_ATTEMPTS(email))
          localStorage.removeItem(STORAGE_KEYS.LOCKOUT_TIME(email))
        }
        clearInterval(interval)
      } else {
        setRemainingTime(remaining)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isLocked, lockoutEndTime, email])

  // ログイン試行失敗時の処理
  const handleLoginFailure = useCallback(() => {
    if (!email) return
    
    const newAttempts = loginAttempts + 1
    setLoginAttempts(newAttempts)
    
    const attemptsKey = STORAGE_KEYS.LOGIN_ATTEMPTS(email)
    const lockKey = STORAGE_KEYS.LOCKOUT_TIME(email)
    localStorage.setItem(attemptsKey, newAttempts.toString())
    
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockoutEnd = Date.now() + LOCKOUT_DURATION
      setIsLocked(true)
      setLockoutEndTime(lockoutEnd)
      localStorage.setItem(lockKey, lockoutEnd.toString())
      setError(`ログイン試行回数が上限に達しました。15分後に再試行してください。`)
    } else {
      setError(`ログインに失敗しました。残り試行回数: ${MAX_LOGIN_ATTEMPTS - newAttempts}回`)
    }
  }, [email, loginAttempts])

  // ログイン成功時の処理
  const handleLoginSuccess = useCallback(() => {
    setLoginAttempts(0)
    setIsLocked(false)
    setLockoutEndTime(null)
    
    if (email) {
      localStorage.removeItem(STORAGE_KEYS.LOGIN_ATTEMPTS(email))
      localStorage.removeItem(STORAGE_KEYS.LOCKOUT_TIME(email))
    }
  }, [email])

  // 残り時間をフォーマット
  const formatRemainingTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }, [])

  const handleAuth = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    // ロック中はログインを実行しない
    if (isLocked) {
      return
    }
    
    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        
        if (error) {
          // 既存ユーザーの場合のエラーハンドリング
          if (error.message.includes('User already registered') || 
              error.message.includes('already been registered') ||
              error.message.includes('already registered') ||
              error.message.includes('Email address is already registered')) {
            setError('このメールアドレスは既に登録されています。ログインしてください。')
            return
          } else {
            throw error
          }
        } else if (data.user) {
          // Supabaseの設定によっては既存ユーザーでもsignUpが成功する場合がある
          // その場合、data.user.identitiesが空配列になることが多い
          if (data.user.identities && data.user.identities.length === 0) {
            setError('このメールアドレスは既に登録されています。ログインしてください。')
            return
          } else {
            setMessage('確認メールを送信しました。メールをチェックしてください。')
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          // ログイン失敗時の処理
          handleLoginFailure()
          throw error
        }
        // ログイン成功時の処理
        handleLoginSuccess()
        window.location.href = '/'
      }
    } catch (error: unknown) {
      // サインアップの場合はログイン試行カウンターを増やさない
      if (!isSignUp) {
        // その他のエラーメッセージを適切に変換
        let errorMessage = error instanceof Error ? error.message : 'エラーが発生しました'
        
        if (errorMessage.includes('Invalid login credentials')) {
          errorMessage = 'メールアドレスまたはパスワードが正しくありません。'
        } else if (errorMessage.includes('Email not confirmed')) {
          errorMessage = 'メールアドレスが確認されていません。確認メールをチェックしてください。'
        } else if (errorMessage.includes('Password should be at least')) {
          errorMessage = 'パスワードは6文字以上で入力してください。'
        } else if (errorMessage.includes('Invalid email')) {
          errorMessage = '有効なメールアドレスを入力してください。'
        }
        
        // ログイン試行カウンターが更新されていない場合（サインアップエラーなど）
        if (!(error instanceof Error && error.message.includes('Invalid login credentials'))) {
          setError(errorMessage)
        }
      } else {
        // サインアップのエラー処理
        let errorMessage = error instanceof Error ? error.message : 'エラーが発生しました'
        
        if (errorMessage.includes('Password should be at least')) {
          errorMessage = 'パスワードは6文字以上で入力してください。'
        } else if (errorMessage.includes('Invalid email')) {
          errorMessage = '有効なメールアドレスを入力してください。'
        }
        
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }, [email, password, isSignUp, isLocked, handleLoginFailure, handleLoginSuccess])

  const handleIsSignUpChange = useCallback((newIsSignUp: boolean) => {
    setIsSignUp(newIsSignUp)
    setError('')
    setMessage('')
  }, [])

  return {
    email,
    password,
    isLoading,
    isSignUp,
    message,
    error,
    loginAttempts,
    isLocked,
    lockoutEndTime,
    remainingTime,
    setEmail,
    setPassword,
    setIsSignUp: handleIsSignUpChange,
    handleAuth,
    formatRemainingTime,
  }
}