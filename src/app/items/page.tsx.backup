'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import AddItemForm from '@/components/items/add-item-form'
import EditItemDialog from '@/components/items/edit-item-dialog'
import { ArrowUpDown, Search, Filter, X, Edit, AlertCircle, Clock, AlertTriangle } from 'lucide-react'

interface Item {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  expiry_date: string | null
  purchase_date: string | null
  is_consumed: boolean
  created_at: string
  notes: string | null
}

type SortOption = 'newest' | 'oldest' | 'expiry-asc' | 'expiry-desc' | 'purchase-asc' | 'purchase-desc' | 'name-asc' | 'name-desc'
type ConsumptionFilter = 'default' | 'unconsumed' | 'recent-consumed' | 'all-consumed' | 'all'
type ExpiryStatus = 'expired' | 'warning' | 'caution' | 'normal' | 'no-expiry'

export default function ItemsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [consumptionFilter, setConsumptionFilter] = useState<ConsumptionFilter>('default')
  const [dateFilterFrom, setDateFilterFrom] = useState('')
  const [dateFilterTo, setDateFilterTo] = useState('')
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [frozenOrder, setFrozenOrder] = useState<Item[]>([])

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

  const sortItems = (items: Item[], sortOption: SortOption): Item[] => {
    // 固定順序がある場合はそれを使用
    if (frozenOrder.length > 0) {
      const itemMap = new Map(items.map(item => [item.id, item]))
      return frozenOrder.map(frozenItem => itemMap.get(frozenItem.id) || frozenItem).filter(Boolean)
    }
    
    const sorted = [...items]
    
    switch (sortOption) {
      case 'newest':
        return sorted.sort((a, b) => {
          // 第1ソート: 消費状態（未消費→消費済み）
          if (a.is_consumed !== b.is_consumed) {
            return a.is_consumed ? 1 : -1
          }
          // 第2ソート: 登録日（新しい順）
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
      case 'oldest':
        return sorted.sort((a, b) => {
          // 第1ソート: 消費状態（未消費→消費済み）
          if (a.is_consumed !== b.is_consumed) {
            return a.is_consumed ? 1 : -1
          }
          // 第2ソート: 登録日（古い順）
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })
      case 'expiry-asc':
        return sorted.sort((a, b) => {
          // 第1ソート: 消費状態（未消費→消費済み）
          if (a.is_consumed !== b.is_consumed) {
            return a.is_consumed ? 1 : -1
          }
          // 第2ソート: 期限順（近い順）
          if (!a.expiry_date && !b.expiry_date) return 0
          if (!a.expiry_date) return 1
          if (!b.expiry_date) return -1
          return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
        })
      case 'expiry-desc':
        return sorted.sort((a, b) => {
          // 第1ソート: 消費状態（未消費→消費済み）
          if (a.is_consumed !== b.is_consumed) {
            return a.is_consumed ? 1 : -1
          }
          // 第2ソート: 期限順（遠い順）
          if (!a.expiry_date && !b.expiry_date) return 0
          if (!a.expiry_date) return 1
          if (!b.expiry_date) return -1
          return new Date(b.expiry_date).getTime() - new Date(a.expiry_date).getTime()
        })
      case 'purchase-asc':
        return sorted.sort((a, b) => {
          // 第1ソート: 消費状態（未消費→消費済み）
          if (a.is_consumed !== b.is_consumed) {
            return a.is_consumed ? 1 : -1
          }
          // 第2ソート: 購入日順（古い順）
          if (!a.purchase_date && !b.purchase_date) return 0
          if (!a.purchase_date) return 1
          if (!b.purchase_date) return -1
          return new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime()
        })
      case 'purchase-desc':
        return sorted.sort((a, b) => {
          // 第1ソート: 消費状態（未消費→消費済み）
          if (a.is_consumed !== b.is_consumed) {
            return a.is_consumed ? 1 : -1
          }
          // 第2ソート: 購入日順（新しい順）
          if (!a.purchase_date && !b.purchase_date) return 0
          if (!a.purchase_date) return 1
          if (!b.purchase_date) return -1
          return new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
        })
      case 'name-asc':
        return sorted.sort((a, b) => {
          // 第1ソート: 消費状態（未消費→消費済み）
          if (a.is_consumed !== b.is_consumed) {
            return a.is_consumed ? 1 : -1
          }
          // 第2ソート: 名前順（あ→ん）
          return a.name.localeCompare(b.name, 'ja')
        })
      case 'name-desc':
        return sorted.sort((a, b) => {
          // 第1ソート: 消費状態（未消費→消費済み）
          if (a.is_consumed !== b.is_consumed) {
            return a.is_consumed ? 1 : -1
          }
          // 第2ソート: 名前順（ん→あ）
          return b.name.localeCompare(a.name, 'ja')
        })
      default:
        return sorted
    }
  }

  const isRecentlyConsumed = (item: Item): boolean => {
    if (!item.is_consumed || !item.consumed_at) return false
    const consumedDate = new Date(item.consumed_at)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return consumedDate >= sevenDaysAgo
  }

  const getExpiryStatus = (item: Item): ExpiryStatus => {
    if (!item.expiry_date) return 'no-expiry'
    
    const expiryDate = new Date(item.expiry_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    expiryDate.setHours(0, 0, 0, 0)
    
    const diffInDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffInDays < 0) return 'expired'      // 期限切れ
    if (diffInDays <= 3) return 'warning'    // 3日以内
    if (diffInDays <= 7) return 'caution'    // 7日以内
    return 'normal'                           // 通常
  }

  const getExpiryStatusInfo = (status: ExpiryStatus, item: Item) => {
    if (!item.expiry_date) return null
    
    const expiryDate = new Date(item.expiry_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    expiryDate.setHours(0, 0, 0, 0)
    
    const diffInDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    switch (status) {
      case 'expired':
        return {
          icon: AlertCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          message: `${Math.abs(diffInDays)}日前に期限切れ`,
          badgeColor: 'bg-red-100 text-red-800'
        }
      case 'warning':
        return {
          icon: AlertTriangle,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          message: diffInDays === 0 ? '今日が期限' : `あと${diffInDays}日で期限切れ`,
          badgeColor: 'bg-orange-100 text-orange-800'
        }
      case 'caution':
        return {
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          message: `あと${diffInDays}日で期限切れ`,
          badgeColor: 'bg-yellow-100 text-yellow-800'
        }
      default:
        return null
    }
  }

  const filterItems = (items: Item[]): Item[] => {
    let filtered = items

    // 検索クエリでフィルタリング
    if (searchQuery.trim()) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // カテゴリでフィルタリング
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter)
    }

    // 消費状態でフィルタリング
    switch (consumptionFilter) {
      case 'default':
        // デフォルト: 未消費 + 消費済み（7日以内）
        filtered = filtered.filter(item => 
          !item.is_consumed || isRecentlyConsumed(item)
        )
        break
      case 'unconsumed':
        // 未消費のみ
        filtered = filtered.filter(item => !item.is_consumed)
        break
      case 'recent-consumed':
        // 消費済み（7日以内）のみ
        filtered = filtered.filter(item => 
          item.is_consumed && isRecentlyConsumed(item)
        )
        break
      case 'all-consumed':
        // 消費済み（すべて）
        filtered = filtered.filter(item => item.is_consumed)
        break
      case 'all':
        // すべて表示（フィルターなし）
        break
    }

    // 購入日期間でフィルタリング
    if (dateFilterFrom || dateFilterTo) {
      filtered = filtered.filter(item => {
        if (!item.purchase_date) return false
        
        const purchaseDate = new Date(item.purchase_date)
        const fromDate = dateFilterFrom ? new Date(dateFilterFrom) : null
        const toDate = dateFilterTo ? new Date(dateFilterTo) : null
        
        // 開始日のチェック
        if (fromDate && purchaseDate < fromDate) return false
        
        // 終了日のチェック
        if (toDate && purchaseDate > toDate) return false
        
        return true
      })
    }

    return filtered
  }

  const filteredItems = filterItems(items)
  const sortedItems = sortItems(filteredItems, sortBy)

  // 利用可能なカテゴリを取得
  const availableCategories = [...new Set(items.map(item => item.category))].sort()

  const getConsumptionFilterLabel = (filter: ConsumptionFilter): string => {
    switch (filter) {
      case 'default': return '未消費＋最近消費'
      case 'unconsumed': return '未消費のみ'
      case 'recent-consumed': return '最近消費のみ'
      case 'all-consumed': return '消費済み（全て）'
      case 'all': return 'すべて表示'
      default: return ''
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

  const handleSortChange = (newSortBy: SortOption) => {
    setSortBy(newSortBy)
    setFrozenOrder([]) // ソート変更時は固定順序を解除
  }

  const toggleConsumption = async (itemId: string, currentStatus: boolean) => {
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
      const currentSorted = sortItems(filteredItems, sortBy)
      setFrozenOrder(currentSorted)
      
      // アイテムの状態をローカルで更新
      setItems(prevItems => 
        prevItems.map(item => 
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
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
                  value={dateFilterFrom}
                  onChange={(e) => setDateFilterFrom(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">購入日（終了）</Label>
                <Input
                  type="date"
                  value={dateFilterTo}
                  onChange={(e) => setDateFilterTo(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {/* 下段: フィルター・ソート */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* 消費状態フィルター */}
              <div className="sm:w-48">
                <Label className="text-sm font-medium">表示範囲</Label>
                <Select value={consumptionFilter} onValueChange={(value: ConsumptionFilter) => setConsumptionFilter(value)}>
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
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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
                  <Select value={sortBy} onValueChange={handleSortChange}>
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
          {(searchQuery || categoryFilter !== 'all' || consumptionFilter !== 'default' || dateFilterFrom || dateFilterTo) && (
            <div className="mt-4 text-sm text-muted-foreground">
              {filteredItems.length}件の食材が見つかりました
              {searchQuery && ` (検索: "${searchQuery}")`}
              {categoryFilter !== 'all' && ` (カテゴリ: ${categoryFilter})`}
              {consumptionFilter !== 'default' && ` (表示範囲: ${getConsumptionFilterLabel(consumptionFilter)})`}
              {(dateFilterFrom || dateFilterTo) && ` (購入日: ${dateFilterFrom || '開始日未設定'}～${dateFilterTo || '終了日未設定'})`}
            </div>
          )}
        </CardContent>
      </Card>

      {sortedItems.length === 0 && items.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">条件に一致する食材が見つかりませんでした</p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery('')
                  setCategoryFilter('all')
                  setConsumptionFilter('default')
                  setDateFilterFrom('')
                  setDateFilterTo('')
                }}
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
          {sortedItems.map((item) => {
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
                          onClick={() => toggleConsumption(item.id, item.is_consumed)}
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