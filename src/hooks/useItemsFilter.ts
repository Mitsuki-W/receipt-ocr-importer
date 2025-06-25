import { useState, useMemo } from 'react'
import { Item, FilterState, SortOption, ConsumptionFilter } from '@/types/item'
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
    if (key === 'sortBy') {
      setFrozenOrder([])
    }
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
    return [...new Set(items.map(item => item.category))].sort()
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