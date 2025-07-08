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
    // 全カテゴリを表示（データに存在しないカテゴリも含む）
    return [...CATEGORIES]
  }, [])

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