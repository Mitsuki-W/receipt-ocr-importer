import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Edit } from 'lucide-react'
import { Item } from '@/types/item'
import { getExpiryStatus, getExpiryStatusInfo } from '@/utils/expiryStatus'


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
      className={`relative py-3 ${item.is_consumed ? 'opacity-60' : ''} ${
        statusInfo ? `${statusInfo.bgColor} ${statusInfo.borderColor} border-2` : ''
      }`}
    >
      {/* アラートバッジ */}
      {statusInfo && (
        <div className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.badgeColor} flex items-center gap-1`}>
          <statusInfo.icon className="h-2.5 w-2.5" />
          {expiryStatus === 'expired' ? '期限切れ' : 
           expiryStatus === 'warning' ? '警告' : '注意'}
        </div>
      )}
      
      <div className="px-6">
        <div className="text-base leading-tight font-semibold">{item.name}</div>
        <div className="text-xs text-muted-foreground">{item.category}</div>
        <div className="text-xs">
          <p>{item.quantity} {item.unit}</p>
          {item.expiry_date && (
            <p className={statusInfo ? statusInfo.color : ''}>
              {item.expiry_date}
            </p>
          )}
        </div>
        
        <div className="pt-2 flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(item)}
            className="flex-1 h-7 text-xs"
          >
            <Edit className="h-3 w-3 mr-1" />
            編集
          </Button>
          <Button
            variant={item.is_consumed ? "default" : "outline"}
            size="sm"
            onClick={() => onToggleConsumption(item.id, item.is_consumed)}
            className="flex-1 h-7 text-xs"
          >
            {item.is_consumed ? '戻す' : '消費'}
          </Button>
        </div>
      </div>
    </Card>
  )
}