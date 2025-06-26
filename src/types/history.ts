import { Item } from './item'

export type HistoryPeriodFilter = 
  | 'all'
  | 'today'
  | 'this-week'
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'custom'

export type HistorySortOption = 
  | 'consumed-desc'    // 消費日（新しい順）
  | 'consumed-asc'     // 消費日（古い順）
  | 'newest'           // 登録日（新しい順）
  | 'oldest'           // 登録日（古い順）
  | 'expiry-asc'       // 期限順（近い順）
  | 'expiry-desc'      // 期限順（遠い順）
  | 'purchase-desc'    // 購入日（新しい順）
  | 'purchase-asc'     // 購入日（古い順）
  | 'name-asc'         // 名前順（あ→ん）
  | 'name-desc'        // 名前順（ん→あ）

export interface HistoryFilterState {
  searchQuery: string
  categoryFilter: string
  periodFilter: HistoryPeriodFilter
  dateFilterFrom: string
  dateFilterTo: string
  sortBy: HistorySortOption
}

export type HistoryItem = Item & {
  consumed_at: string // 履歴では必須
}