// 食材管理に関する定数

// カテゴリ一覧
export const CATEGORIES = [
  '野菜',
  '果物',
  '肉類',
  '魚類',
  '乳製品',
  'パン・穀物',
  '調味料',
  '飲料',
  'お菓子',
  '冷凍食品',
  '缶詰・瓶詰',
  'その他'
] as const

// 単位一覧
export const UNITS = [
  '個',
  'パック',
  'g',
  'kg',
  'ml',
  'L',
  '本',
  '袋',
  '箱',
  '枚'
] as const

// 食材の状態
export const ITEM_STATUS = {
  FRESH: 'fresh',
  EXPIRING_SOON: 'expiring_soon', 
  EXPIRED: 'expired',
} as const

// 賞味期限の警告日数
export const EXPIRY_WARNING_DAYS = {
  WARNING: 3, // 3日前から警告
  CRITICAL: 1, // 1日前から緊急
} as const

// ソート順序
export const SORT_OPTIONS = {
  NAME_ASC: 'name_asc',
  NAME_DESC: 'name_desc',
  DATE_ASC: 'date_asc', 
  DATE_DESC: 'date_desc',
  EXPIRY_ASC: 'expiry_asc',
  EXPIRY_DESC: 'expiry_desc',
} as const

// 食材型定義
export type Category = typeof CATEGORIES[number]
export type Unit = typeof UNITS[number]
export type ItemStatus = typeof ITEM_STATUS[keyof typeof ITEM_STATUS]
export type SortOption = typeof SORT_OPTIONS[keyof typeof SORT_OPTIONS]