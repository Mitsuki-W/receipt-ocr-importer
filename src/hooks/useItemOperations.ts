import { supabase } from '@/lib/supabase/client'
import { Item, SortOption } from '@/types/item'

interface UseItemOperationsParams {
  items: Item[]
  setItems: (items: Item[]) => void
  frozenOrder: Item[]
  setFrozenOrder: (order: Item[]) => void
  filteredAndSortedItems: Item[]
  sortBy: SortOption
}

export function useItemOperations(params: UseItemOperationsParams) {
  const { items, setItems, setFrozenOrder, filteredAndSortedItems } = params
  // frozenOrder, sortBy は現在未使用

  const toggleConsumption = async (
    itemId: string, 
    currentStatus: boolean
  ) => {
    try {
      // 消費状態変更前の現在の表示順序を固定順序として保存
      setFrozenOrder(filteredAndSortedItems)
      
      const { error } = await supabase
        .from('items')
        .update({ 
          is_consumed: !currentStatus,
          consumed_at: !currentStatus ? new Date().toISOString() : null
        })
        .eq('id', itemId)

      if (error) throw error
      
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