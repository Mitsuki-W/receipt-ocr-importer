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
      <div className="flex justify-between items-center h-16 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center shadow-sm">
            <Package className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              レシートOCR
            </h1>
            <p className="text-xs text-slate-500 leading-none">食材管理</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onSignOut}
          className="bg-white/80 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-medium"
        >
          ログアウト
        </Button>
      </div>
      
      {/* タブレットナビゲーション */}
      <div className="pb-4 border-t border-slate-200/60">
        <nav className="grid grid-cols-4 gap-3 pt-4 bg-white/40 backdrop-blur-sm rounded-xl p-3 mx-2 border border-slate-200/60 shadow-sm">
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