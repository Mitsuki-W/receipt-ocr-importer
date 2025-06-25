'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/hooks/useAuth'

interface AddItemFormProps {
  onSuccess: () => void
  onCancel: () => void
}

const CATEGORIES = [
  '野菜',
  '果物',
  '肉類',
  '魚類',
  '乳製品',
  'パン・穀物',
  '調味料',
  '冷凍食品',
  '缶詰・瓶詰',
  'その他'
]

const UNITS = [
  '個',
  'パック',
  'g',
  'kg',
  'ml',
  'L',
  '本',
  '袋',
  '箱',
  '枚'
]

export default function AddItemForm({ onSuccess, onCancel }: AddItemFormProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: '',
    unit: '個',
    expiry_date: '',
    purchase_date: new Date().toISOString().split('T')[0], // 今日の日付
    notes: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase
        .from('items')
        .insert([
          {
            user_id: user.id,
            name: formData.name,
            category: formData.category || 'その他',
            quantity: parseFloat(formData.quantity) || 1,
            unit: formData.unit,
            expiry_date: formData.expiry_date || null,
            purchase_date: formData.purchase_date || null,
            notes: formData.notes || null,
          }
        ])

      if (error) throw error
      
      onSuccess()
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>新しい食材を追加</CardTitle>
        <CardDescription>
          食材の情報を入力してください
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                step="0.1"
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

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? '追加中...' : '追加'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              キャンセル
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}