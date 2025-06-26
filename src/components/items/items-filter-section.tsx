import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, Search, Filter, X } from 'lucide-react'
import { FilterState, ConsumptionFilter } from '@/types/item'

interface ItemsFilterSectionProps {
  filters: FilterState
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  availableCategories: string[]
  filteredItemsCount: number
  onSortChange: (sortOption: string) => void
  onClearFilters: () => void
}

export default function ItemsFilterSection({
  filters,
  updateFilter,
  availableCategories,
  filteredItemsCount,
  onSortChange,
  onClearFilters
}: ItemsFilterSectionProps) {
  const hasActiveFilters = filters.searchQuery || 
    filters.categoryFilter !== 'all' || 
    filters.consumptionFilter !== 'default' || 
    filters.dateFilterFrom || 
    filters.dateFilterTo

  return (
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
                <Select value={filters.sortBy} onValueChange={onSortChange}>
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
        {hasActiveFilters && (
          <div className="mt-4 text-sm text-muted-foreground">
            {filteredItemsCount}件の食材が見つかりました
            {filters.searchQuery && ` (検索: "${filters.searchQuery}")`}
            {filters.categoryFilter !== 'all' && ` (カテゴリ: ${filters.categoryFilter})`}
            {filters.consumptionFilter !== 'default' && ` (表示範囲: ${filters.consumptionFilter})`}
            {(filters.dateFilterFrom || filters.dateFilterTo) && ` (購入日: ${filters.dateFilterFrom || '開始日未設定'}～${filters.dateFilterTo || '終了日未設定'})`}
          </div>
        )}
      </CardContent>
    </Card>
  )
}