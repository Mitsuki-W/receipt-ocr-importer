'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CATEGORIES, UNITS } from '@/constants/itemConstants'
import type { Item } from '@/types/item'

interface EditItemDialogProps {
  item: Item | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export default function EditItemDialog({ item, open, onOpenChange, onSuccess }: EditItemDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: item?.name || '',
    category: item?.category || '',
    quantity: item?.quantity?.toString() || '',
    unit: item?.unit || '個',
    price: item?.price?.toString() || '',
    currency: item?.currency === 'JPY' ? '¥' : item?.currency === 'USD' ? '$' : '¥',
    expiry_date: item?.expiry_date || '',
    purchase_date: item?.purchase_date || '',
    notes: item?.notes || ''
  })

  // アイテムが変更されたらフォームデータを更新
  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        category: item.category,
        quantity: item.quantity.toString(),
        unit: item.unit,
        price: item.price?.toString() || '',
        currency: item.currency === 'JPY' ? '¥' : item.currency === 'USD' ? '$' : '¥',
        expiry_date: item.expiry_date || '',
        purchase_date: item.purchase_date || '',
        notes: item.notes || ''
      })
      setError('')
    }
  }, [item])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item) return
    
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase
        .from('items')
        .update({
          name: formData.name,
          category: formData.category || 'その他',
          quantity: parseFloat(formData.quantity) || 1,
          unit: formData.unit,
          price: formData.price ? parseFloat(formData.price) : null,
          currency: formData.currency === '¥' ? 'JPY' : formData.currency === '$' ? 'USD' : formData.currency,
          expiry_date: formData.expiry_date || null,
          purchase_date: formData.purchase_date || null,
          notes: formData.notes || null,
        })
        .eq('id', item.id)

      if (error) throw error
      
      onSuccess()
      onOpenChange(false)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!item || !confirm('この食材を削除しますか？')) return
    
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', item.id)

      if (error) throw error
      
      onSuccess()
      onOpenChange(false)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>食材を編集</DialogTitle>
          <DialogDescription>
            食材の情報を編集できます
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">食材名 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="例: りんご"
              required
            />
          </div>

          <div>
            <Label htmlFor="category">カテゴリ</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
              <SelectTrigger>
                <SelectValue placeholder="カテゴリを選択" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">数量</Label>
              <Input
                id="quantity"
                type="number"
                step="1"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                placeholder="1"
              />
            </div>
            <div>
              <Label htmlFor="unit">単位</Label>
              <Select value={formData.unit} onValueChange={(value) => setFormData({...formData, unit: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">価格</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
                placeholder="100"
              />
            </div>
            <div>
              <Label htmlFor="currency">通貨</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData({...formData, currency: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="¥">¥ (円)</SelectItem>
                  <SelectItem value="$">$ (ドル)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="purchase_date">購入日</Label>
              <Input
                id="purchase_date"
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData({...formData, purchase_date: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="expiry_date">賞味期限</Label>
              <Input
                id="expiry_date"
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">メモ</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="冷蔵庫の野菜室に保存など"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:gap-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? '更新中...' : '更新'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              キャンセル
            </Button>
            <div className="hidden sm:block sm:flex-1"></div>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              削除
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}