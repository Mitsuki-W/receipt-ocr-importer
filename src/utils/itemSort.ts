import { Item, SortOption } from '@/types/item'

type SortComparator = (a: Item, b: Item) => number

const consumptionStatusComparator: SortComparator = (a, b) => {
  if (a.is_consumed !== b.is_consumed) {
    return a.is_consumed ? 1 : -1
  }
  return 0
}

const createDateComparator = (
  getDate: (item: Item) => string | null,
  ascending: boolean = true
): SortComparator => {
  return (a, b) => {
    const statusCmp = consumptionStatusComparator(a, b)
    if (statusCmp !== 0) return statusCmp

    const dateA = getDate(a)
    const dateB = getDate(b)
    
    if (!dateA && !dateB) return 0
    if (!dateA) return 1
    if (!dateB) return -1
    
    const timeA = new Date(dateA).getTime()
    const timeB = new Date(dateB).getTime()
    
    return ascending ? timeA - timeB : timeB - timeA
  }
}

const sortComparators: Record<SortOption, SortComparator> = {
  newest: createDateComparator(item => item.created_at, false),
  oldest: createDateComparator(item => item.created_at, true),
  'expiry-asc': createDateComparator(item => item.expiry_date, true),
  'expiry-desc': createDateComparator(item => item.expiry_date, false),
  'purchase-asc': createDateComparator(item => item.purchase_date, true),
  'purchase-desc': createDateComparator(item => item.purchase_date, false),
  'name-asc': (a, b) => {
    const statusCmp = consumptionStatusComparator(a, b)
    if (statusCmp !== 0) return statusCmp
    return a.name.localeCompare(b.name, 'ja')
  },
  'name-desc': (a, b) => {
    const statusCmp = consumptionStatusComparator(a, b)
    if (statusCmp !== 0) return statusCmp
    return b.name.localeCompare(a.name, 'ja')
  }
}

export function sortItems(items: Item[], sortOption: SortOption, frozenOrder?: Item[]): Item[] {
  if (frozenOrder && frozenOrder.length > 0) {
    const itemMap = new Map(items.map(item => [item.id, item]))
    return frozenOrder.map(frozenItem => itemMap.get(frozenItem.id)).filter(Boolean) as Item[]
  }
  
  return [...items].sort(sortComparators[sortOption])
}