// アプリケーション全体で使用される定数

// セッション管理
export const SESSION_CONFIG = {
  TIMEOUT: 15 * 60 * 1000, // 15分
  WARNING_TIME: 5 * 60 * 1000, // 5分前に警告
} as const

// ログイン試行制限
export const AUTH_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15分
} as const

// 画像処理
export const IMAGE_CONFIG = {
  MAX_SIZE: 1200,
  QUALITY: 85,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const

// UI設定
export const UI_CONFIG = {
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 200,
  PAGE_SIZE: 20,
} as const

// ローカルストレージキー
export const STORAGE_KEYS = {
  LOGIN_ATTEMPTS: (email: string) => `attempts_${email}`,
  LOCKOUT_TIME: (email: string) => `lockout_${email}`,
  USER_PREFERENCES: 'user_preferences',
} as const

// API設定
export const API_CONFIG = {
  TIMEOUT: 30000, // 30秒
  RETRY_ATTEMPTS: 3,
} as const