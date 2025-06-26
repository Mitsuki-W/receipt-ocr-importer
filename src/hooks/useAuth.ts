'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

const SESSION_TIMEOUT = 15 * 60 * 1000 // 15分（ミリ秒）
const WARNING_TIME = 5 * 60 * 1000 // 5分前に警告（ミリ秒）

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionWarning, setSessionWarning] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  // ログアウト関数を定義
  const signOut = useCallback(async (isAutoLogout = false) => {
    // タイマーをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
    }
    
    setSessionWarning(false)
    
    if (isAutoLogout) {
      // 自動ログアウトの場合は通知を表示
      alert('セッションが15分間非アクティブだったため、自動的にログアウトしました。')
    }
    
    await supabase.auth.signOut()
  }, [])

  // セッションタイムアウトとログアウト警告を管理
  const resetSessionTimer = useCallback(() => {
    const now = Date.now()
    lastActivityRef.current = now
    setSessionWarning(false)

    // 既存のタイマーをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
    }

    // 10分後に警告を表示
    warningTimeoutRef.current = setTimeout(() => {
      setSessionWarning(true)
    }, SESSION_TIMEOUT - WARNING_TIME)

    // 15分後に自動ログアウト
    timeoutRef.current = setTimeout(async () => {
      // タイマーをクリア
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current)
        warningTimeoutRef.current = null
      }
      
      setSessionWarning(false)
      alert('セッションが15分間非アクティブだったため、自動的にログアウトしました。')
      await supabase.auth.signOut()
    }, SESSION_TIMEOUT)
  }, [signOut])

  // アクティビティ検知用のイベントリスナー
  useEffect(() => {
    if (!user) return

    const activities = ['keypress', 'touchstart', 'click']
    let lastActivityTime = 0
    
    const handleActivity = (event: Event) => {
      const now = Date.now()
      // 500ms以内の連続イベントは無視（デバウンス）
      if (now - lastActivityTime < 500) return
      
      lastActivityTime = now
      resetSessionTimer()
    }

    // イベントリスナーを追加
    activities.forEach(activity => {
      document.addEventListener(activity, handleActivity, true)
    })

    return () => {
      // クリーンアップ
      activities.forEach(activity => {
        document.removeEventListener(activity, handleActivity, true)
      })
    }
  }, [user, resetSessionTimer])

  useEffect(() => {
    // 初期認証状態を取得
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
      
      // セッションが存在する場合、タイマーを開始
      if (session?.user) {
        resetSessionTimer()
      }
    }

    getSession()

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
        
        if (event === 'SIGNED_IN' && session?.user) {
          // ログイン時にタイマーを開始
          resetSessionTimer()
        } else if (event === 'SIGNED_OUT') {
          // ログアウト時にタイマーをクリア
          setSessionWarning(false)
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
          if (warningTimeoutRef.current) {
            clearTimeout(warningTimeoutRef.current)
          }
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [resetSessionTimer])

  // セッション延長（警告が表示された時に使用）
  const extendSession = useCallback(() => {
    if (user) {
      resetSessionTimer()
    }
  }, [user, resetSessionTimer])

  return {
    user,
    loading,
    signOut,
    sessionWarning,
    extendSession
  }
}