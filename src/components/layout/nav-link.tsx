import Link from 'next/link'

interface NavLinkProps {
  href: string
  pathname: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  mobile?: boolean
  tablet?: boolean
}

export default function NavLink({ 
  href, 
  pathname, 
  icon: Icon, 
  children, 
  mobile = false, 
  tablet = false 
}: NavLinkProps) {
  const isActive = pathname === href
  
  if (mobile) {
    return (
      <Link
        href={href}
        className={`relative flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
          isActive
            ? 'text-teal-700 bg-teal-50/80 border border-teal-200/60 shadow-sm'
            : 'text-slate-600 hover:text-slate-800 hover:bg-white/70 hover:shadow-sm'
        }`}
      >
        <Icon className={`h-5 w-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
        <span className="text-center leading-tight">{children}</span>
        {isActive && (
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-xl -z-10" />
        )}
      </Link>
    )
  }
  
  if (tablet) {
    return (
      <Link
        href={href}
        className={`relative flex flex-col items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'text-teal-700 bg-teal-50/80 border border-teal-200/60 shadow-sm'
            : 'text-slate-600 hover:text-slate-800 hover:bg-white/70 hover:shadow-sm'
        }`}
      >
        <Icon className={`h-6 w-6 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
        <span className="text-center leading-tight">{children}</span>
        {isActive && (
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-xl -z-10" />
        )}
      </Link>
    )
  }
  
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 group ${
        isActive
          ? 'text-teal-700 bg-teal-50/80 border border-teal-200/60 shadow-sm'
          : 'text-slate-600 hover:text-slate-800 hover:bg-white/70 hover:shadow-sm'
      }`}
    >
      <Icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
      <span className="leading-tight whitespace-nowrap">{children}</span>
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-teal-50 to-teal-100/50 rounded-xl -z-10" />
      )}
    </Link>
  )
}