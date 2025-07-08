import { useState, useMemo } from 'react'
import { HistoryItem, HistoryFilterState } from '@/types/history'
import { CATEGORIES } from '@/constants/itemConstants'

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
      const beforeCategory = filtered.length
      filtered = filtered.filter(item => item.category === filters.categoryFilter)
      console.log('カテゴリフィルタ適用:', {
        before: beforeCategory,
        after: filtered.length,
        category: filters.categoryFilter
      })
    }

    // 期間フィルタリング
    if (filters.periodFilter !== 'all') {
      const beforePeriod = filtered.length
      const now = new Date()
      let startDate: Date | null = null

      console.log('期間フィルタ計算開始:', {
        periodFilter: filters.periodFilter,
        now: now.toISOString(),
        nowDay: now.getDay(), // 0=日曜日, 1=月曜日, ...
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })

      switch (filters.periodFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'this-week':
          const weekStart = new Date(now)
          // 月曜日を週の開始とする（日曜日=0, 月曜日=1）
          const dayOfWeek = now.getDay()
          const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
          weekStart.setDate(now.getDate() - daysToSubtract)
          weekStart.setHours(0, 0, 0, 0)
          startDate = weekStart
          console.log('今週フィルタ（カレンダー週：月曜日〜日曜日）:', {
            現在日時: now.toISOString(),
            現在曜日: dayOfWeek,
            引く日数: daysToSubtract,
            週開始日: weekStart.toISOString(),
            週開始日_ローカル: weekStart.toString(),
            対象期間: `${weekStart.toISOString().split('T')[0]} 〜 ${new Date(weekStart.getTime() + 6*24*60*60*1000).toISOString().split('T')[0]}`
          })
          break
        case 'this-month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'last-month':
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
          console.log('先月フィルタ:', {
            lastMonth: lastMonth.toISOString(),
            lastMonthEnd: lastMonthEnd.toISOString()
          })
          filtered = filtered.filter(item => {
            const consumedDate = new Date(item.consumed_at)
            const result = consumedDate >= lastMonth && consumedDate <= lastMonthEnd
            console.log('先月フィルタ判定:', {
              itemName: item.name,
              consumed_at: item.consumed_at,
              consumedDate: consumedDate.toISOString(),
              result: result
            })
            return result
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
        console.log('期間フィルタ適用:', {
          startDate: startDate.toISOString(),
          periodFilter: filters.periodFilter
        })
        filtered = filtered.filter(item => {
          const consumedDate = new Date(item.consumed_at)
          const result = consumedDate >= startDate!
          console.log('期間フィルタ判定:', {
            itemName: item.name,
            consumed_at: item.consumed_at,
            consumedDate: consumedDate.toISOString(),
            startDate: startDate!.toISOString(),
            result: result
          })
          return result
        })
      }

      console.log('期間フィルタ適用完了:', {
        before: beforePeriod,
        after: filtered.length,
        periodFilter: filters.periodFilter
      })
    }

    // カスタム日付期間フィルタリング
    if (filters.dateFilterFrom || filters.dateFilterTo) {
      const beforeCustom = filtered.length
      filtered = filtered.filter(item => {
        const consumedDate = new Date(item.consumed_at)
        const fromDate = filters.dateFilterFrom ? new Date(filters.dateFilterFrom) : null
        const toDate = filters.dateFilterTo ? new Date(filters.dateFilterTo) : null
        
        if (fromDate && consumedDate < fromDate) return false
        if (toDate && consumedDate > toDate) return false
        
        return true
      })
      console.log('カスタム日付フィルタ適用:', {
        before: beforeCustom,
        after: filtered.length,
        dateFilterFrom: filters.dateFilterFrom,
        dateFilterTo: filters.dateFilterTo
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
    // 全カテゴリを表示（データに存在しないカテゴリも含む）
    return [...CATEGORIES]
  }, [])

  return {
    filters,
    updateFilter,
    clearFilters,
    filteredItems,
    sortedItems,
    availableCategories
  }
}