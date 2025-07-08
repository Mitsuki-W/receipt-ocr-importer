'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useHistoryFilter } from '@/hooks/useHistoryFilter'
import HistoryFilterSection from '@/components/history/history-filter-section'
import HistoryItemCard from '@/components/history/history-item-card'
import EmptyState from '@/components/items/empty-state'
import { HistoryItem } from '@/types/history'
import { ArrowLeft } from 'lucide-react'

export default function HistoryPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const {
    filters,
    updateFilter,
    clearFilters,
    filteredItems,
    sortedItems,
    availableCategories
  } = useHistoryFilter(items)

  const fetchHistoryItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_consumed', true)
        .not('consumed_at', 'is', null)
        .order('consumed_at', { ascending: false })

      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error('履歴取得エラー:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchHistoryItems()
    }
  }, [user, fetchHistoryItems])

  if (loading) {
    return <div className="text-center">読み込み中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">消費履歴</h2>
          <p className="text-muted-foreground">
            消費済みの食材履歴を確認できます
          </p>
        </div>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          戻る
        </Button>
      </div>

      {/* フィルター・検索・ソート */}
      <HistoryFilterSection
        filters={filters}
        updateFilter={updateFilter}
        availableCategories={availableCategories}
        filteredItemsCount={filteredItems.length}
        onClearFilters={clearFilters}
      />

      {sortedItems.length === 0 && items.length > 0 ? (
        <EmptyState
          type="no-filtered-results"
          onClearFilters={clearFilters}
        />
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">まだ消費履歴がありません</p>
          <p className="text-sm text-muted-foreground">食材を消費すると、ここに履歴が表示されます</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedItems.map((item) => (
            <HistoryItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}