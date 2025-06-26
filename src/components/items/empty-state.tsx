import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  type: 'no-items' | 'no-filtered-results'
  onAddItem?: () => void
  onClearFilters?: () => void
}

export default function EmptyState({ type, onAddItem, onClearFilters }: EmptyStateProps) {
  if (type === 'no-items') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">まだ食材が登録されていません</p>
            {onAddItem && (
              <Button onClick={onAddItem}>
                最初の食材を追加
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">条件に一致する食材が見つかりませんでした</p>
          {onClearFilters && (
            <Button variant="outline" onClick={onClearFilters}>
              フィルターをクリア
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}