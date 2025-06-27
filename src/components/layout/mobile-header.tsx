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
      <div className="flex justify-between items-center h-14 py-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-teal-500 to-teal-600 rounded-md flex items-center justify-center shadow-sm">
            <Package className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 tracking-tight">
              レシートOCR
            </h1>
            <p className="text-xs text-slate-500 leading-none">食材管理</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onSignOut}
          className="bg-white/80 border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs px-3 py-1.5"
        >
          ログアウト
        </Button>
      </div>
      
      {/* モバイルナビゲーション */}
      <div className="pb-3 border-t border-slate-200/60">
        <nav className="grid grid-cols-2 gap-2 pt-3 bg-white/40 backdrop-blur-sm rounded-xl p-2 mx-2 border border-slate-200/60 shadow-sm">
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