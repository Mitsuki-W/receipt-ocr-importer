'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useItemsFilter } from '@/hooks/useItemsFilter'
import { useItemOperations } from '@/hooks/useItemOperations'
import AddItemForm from '@/components/items/add-item-form'
import EditItemDialog from '@/components/items/edit-item-dialog'
import ItemsFilterSection from '@/components/items/items-filter-section'
import ItemsList from '@/components/items/items-list'
import EmptyState from '@/components/items/empty-state'
import { Item } from '@/types/item'


export default function ItemsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)

  const {
    filters,
    updateFilter,
    clearFilters,
    filteredItems,
    filteredAndSortedItems,
    availableCategories,
    frozenOrder,
    setFrozenOrder
  } = useItemsFilter(items)

  const { toggleConsumption } = useItemOperations({
    items,
    setItems,
    frozenOrder,
    setFrozenOrder,
    filteredAndSortedItems,
    sortBy: filters.sortBy
  })

  const fetchItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user?.id)

      if (error) throw error
      setItems(data || [])
      setFrozenOrder([]) // データ再取得時は固定順序をリセット
    } catch (error) {
      console.error('食材取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }, [user, setFrozenOrder])

  useEffect(() => {
    if (user) {
      fetchItems()
    }
  }, [user, fetchItems])

  const handleAddSuccess = () => {
    setShowAddForm(false)
    fetchItems() // 食材リストを再読み込み
  }

  const handleEditSuccess = () => {
    fetchItems() // 食材リストを再読み込み
  }

  const handleEditClick = (item: Item) => {
    setEditingItem(item)
    setShowEditDialog(true)
  }

  // 消費状態変更ハンドラー
  const handleToggleConsumption = async (itemId: string, currentStatus: boolean) => {
    await toggleConsumption(itemId, currentStatus)
    // fetchItems()は呼ばない - useItemOperations内でローカル状態更新済み
  }

  // ソート変更ハンドラー  
  const handleSortChange = (sortOption: string) => {
    // 型安全なソートオプション変換
    const validSortOptions = ['newest', 'oldest', 'name', 'expiry'] as const
    const typedSortOption = validSortOptions.includes(sortOption as typeof validSortOptions[number]) 
      ? sortOption as typeof validSortOptions[number]
      : 'newest'
    updateFilter('sortBy', typedSortOption)
    setFrozenOrder([]) // ソート変更時は固定順序を解除
  }

  // フィルタークリアハンドラー
  const handleClearFilters = () => {
    clearFilters()
  }

  if (loading) {
    return <div className="text-center">読み込み中...</div>
  }

  if (showAddForm) {
    return (
      <div className="space-y-6">
        <AddItemForm 
          onSuccess={handleAddSuccess}
          onCancel={() => setShowAddForm(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">食材管理</h2>
          <p className="text-muted-foreground">
            登録済みの食材を確認・管理できます
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          新しい食材を追加
        </Button>
      </div>

      {/* 検索・フィルター・ソート */}
      <ItemsFilterSection
        filters={filters}
        updateFilter={updateFilter}
        availableCategories={availableCategories}
        filteredItemsCount={filteredItems.length}
        onSortChange={handleSortChange}
        onClearFilters={handleClearFilters}
      />

      {filteredAndSortedItems.length === 0 && items.length > 0 ? (
        <EmptyState
          type="no-filtered-results"
          onClearFilters={handleClearFilters}
        />
      ) : items.length === 0 ? (
        <EmptyState
          type="no-items"
          onAddItem={() => setShowAddForm(true)}
        />
      ) : (
        <ItemsList
          items={filteredAndSortedItems}
          onEditItem={handleEditClick}
          onToggleConsumption={handleToggleConsumption}
        />
      )}

      {/* 編集ダイアログ */}
      <EditItemDialog
        item={editingItem}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={handleEditSuccess}
      />
    </div>
  )
}