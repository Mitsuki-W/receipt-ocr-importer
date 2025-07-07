import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { AUTH_CONFIG, STORAGE_KEYS } from '@/constants/appConstants'

const { MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION } = AUTH_CONFIG

// ユーザー登録確認関数（エクスポート）
export async function checkUserRegistered(email: string): Promise<boolean> {
  try {
    // Supabaseのauth.usersテーブルを直接クエリ
    const { data, error } = await supabase.rpc('check_user_exists', {
      email_param: email
    })
    
    if (error) {
      console.error('ユーザー存在確認エラー:', error)
      return false
    }
    
    return data || false
  } catch (error) {
    console.error('ユーザー登録確認エラー:', error)
    return false
  }
}

// メールアドレス存在確認関数（エクスポート）
export async function validateEmailExists(email: string): Promise<boolean> {
  try {
    // メールアドレスの基本的な形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return false
    }

    // 一般的な無効ドメインをチェック（拡張版）
    const invalidDomains = [
      'example.com',
      'example.org',
      'example.net',
      'test.com',
      'test.org',
      'testing.com',
      'invalid.com',
      'invalid.org',
      'fake.com',
      'fake.org',
      'dummy.com',
      'dummy.org',
      'temp.com',
      'temporary.com',
      'throwaway.email',
      '10minutemail.com',
      'guerrillamail.com',
      'mailinator.com',
      'tempmail.org',
      'yopmail.com',
      'sharklasers.com',
      'grr.la',
      'guerrillamailblock.com'
    ]
    
    const domain = email.split('@')[1]?.toLowerCase()
    if (invalidDomains.includes(domain)) {
      return false
    }

    // DNS MXレコード確認（簡易版）
    // 実際のMX確認はサーバーサイドで行う必要があるため、
    // ここでは主要プロバイダーのホワイトリストを使用
    const trustedDomains = [
      // 国際的な主要プロバイダー
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'live.com',
      'icloud.com',
      'me.com',
      'mac.com',
      'aol.com',
      'protonmail.com',
      'zoho.com',
      // 日本の主要プロバイダー
      'yahoo.co.jp',
      'docomo.ne.jp',
      'ezweb.ne.jp',
      'au.com',
      'softbank.ne.jp',
      'i.softbank.jp',
      'nifty.com',
      'biglobe.ne.jp',
      'so-net.ne.jp',
      'ocn.ne.jp',
      'rakuten.jp',
      'goo.jp',
      // 企業・教育機関用ドメイン（一般的なパターン）
      // これらは後で動的に判定
    ]

    // 主要プロバイダーの場合は有効とみなす
    if (trustedDomains.includes(domain)) {
      return true
    }

    // 企業・教育機関ドメインの検証
    const domainParts = domain.split('.')
    
    // 最低2つの部分が必要（例: company.com）
    if (domainParts.length < 2) {
      return false
    }
    
    // 各部分が有効な文字列かチェック
    const domainPartRegex = /^[a-z0-9-]+$/
    if (!domainParts.every(part => part.length > 0 && domainPartRegex.test(part))) {
      return false
    }
    
    // トップレベルドメイン（TLD）のチェック
    const tld = domainParts[domainParts.length - 1]
    const validTlds = [
      'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
      'jp', 'co.jp', 'ac.jp', 'go.jp', 'or.jp', 'ne.jp',
      'uk', 'de', 'fr', 'ca', 'au', 'in', 'cn', 'kr'
    ]
    
    // .co.jp, .ac.jp のような複合TLDの処理
    const lastTwoParts = domainParts.slice(-2).join('.')
    if (validTlds.includes(lastTwoParts) || validTlds.includes(tld)) {
      return true
    }

    return false
  } catch (error) {
    console.error('メールアドレス検証エラー:', error)
    // エラーが発生した場合は通す（厳密すぎるチェックを避ける）
    return true
  }
}

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
      setIsLocked(false)
      setLockoutEndTime(null)
      setLoginAttempts(0)
      setRemainingTime(0)
      setError('')
      return
    }

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
  }, [email])

  // 残り時間のカウントダウン
  useEffect(() => {
    if (!isLocked || !lockoutEndTime) return

    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.ceil((lockoutEndTime - now) / 1000)
      
      if (remaining <= 0) {
        setIsLocked(false)
        setLockoutEndTime(null)
        setLoginAttempts(0)
        setRemainingTime(0)
        setError('')
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

  // ログイン失敗時の処理
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
      setError(`メールアドレスまたはパスワードが正しくありません。残り試行回数: ${MAX_LOGIN_ATTEMPTS - newAttempts}回`)
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
        // Rate limiting対策: 短時間での重複リクエストを防ぐ
        const lastSignUpAttempt = localStorage.getItem('last_signup_attempt')
        const now = Date.now()
        if (lastSignUpAttempt && (now - parseInt(lastSignUpAttempt)) < 10000) {
          setError('短時間での連続操作は制限されています。10秒後に再試行してください。')
          return
        }
        localStorage.setItem('last_signup_attempt', now.toString())
        
        // メールアドレスの存在確認
        setMessage('メールアドレスを確認しています...')
        const isValidEmail = await validateEmailExists(email)
        if (!isValidEmail) {
          setError('入力されたメールアドレスは存在しません。正しいメールアドレスを入力してください。')
          return
        }
        
        setMessage('アカウントを作成しています...')
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        
        if (error) {
          // Rate limiting エラーの処理
          if (error.message.includes('Too many requests') || error.message.includes('429')) {
            setError('短時間での操作が多すぎます。しばらく待ってから再試行してください。')
            return
          }
          // 既存ユーザーの場合のエラーハンドリング
          else if (error.message.includes('User already registered') || 
              error.message.includes('already been registered') ||
              error.message.includes('already registered') ||
              error.message.includes('Email address is already registered')) {
            setMessage('') // メッセージをクリア
            setError('このメールアドレスは既に登録されています。ログインしてください。')
            return
          } else {
            throw error
          }
        } else if (data.user) {
          // Supabaseの設定によっては既存ユーザーでもsignUpが成功する場合がある
          // その場合、data.user.identitiesが空配列になることが多い
          if (data.user.identities && data.user.identities.length === 0) {
            setMessage('') // メッセージをクリア
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
          if (error.message.includes('Invalid login credentials')) {
            // メールアドレスが存在するかチェック
            const userExists = await checkUserRegistered(email)
            if (!userExists) {
              setError('このメールアドレスはまだ登録されていません。アカウントを作成しますか？')
              return
            }
            // 登録済みメールアドレスの場合はアカウントロック機能を実行
            handleLoginFailure()
            return
          } else if (error.message.includes('Email not confirmed')) {
            setError('メールアドレスが確認されていません。確認メールをチェックしてください。')
            return
          }
          
          throw error
        }
        
        // ログイン成功時の処理
        handleLoginSuccess()
        window.location.href = '/'
      }
    } catch (error: unknown) {
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
      
      setError(errorMessage)
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