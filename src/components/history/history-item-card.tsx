import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HistoryItem } from '@/types/history'
import { Calendar, Clock, ShoppingCart } from 'lucide-react'

interface HistoryItemCardProps {
  item: HistoryItem
}

export default function HistoryItemCard({ item }: HistoryItemCardProps) {
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('ja-JP'),
      time: date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    }
  }

  const consumed = formatDateTime(item.consumed_at)

  return (
    <Card className="opacity-80 border-dashed">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <span>{item.name}</span>
          <span className="text-xs bg-muted px-2 py-1 rounded-full">消費済み</span>
        </CardTitle>
        <CardDescription>{item.category}</CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-2 text-sm">
          <p><span className="font-medium">数量:</span> {item.quantity} {item.unit}</p>
          
          {/* 消費日時 */}
          <div className="flex items-center gap-1 text-green-600">
            <Clock className="h-3 w-3" />
            <span className="font-medium">消費日:</span> {consumed.date} {consumed.time}
          </div>
          
          {/* 購入日 */}
          {item.purchase_date && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <ShoppingCart className="h-3 w-3" />
              <span className="font-medium">購入日:</span> {item.purchase_date}
            </div>
          )}
          
          {/* 賞味期限 */}
          {item.expiry_date && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span className="font-medium">賞味期限:</span> {item.expiry_date}
            </div>
          )}
          
          {/* メモ */}
          {item.notes && (
            <p className="text-muted-foreground">
              <span className="font-medium">メモ:</span> {item.notes}
            </p>
          )}
          
          {/* 消費までの期間計算 */}
          {item.purchase_date && (
            <div className="pt-2 text-xs text-muted-foreground border-t">
              {(() => {
                const purchaseDate = new Date(item.purchase_date)
                const consumedDate = new Date(item.consumed_at)
                const diffDays = Math.floor((consumedDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
                return diffDays >= 0 ? `購入から${diffDays}日後に消費` : ''
              })()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}