import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Edit } from 'lucide-react'
import { Item } from '@/types/item'
import { getExpiryStatus, getExpiryStatusInfo } from '@/utils/expiryStatus'

const getCurrencySymbol = (currency: string | undefined | null): string => {
  if (currency === 'JPY') return '¥'
  if (currency === 'USD') return '$'
  return currency || '¥'
}

interface ItemCardProps {
  item: Item
  onEdit: (item: Item) => void
  onToggleConsumption: (itemId: string, currentStatus: boolean) => void
}

export default function ItemCard({ item, onEdit, onToggleConsumption }: ItemCardProps) {
  const expiryStatus = getExpiryStatus(item)
  const statusInfo = getExpiryStatusInfo(expiryStatus, item)

  return (
    <Card 
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
          
          <p><span className="font-medium">登録日:</span> {new Date(item.created_at).toISOString().split('T')[0]}</p>
          
          {item.price !== null && item.price !== undefined && (
            <p><span className="font-medium">価格:</span> {getCurrencySymbol(item.currency)}{item.price}</p>
          )}
          
          {item.notes && (
            <p><span className="font-medium">メモ:</span> {item.notes}</p>
          )}
          
          <div className="pt-2 space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(item)}
                className="flex-1"
              >
                <Edit className="h-3 w-3 mr-1" />
                編集
              </Button>
              <Button
                variant={item.is_consumed ? "default" : "outline"}
                size="sm"
                onClick={() => onToggleConsumption(item.id, item.is_consumed)}
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
}