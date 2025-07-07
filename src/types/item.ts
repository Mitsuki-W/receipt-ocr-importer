export interface Item {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  price?: number | null
  currency?: string | null
  expiry_date: string | null
  purchase_date: string | null
  is_consumed: boolean
  consumed_at: string | null
  created_at: string
  notes: string | null
}

export type SortOption = 'newest' | 'oldest' | 'expiry-asc' | 'expiry-desc' | 'purchase-asc' | 'purchase-desc' | 'name-asc' | 'name-desc'
export type ConsumptionFilter = 'default' | 'unconsumed' | 'recent-consumed' | 'all-consumed' | 'all'
export type ExpiryStatus = 'expired' | 'warning' | 'caution' | 'normal' | 'no-expiry'

export interface FilterState {
  searchQuery: string
  categoryFilter: string
  consumptionFilter: ConsumptionFilter
  dateFilterFrom: string
  dateFilterTo: string
  sortBy: SortOption
}