import { Button } from '@/components/ui/button'
import NavLink from './nav-link'
import { Home, Upload, Package, History } from 'lucide-react'

interface TabletHeaderProps {
  pathname: string
  onSignOut: () => void
}

export default function TabletHeader({ pathname, onSignOut }: TabletHeaderProps) {
  return (
    <div className="hidden md:block lg:hidden">
      <div className="flex justify-between items-center h-16">
        <h1 className="text-lg font-semibold text-gray-900">
          レシートOCR
        </h1>
        <Button variant="outline" size="sm" onClick={onSignOut}>
          ログアウト
        </Button>
      </div>
      {/* タブレットナビゲーション */}
      <div className="pb-3 border-t">
        <nav className="grid grid-cols-4 gap-2 pt-3">
          <NavLink href="/" pathname={pathname} icon={Home} tablet>
            ダッシュボード
          </NavLink>
          <NavLink href="/upload" pathname={pathname} icon={Upload} tablet>
            アップロード
          </NavLink>
          <NavLink href="/items" pathname={pathname} icon={Package} tablet>
            食材管理
          </NavLink>
          <NavLink href="/history" pathname={pathname} icon={History} tablet>
            履歴
          </NavLink>
        </nav>
      </div>
    </div>
  )
}