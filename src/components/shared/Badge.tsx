interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent'
  className?: string
}

const variants = {
  default: 'bg-[#1E1E1E] text-[#A0A0A0]',
  success: 'bg-green-900/30 text-green-400',
  warning: 'bg-yellow-900/30 text-yellow-400',
  danger: 'bg-red-900/30 text-red-400',
  info: 'bg-blue-900/30 text-blue-400',
  accent: 'bg-[#DA7756]/20 text-[#DA7756]',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
