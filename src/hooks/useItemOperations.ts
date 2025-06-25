import { supabase } from '@/lib/supabase/client'
import { Item, SortOption } from '@/types/item'
import { sortItems } from '@/utils/itemSort'
import { filterItems } from '@/utils/itemFilter'

interface ToggleConsumptionParams {
  items: Item[]
  setItems: (items: Item[]) => void
  frozenOrder: Item[]
  setFrozenOrder: (order: Item[]) => void
  filteredAndSortedItems: Item[]
  sortBy: SortOption
}

export function useItemOperations() {
  const toggleConsumption = async (
    itemId: string, 
    currentStatus: boolean,
    params: ToggleConsumptionParams
  ) => {
    const { items, setItems, frozenOrder, setFrozenOrder, filteredAndSortedItems, sortBy } = params

    try {
      const { error } = await supabase
        .from('items')
        .update({ 
          is_consumed: !currentStatus,
          consumed_at: !currentStatus ? new Date().toISOString() : null
        })
        .eq('id', itemId)

      if (error) throw error
      
      // 現在のソート済みアイテムリストを固定順序として保存
      setFrozenOrder(filteredAndSortedItems)
      
      // アイテムの状態をローカルで更新
      setItems(
        items.map(item => 
          item.id === itemId 
            ? { 
                ...item, 
                is_consumed: !currentStatus,
                consumed_at: !currentStatus ? new Date().toISOString() : null
              }
            : item
        )
      )
    } catch (error) {
      console.error('消費状態更新エラー:', error)
    }
  }

  return {
    toggleConsumption
  }
}