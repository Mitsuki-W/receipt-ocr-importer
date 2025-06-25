import { Item, FilterState } from '@/types/item'

export function isRecentlyConsumed(item: Item): boolean {
  if (!item.is_consumed || !item.consumed_at) return false
  const consumedDate = new Date(item.consumed_at)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return consumedDate >= sevenDaysAgo
}

export function filterItems(items: Item[], filters: FilterState): Item[] {
  let filtered = items

  // 検索クエリでフィルタリング
  if (filters.searchQuery.trim()) {
    filtered = filtered.filter(item => 
      item.name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      item.notes?.toLowerCase().includes(filters.searchQuery.toLowerCase())
    )
  }

  // カテゴリでフィルタリング
  if (filters.categoryFilter !== 'all') {
    filtered = filtered.filter(item => item.category === filters.categoryFilter)
  }

  // 消費状態でフィルタリング
  switch (filters.consumptionFilter) {
    case 'default':
      // デフォルト: 未消費 + 消費済み（7日以内）
      filtered = filtered.filter(item => 
        !item.is_consumed || isRecentlyConsumed(item)
      )
      break
    case 'unconsumed':
      // 未消費のみ
      filtered = filtered.filter(item => !item.is_consumed)
      break
    case 'recent-consumed':
      // 消費済み（7日以内）のみ
      filtered = filtered.filter(item => 
        item.is_consumed && isRecentlyConsumed(item)
      )
      break
    case 'all-consumed':
      // 消費済み（すべて）
      filtered = filtered.filter(item => item.is_consumed)
      break
    case 'all':
      // すべて表示（フィルターなし）
      break
  }

  // 購入日期間でフィルタリング
  if (filters.dateFilterFrom || filters.dateFilterTo) {
    filtered = filtered.filter(item => {
      if (!item.purchase_date) return false
      
      const purchaseDate = new Date(item.purchase_date)
      const fromDate = filters.dateFilterFrom ? new Date(filters.dateFilterFrom) : null
      const toDate = filters.dateFilterTo ? new Date(filters.dateFilterTo) : null
      
      // 開始日のチェック
      if (fromDate && purchaseDate < fromDate) return false
      
      // 終了日のチェック
      if (toDate && purchaseDate > toDate) return false
      
      return true
    })
  }

  return filtered
}