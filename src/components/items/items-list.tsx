import { Item } from '@/types/item'
import ItemCard from './item-card'

interface ItemsListProps {
  items: Item[]
  onEditItem: (item: Item) => void
  onToggleConsumption: (itemId: string, currentStatus: boolean) => void
}

export default function ItemsList({ items, onEditItem, onToggleConsumption }: ItemsListProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          onEdit={onEditItem}
          onToggleConsumption={onToggleConsumption}
        />
      ))}
    </div>
  )
}