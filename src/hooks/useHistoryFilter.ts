import { useState, useMemo } from 'react'
import { HistoryItem, HistoryFilterState } from '@/types/history'
// import { HistorySortOption, HistoryPeriodFilter } from '@/types/history' // 現在未使用

export function useHistoryFilter(items: HistoryItem[]) {
  const [filters, setFilters] = useState<HistoryFilterState>({
    searchQuery: '',
    categoryFilter: 'all',
    periodFilter: 'all',
    dateFilterFrom: '',
    dateFilterTo: '',
    sortBy: 'consumed-desc'
  })

  const updateFilter = <K extends keyof HistoryFilterState>(key: K, value: HistoryFilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    
    // 期間フィルターが変更された場合、カスタム以外なら日付フィルターをクリア
    if (key === 'periodFilter' && value !== 'custom') {
      setFilters(prev => ({ ...prev, dateFilterFrom: '', dateFilterTo: '' }))
    }
  }

  const clearFilters = () => {
    setFilters({
      searchQuery: '',
      categoryFilter: 'all',
      periodFilter: 'all',
      dateFilterFrom: '',
      dateFilterTo: '',
      sortBy: 'consumed-desc'
    })
  }

  const filteredItems = useMemo(() => {
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

    // 期間フィルタリング
    if (filters.periodFilter !== 'all') {
      const now = new Date()
      let startDate: Date | null = null

      switch (filters.periodFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'this-week':
          const weekStart = new Date(now)
          weekStart.setDate(now.getDate() - now.getDay())
          weekStart.setHours(0, 0, 0, 0)
          startDate = weekStart
          break
        case 'this-month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'last-month':
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
          filtered = filtered.filter(item => {
            const consumedDate = new Date(item.consumed_at)
            return consumedDate >= lastMonth && consumedDate <= lastMonthEnd
          })
          break
        case 'last-3-months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
          break
        case 'custom':
          // カスタム期間は日付フィルターで処理
          break
      }

      if (startDate && filters.periodFilter !== 'last-month') {
        filtered = filtered.filter(item => {
          const consumedDate = new Date(item.consumed_at)
          return consumedDate >= startDate!
        })
      }
    }

    // カスタム日付期間フィルタリング
    if (filters.dateFilterFrom || filters.dateFilterTo) {
      filtered = filtered.filter(item => {
        const consumedDate = new Date(item.consumed_at)
        const fromDate = filters.dateFilterFrom ? new Date(filters.dateFilterFrom) : null
        const toDate = filters.dateFilterTo ? new Date(filters.dateFilterTo) : null
        
        if (fromDate && consumedDate < fromDate) return false
        if (toDate && consumedDate > toDate) return false
        
        return true
      })
    }

    return filtered
  }, [items, filters])

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      switch (filters.sortBy) {
        case 'consumed-desc':
          return new Date(b.consumed_at).getTime() - new Date(a.consumed_at).getTime()
        case 'consumed-asc':
          return new Date(a.consumed_at).getTime() - new Date(b.consumed_at).getTime()
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'expiry-asc':
          if (!a.expiry_date && !b.expiry_date) return 0
          if (!a.expiry_date) return 1
          if (!b.expiry_date) return -1
          return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
        case 'expiry-desc':
          if (!a.expiry_date && !b.expiry_date) return 0
          if (!a.expiry_date) return 1
          if (!b.expiry_date) return -1
          return new Date(b.expiry_date).getTime() - new Date(a.expiry_date).getTime()
        case 'purchase-desc':
          if (!a.purchase_date && !b.purchase_date) return 0
          if (!a.purchase_date) return 1
          if (!b.purchase_date) return -1
          return new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
        case 'purchase-asc':
          if (!a.purchase_date && !b.purchase_date) return 0
          if (!a.purchase_date) return 1
          if (!b.purchase_date) return -1
          return new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime()
        case 'name-asc':
          return a.name.localeCompare(b.name, 'ja')
        case 'name-desc':
          return b.name.localeCompare(a.name, 'ja')
        default:
          return 0
      }
    })
  }, [filteredItems, filters.sortBy])

  const availableCategories = useMemo(() => {
    const uniqueCategories = [...new Set(items.map(item => item.category))]
    
    // 指定された順序（食品管理画面と同じ）
    const categoryOrder = [
      '野菜',
      '肉類', 
      '乳製品',
      '果物',
      'パン・穀物',
      '調味料',
      '飲料',
      'お菓子',
      'その他'
    ]
    
    // 指定順序に従ってソート、存在しないカテゴリは末尾に追加
    const sortedCategories = categoryOrder.filter(cat => uniqueCategories.includes(cat))
    const remainingCategories = uniqueCategories.filter(cat => !categoryOrder.includes(cat)).sort()
    
    return [...sortedCategories, ...remainingCategories]
  }, [items])

  return {
    filters,
    updateFilter,
    clearFilters,
    filteredItems,
    sortedItems,
    availableCategories
  }
}