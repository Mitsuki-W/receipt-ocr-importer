'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { useItemsFilter } from '@/hooks/useItemsFilter'
import { useItemOperations } from '@/hooks/useItemOperations'
import AddItemForm from '@/components/items/add-item-form'
import EditItemDialog from '@/components/items/edit-item-dialog'
import { ArrowUpDown, Search, Filter, X, Edit, AlertCircle, AlertTriangle, Clock } from 'lucide-react'
import { Item, ConsumptionFilter, ExpiryStatus } from '@/types/item'
import { getExpiryStatus, getExpiryStatusInfo } from '@/utils/expiryStatus'


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

  const { toggleConsumption } = useItemOperations()

  useEffect(() => {
    if (user) {
      fetchItems()
    }
  }, [user])

  const fetchItems = async () => {
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
  }




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
    fetchItems() // データを再取得して最新状態に同期
  }

  // ソート変更ハンドラー
  const handleSortChange = (sortOption: string) => {
    updateFilter('sortBy', sortOption)
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
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* 上段: 検索 */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="食材名・メモで検索..."
                  value={filters.searchQuery}
                  onChange={(e) => updateFilter('searchQuery', e.target.value)}
                  className="pl-10 pr-10"
                />
                {filters.searchQuery && (
                  <button
                    onClick={() => updateFilter('searchQuery', '')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 中段: 日付期間フィルター */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">購入日（開始）</Label>
                <Input
                  type="date"
                  value={filters.dateFilterFrom}
                  onChange={(e) => updateFilter('dateFilterFrom', e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">購入日（終了）</Label>
                <Input
                  type="date"
                  value={filters.dateFilterTo}
                  onChange={(e) => updateFilter('dateFilterTo', e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {/* 下段: フィルター・ソート */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* 消費状態フィルター */}
              <div className="sm:w-48">
                <Label className="text-sm font-medium">表示範囲</Label>
                <Select value={filters.consumptionFilter} onValueChange={(value: ConsumptionFilter) => updateFilter('consumptionFilter', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">未消費＋最近消費</SelectItem>
                    <SelectItem value="unconsumed">未消費のみ</SelectItem>
                    <SelectItem value="recent-consumed">最近消費のみ</SelectItem>
                    <SelectItem value="all-consumed">消費済み（全て）</SelectItem>
                    <SelectItem value="all">すべて表示</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* カテゴリフィルター */}
              <div className="sm:w-48">
                <Label className="text-sm font-medium">カテゴリ</Label>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={filters.categoryFilter} onValueChange={(value) => updateFilter('categoryFilter', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="カテゴリ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      {availableCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ソート */}
              <div className="sm:w-48">
                <Label className="text-sm font-medium">並び順</Label>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <Select value={filters.sortBy} onValueChange={handleSortChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">登録日（新しい順）</SelectItem>
                      <SelectItem value="oldest">登録日（古い順）</SelectItem>
                      <SelectItem value="expiry-asc">期限順（近い順）</SelectItem>
                      <SelectItem value="expiry-desc">期限順（遠い順）</SelectItem>
                      <SelectItem value="purchase-desc">購入日（新しい順）</SelectItem>
                      <SelectItem value="purchase-asc">購入日（古い順）</SelectItem>
                      <SelectItem value="name-asc">名前順（あ→ん）</SelectItem>
                      <SelectItem value="name-desc">名前順（ん→あ）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* 検索結果サマリー */}
          {(filters.searchQuery || filters.categoryFilter !== 'all' || filters.consumptionFilter !== 'default' || filters.dateFilterFrom || filters.dateFilterTo) && (
            <div className="mt-4 text-sm text-muted-foreground">
              {filteredItems.length}件の食材が見つかりました
              {filters.searchQuery && ` (検索: "${filters.searchQuery}")`}
              {filters.categoryFilter !== 'all' && ` (カテゴリ: ${filters.categoryFilter})`}
              {filters.consumptionFilter !== 'default' && ` (表示範囲: ${filters.consumptionFilter})`}
              {(filters.dateFilterFrom || filters.dateFilterTo) && ` (購入日: ${filters.dateFilterFrom || '開始日未設定'}～${filters.dateFilterTo || '終了日未設定'})`}
            </div>
          )}
        </CardContent>
      </Card>

      {filteredAndSortedItems.length === 0 && items.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">条件に一致する食材が見つかりませんでした</p>
              <Button 
                variant="outline" 
                onClick={handleClearFilters}
              >
                フィルターをクリア
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">まだ食材が登録されていません</p>
              <Button onClick={() => setShowAddForm(true)}>
                最初の食材を追加
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedItems.map((item) => {
            const expiryStatus = getExpiryStatus(item)
            const statusInfo = getExpiryStatusInfo(expiryStatus, item)
            
            return (
              <Card 
                key={item.id} 
                className={`relative ${item.is_consumed ? 'opacity-60' : ''} ${
                  statusInfo ? `${statusInfo.bgColor} ${statusInfo.borderColor} border-2` : ''
                }`}
              >
                {/* アラートバッジ */}
                {statusInfo && (
                  <div className={`absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.badgeColor} flex items-center gap-1`}>
                    <statusInfo.icon className="h-3 w-3" />
                    {expiryStatus === 'expired' ? '期限切れ' : 
                     expiryStatus === 'warning' ? '警告' : '注意'}
                  </div>
                )}
                
                <CardHeader>
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <CardDescription>{item.category}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">数量:</span> {item.quantity} {item.unit}</p>
                    {item.expiry_date && (
                      <div>
                        <p><span className="font-medium">賞味期限:</span> {item.expiry_date}</p>
                        {statusInfo && (
                          <p className={`text-xs ${statusInfo.color} font-medium flex items-center gap-1 mt-1`}>
                            <statusInfo.icon className="h-3 w-3" />
                            {statusInfo.message}
                          </p>
                        )}
                      </div>
                    )}
                    {item.purchase_date && (
                      <p><span className="font-medium">購入日:</span> {item.purchase_date}</p>
                    )}
                    {item.notes && (
                      <p><span className="font-medium">メモ:</span> {item.notes}</p>
                    )}
                    <div className="pt-2 space-y-2">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(item)}
                          className="flex-1"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          編集
                        </Button>
                        <Button
                          variant={item.is_consumed ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleToggleConsumption(item.id, item.is_consumed)}
                          className="flex-1"
                        >
                          {item.is_consumed ? '戻す' : '消費'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
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