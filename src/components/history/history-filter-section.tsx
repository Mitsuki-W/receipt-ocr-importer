import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowUpDown, Search, Filter, X, Calendar } from 'lucide-react'
import { HistoryFilterState, HistoryPeriodFilter, HistorySortOption } from '@/types/history'

interface HistoryFilterSectionProps {
  filters: HistoryFilterState
  updateFilter: <K extends keyof HistoryFilterState>(key: K, value: HistoryFilterState[K]) => void
  availableCategories: string[]
  filteredItemsCount: number
  onClearFilters: () => void
}

export default function HistoryFilterSection({
  filters,
  updateFilter,
  availableCategories,
  filteredItemsCount,
  // onClearFilters
}: HistoryFilterSectionProps) {
  const hasActiveFilters = filters.searchQuery || 
    filters.categoryFilter !== 'all' || 
    filters.periodFilter !== 'all' || 
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

          {/* 中段: 期間フィルター */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium">期間</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={filters.periodFilter} onValueChange={(value: HistoryPeriodFilter) => updateFilter('periodFilter', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="today">今日</SelectItem>
                    <SelectItem value="this-week">今週</SelectItem>
                    <SelectItem value="this-month">今月</SelectItem>
                    <SelectItem value="last-month">先月</SelectItem>
                    <SelectItem value="last-3-months">過去3ヶ月</SelectItem>
                    <SelectItem value="custom">期間指定</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* カスタム期間の開始日 */}
            {filters.periodFilter === 'custom' && (
              <>
                <div>
                  <Label className="text-sm font-medium">消費日（開始）</Label>
                  <Input
                    type="date"
                    value={filters.dateFilterFrom}
                    onChange={(e) => updateFilter('dateFilterFrom', e.target.value)}
                    className="w-full"
                    placeholder="消費開始日を選択"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">消費日（終了）</Label>
                  <Input
                    type="date"
                    value={filters.dateFilterTo}
                    onChange={(e) => updateFilter('dateFilterTo', e.target.value)}
                    className="w-full"
                    placeholder="消費終了日を選択"
                  />
                </div>
              </>
            )}
          </div>

          {/* 下段: カテゴリ・ソート */}
          <div className="flex flex-col sm:flex-row gap-4">
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
                <Select value={filters.sortBy} onValueChange={(value: HistorySortOption) => updateFilter('sortBy', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consumed-desc">消費日（新しい順）</SelectItem>
                    <SelectItem value="consumed-asc">消費日（古い順）</SelectItem>
                    <SelectItem value="newest">登録日（新しい順）</SelectItem>
                    <SelectItem value="oldest">登録日（古い順）</SelectItem>
                    <SelectItem value="expiry-asc">期限日（近い順）</SelectItem>
                    <SelectItem value="expiry-desc">期限日（遠い順）</SelectItem>
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
            {filteredItemsCount}件の履歴が見つかりました
            {filters.searchQuery && ` (検索: "${filters.searchQuery}")`}
            {filters.categoryFilter !== 'all' && ` (カテゴリ: ${filters.categoryFilter})`}
            {filters.periodFilter !== 'all' && filters.periodFilter !== 'custom' && ` (期間: ${getPeriodLabel(filters.periodFilter)})`}
            {filters.periodFilter === 'custom' && (filters.dateFilterFrom || filters.dateFilterTo) && 
              ` (消費日: ${filters.dateFilterFrom || '開始日未設定'}～${filters.dateFilterTo || '終了日未設定'})`}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getPeriodLabel(period: HistoryPeriodFilter): string {
  switch (period) {
    case 'today': return '今日'
    case 'this-week': return '今週'
    case 'this-month': return '今月'
    case 'last-month': return '先月'
    case 'last-3-months': return '過去3ヶ月'
    default: return ''
  }
}