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
    <div className="hidden lg:flex justify-between items-center h-18 py-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center shadow-sm">
          <Package className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">
            レシート在庫管理
          </h1>
          <p className="text-sm text-slate-500 leading-none">写真で簡単食材管理</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <nav className="flex items-center gap-1 bg-white/60 backdrop-blur-sm rounded-xl p-1.5 border border-slate-200/60 shadow-sm">
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
        
        <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
          <div className="text-right">
            <div className="text-sm font-medium text-slate-700">{userEmail}</div>
            <div className="text-xs text-slate-500">ユーザー</div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onSignOut}
            className="bg-white/80 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-medium transition-all duration-200"
          >
            ログアウト
          </Button>
        </div>
      </div>
    </div>
  )
}