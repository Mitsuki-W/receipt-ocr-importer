import { useState, useMemo } from 'react'
import { Item, FilterState } from '@/types/item'
import { CATEGORIES } from '@/constants/itemConstants'
import { filterItems } from '@/utils/itemFilter'
import { sortItems } from '@/utils/itemSort'

export function useItemsFilter(items: Item[]) {
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    categoryFilter: 'all',
    consumptionFilter: 'default',
    dateFilterFrom: '',
    dateFilterTo: '',
    sortBy: 'newest'
  })

  const [frozenOrder, setFrozenOrder] = useState<Item[]>([])

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    // フィルター変更時は固定順序をリセット
    setFrozenOrder([])
  }

  const clearFilters = () => {
    setFilters({
      searchQuery: '',
      categoryFilter: 'all',
      consumptionFilter: 'default',
      dateFilterFrom: '',
      dateFilterTo: '',
      sortBy: 'newest'
    })
  }

  const filteredItems = useMemo(() => {
    return filterItems(items, filters)
  }, [items, filters])

  const filteredAndSortedItems = useMemo(() => {
    return sortItems(filteredItems, filters.sortBy, frozenOrder)
  }, [filteredItems, filters.sortBy, frozenOrder])

  const availableCategories = useMemo(() => {
    const uniqueCategories = [...new Set(items.map(item => item.category))]
    
    // itemConstants.tsで定義された順序を使用
    const categoryOrder = [...CATEGORIES]
    
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
    filteredAndSortedItems,
    availableCategories,
    frozenOrder,
    setFrozenOrder
  }
}