import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts'
import { supabase } from '../../lib/supabase'
import type { Sale, SaleItem, Product } from '../../types/database'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingUp, ShoppingBag, DollarSign, Users } from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

type Range = '7d' | '30d' | '90d'

export function ReportsPage() {
  const [range, setRange] = useState<Range>('30d')

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const from = startOfDay(subDays(new Date(), days)).toISOString()
  const to = endOfDay(new Date()).toISOString()

  const { data: sales = [] } = useQuery({
    queryKey: ['report-sales', range],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at')
      return (data ?? []) as Sale[]
    },
  })

  const { data: saleItems = [] } = useQuery({
    queryKey: ['report-items', range],
    queryFn: async () => {
      const { data } = await supabase
        .from('sale_items')
        .select('*, products(name, category_id)')
        .gte('created_at' as any, from)
      return (data ?? []) as (SaleItem & { products: Pick<Product, 'name' | 'category_id'> })[]
    },
  })

  const totalRevenue = sales.reduce((s, v) => s + v.total, 0)
  const totalSales = sales.length
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0
  const pendingBalance = sales.filter(s => s.payment_status === 'pendiente').reduce((s, v) => s + v.total, 0)

  const salesByDay = (() => {
    const map: Record<string, number> = {}
    sales.forEach(s => {
      const day = format(new Date(s.created_at), 'dd/MM', { locale: es })
      map[day] = (map[day] ?? 0) + s.total
    })
    return Object.entries(map).map(([date, total]) => ({ date, total }))
  })()

  const topProducts = (() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {}
    saleItems.forEach(i => {
      const name = i.products?.name ?? 'Desconocido'
      if (!map[name]) map[name] = { name, qty: 0, revenue: 0 }
      map[name].qty += i.quantity
      map[name].revenue += i.subtotal
    })
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  })()

  const paymentMethods = (() => {
    const map: Record<string, number> = {}
    sales.forEach(s => { map[s.payment_method] = (map[s.payment_method] ?? 0) + s.total })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  })()

  const statCards = [
    { label: 'Ingresos Totales', value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Ventas Realizadas', value: totalSales, icon: ShoppingBag, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Ticket Promedio', value: `$${avgTicket.toFixed(2)}`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Saldo por Cobrar', value: `$${pendingBalance.toFixed(2)}`, icon: Users, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['7d', '30d', '90d'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 text-sm font-medium transition cursor-pointer ${range === r ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {r === '7d' ? '7 días' : r === '30d' ? '30 días' : '90 días'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className={`${bg} p-2.5 rounded-lg`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Ventas por Día</h2>
          {salesByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Ventas']} />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Sin datos en el rango seleccionado</div>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Métodos de Pago</h2>
          {paymentMethods.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={paymentMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {paymentMethods.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Sin datos</div>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Top 10 Productos por Ingresos</h2>
        {topProducts.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Ingresos']} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="h-40 flex items-center justify-center text-gray-300 text-sm">Sin datos</div>}
      </div>
    </div>
  )
}
