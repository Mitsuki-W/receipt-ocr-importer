import { Button } from '@/components/ui/button'
import NavLink from './nav-link'
import { Home, Upload, Package, History } from 'lucide-react'

interface DesktopHeaderProps {
  pathname: string
  userEmail: string
  onSignOut: () => void
}

export default function DesktopHeader({ 
  pathname, 
  userEmail, 
  onSignOut 
}: DesktopHeaderProps) {
  return (
    <div className="hidden lg:flex justify-between items-center h-16">
      <h1 className="text-xl font-semibold text-gray-900">
        レシートOCRインポーター
      </h1>
      <div className="flex items-center space-x-4">
        <nav className="flex space-x-1">
          <NavLink href="/" pathname={pathname} icon={Home}>
            ダッシュボード
          </NavLink>
          <NavLink href="/upload" pathname={pathname} icon={Upload}>
            アップロード
          </NavLink>
          <NavLink href="/items" pathname={pathname} icon={Package}>
            食材管理
          </NavLink>
          <NavLink href="/history" pathname={pathname} icon={History}>
            履歴
          </NavLink>
        </nav>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">{userEmail}</span>
          <Button variant="outline" size="sm" onClick={onSignOut}>
            ログアウト
          </Button>
        </div>
      </div>
    </div>
  )
}