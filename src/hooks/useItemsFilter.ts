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
    
    // 指定された順序
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
    filteredAndSortedItems,
    availableCategories,
    frozenOrder,
    setFrozenOrder
  }
}