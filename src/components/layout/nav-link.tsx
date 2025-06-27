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
        className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs font-medium transition-colors ${
          isActive
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        <Icon className="h-5 w-5" />
        <span className="text-center">{children}</span>
      </Link>
    )
  }
  
  if (tablet) {
    return (
      <Link
        href={href}
        className={`flex flex-col items-center gap-1 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        <Icon className="h-6 w-6" />
        <span className="text-center">{children}</span>
      </Link>
    )
  }
  
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  )
}