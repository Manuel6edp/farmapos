import { NavLink } from 'react-router-dom'
import { ShoppingCart, Package, Archive, Users, BarChart2, Pill } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Punto de Venta', icon: ShoppingCart },
  { to: '/productos', label: 'Productos', icon: Package },
  { to: '/inventario', label: 'Inventario', icon: Archive },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/reportes', label: 'Reportes', icon: BarChart2 },
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-200">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg">
            <Pill size={18} />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-none">FarmaPos</p>
            <p className="text-xs text-gray-400 mt-0.5">Sistema de Ventas</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-400">© 2026 FarmaPos</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
