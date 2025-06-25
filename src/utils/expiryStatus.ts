import { Item, ExpiryStatus } from '@/types/item'
import { AlertCircle, Clock, AlertTriangle } from 'lucide-react'

interface ExpiryStatusInfo {
  icon: typeof AlertCircle
  color: string
  bgColor: string
  borderColor: string
  message: string
  badgeColor: string
}

function normalizeDate(date: Date): Date {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

export function getExpiryStatus(item: Item): ExpiryStatus {
  if (!item.expiry_date) return 'no-expiry'
  
  const expiryDate = normalizeDate(new Date(item.expiry_date))
  const today = normalizeDate(new Date())
  
  const diffInDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffInDays < 0) return 'expired'
  if (diffInDays <= 3) return 'warning'
  if (diffInDays <= 7) return 'caution'
  return 'normal'
}

export function getExpiryStatusInfo(status: ExpiryStatus, item: Item): ExpiryStatusInfo | null {
  if (!item.expiry_date || status === 'normal' || status === 'no-expiry') return null
  
  const expiryDate = normalizeDate(new Date(item.expiry_date))
  const today = normalizeDate(new Date())
  const diffInDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  const statusConfigs: Record<ExpiryStatus, ExpiryStatusInfo | null> = {
    expired: {
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      message: `${Math.abs(diffInDays)}日前に期限切れ`,
      badgeColor: 'bg-red-100 text-red-800'
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      message: diffInDays === 0 ? '今日が期限' : `あと${diffInDays}日で期限切れ`,
      badgeColor: 'bg-orange-100 text-orange-800'
    },
    caution: {
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      message: `あと${diffInDays}日で期限切れ`,
      badgeColor: 'bg-yellow-100 text-yellow-800'
    },
    normal: null,
    'no-expiry': null
  }
  
  return statusConfigs[status]
}