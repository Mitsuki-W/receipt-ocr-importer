import { Button } from '@/components/ui/button'
import NavLink from './nav-link'
import { Home, Upload, Package, History } from 'lucide-react'

interface MobileHeaderProps {
  pathname: string
  onSignOut: () => void
}

export default function MobileHeader({ pathname, onSignOut }: MobileHeaderProps) {
  return (
    <div className="md:hidden">
      <div className="flex justify-between items-center h-16">
        <h1 className="text-lg font-semibold text-gray-900">
          レシートOCR
        </h1>
        <Button variant="outline" size="sm" onClick={onSignOut}>
          ログアウト
        </Button>
      </div>
      {/* モバイルナビゲーション */}
      <div className="pb-3 border-t">
        <nav className="grid grid-cols-2 gap-1 pt-3">
          <NavLink href="/" pathname={pathname} icon={Home} mobile>
            ダッシュボード
          </NavLink>
          <NavLink href="/upload" pathname={pathname} icon={Upload} mobile>
            アップロード
          </NavLink>
          <NavLink href="/items" pathname={pathname} icon={Package} mobile>
            食材管理
          </NavLink>
          <NavLink href="/history" pathname={pathname} icon={History} mobile>
            履歴
          </NavLink>
        </nav>
      </div>
    </div>
  )
}