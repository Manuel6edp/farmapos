import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Trash2, Plus, Minus, ShoppingCart, X, User, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import type { Product, CartItem, Customer } from '../../types/database'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'

const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia', 'crédito']

export function PosPage() {
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [amountPaid, setAmountPaid] = useState('')
  const qc = useQueryClient()

  const { data: products = [] } = useQuery({
    queryKey: ['products-pos', search],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name')
      if (search) q = q.ilike('name', `%${search}%`)
      const { data } = await q
      return (data ?? []) as Product[]
    },
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-pos', customerSearch],
    queryFn: async () => {
      let q = supabase.from('customers').select('*').order('name')
      if (customerSearch) q = q.ilike('name', `%${customerSearch}%`)
      const { data } = await q
      return (data ?? []) as Customer[]
    },
    enabled: showCustomerModal,
  })

  const { data: inventoryMap = {} } = useQuery({
    queryKey: ['inventory-map'],
    queryFn: async () => {
      const { data } = await supabase.from('inventory').select('product_id, quantity')
      const map: Record<string, number> = {}
      data?.forEach(i => { map[i.product_id] = i.quantity })
      return map
    },
  })

  const completeSale = useMutation({
    mutationFn: async () => {
      const subtotal = cart.reduce((s, i) => s + i.subtotal, 0)
      const discount = cart.reduce((s, i) => s + i.discount * i.quantity, 0)
      const total = subtotal

      const { data: sale, error } = await supabase
        .from('sales')
        .insert({
          customer_id: selectedCustomer?.id ?? null,
          total,
          discount,
          tax: 0,
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'crédito' ? 'pendiente' : 'pagado',
        })
        .select()
        .single()

      if (error) throw error

      const items = cart.map(i => ({
        sale_id: sale.id,
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
        subtotal: i.subtotal,
      }))

      await supabase.from('sale_items').insert(items)

      for (const item of cart) {
        const current = inventoryMap[item.product.id] ?? 0
        await supabase.from('inventory').upsert({
          product_id: item.product.id,
          quantity: Math.max(0, current - item.quantity),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id' })

        await supabase.from('inventory_movements').insert({
          product_id: item.product.id,
          type: 'salida',
          quantity: item.quantity,
          reason: 'Venta',
          reference_id: sale.id,
        })
      }

      if (selectedCustomer && paymentMethod === 'crédito') {
        await supabase.from('customers').update({
          current_balance: selectedCustomer.current_balance + total,
        }).eq('id', selectedCustomer.id)
      }
    },
    onSuccess: () => {
      toast.success('Venta registrada correctamente')
      setCart([])
      setSelectedCustomer(null)
      setPaymentMethod('efectivo')
      setShowPayModal(false)
      setAmountPaid('')
      qc.invalidateQueries({ queryKey: ['inventory-map'] })
      qc.invalidateQueries({ queryKey: ['sales'] })
    },
    onError: () => toast.error('Error al registrar la venta'),
  })

  const addToCart = useCallback((product: Product) => {
    const stock = inventoryMap[product.id] ?? 0
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        if (existing.quantity >= stock) {
          toast.error('Sin stock suficiente')
          return prev
        }
        return prev.map(i =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unit_price }
            : i
        )
      }
      if (stock <= 0) { toast.error('Producto sin stock'); return prev }
      return [...prev, { product, quantity: 1, unit_price: product.price, discount: 0, subtotal: product.price }]
    })
  }, [inventoryMap])

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev
      .map(i => {
        if (i.product.id !== productId) return i
        const q = Math.max(0, i.quantity + delta)
        return { ...i, quantity: q, subtotal: q * i.unit_price }
      })
      .filter(i => i.quantity > 0)
    )
  }

  const removeItem = (productId: string) => setCart(prev => prev.filter(i => i.product.id !== productId))

  const total = cart.reduce((s, i) => s + i.subtotal, 0)
  const change = parseFloat(amountPaid || '0') - total

  return (
    <div className="flex h-full">
      {/* Products panel */}
      <div className="flex-1 flex flex-col p-4 gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Punto de Venta</h1>
          <div className="flex-1" />
          <div className="relative w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
          {products.map(p => {
            const stock = inventoryMap[p.id] ?? 0
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={stock <= 0}
                className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-blue-400 hover:shadow-sm transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="flex items-start justify-between gap-1 mb-2">
                  <p className="text-sm font-medium text-gray-900 leading-tight">{p.name}</p>
                  {p.requires_prescription && <Badge color="purple">Rx</Badge>}
                </div>
                <p className="text-lg font-bold text-blue-700">${p.price.toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">Stock: {stock} {p.unit}</p>
              </button>
            )
          })}
          {products.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
              <Package size={40} className="mb-2 opacity-50" />
              <p className="text-sm">No se encontraron productos</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingCart size={16} /> Carrito
            </h2>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-500 hover:underline cursor-pointer">
                Limpiar
              </button>
            )}
          </div>
          <button
            onClick={() => setShowCustomerModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition cursor-pointer"
          >
            <User size={14} />
            {selectedCustomer ? selectedCustomer.name : 'Asignar cliente (opcional)'}
            {selectedCustomer && <X size={12} className="ml-auto" onClick={e => { e.stopPropagation(); setSelectedCustomer(null) }} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <ShoppingCart size={36} />
              <p className="text-sm mt-2">Carrito vacío</p>
            </div>
          )}
          {cart.map(item => (
            <div key={item.product.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{item.product.name}</p>
                <p className="text-xs text-gray-500">${item.unit_price.toFixed(2)} c/u</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.product.id, -1)} className="p-0.5 rounded hover:bg-gray-200 cursor-pointer"><Minus size={12} /></button>
                <span className="text-xs w-5 text-center font-medium">{item.quantity}</span>
                <button onClick={() => updateQty(item.product.id, 1)} className="p-0.5 rounded hover:bg-gray-200 cursor-pointer"><Plus size={12} /></button>
              </div>
              <p className="text-xs font-semibold text-gray-900 w-14 text-right">${item.subtotal.toFixed(2)}</p>
              <button onClick={() => removeItem(item.product.id)} className="text-gray-300 hover:text-red-500 cursor-pointer"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 space-y-3">
          <div className="flex justify-between text-sm font-bold">
            <span>Total</span>
            <span className="text-blue-700 text-lg">${total.toFixed(2)}</span>
          </div>
          <select
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
            ))}
          </select>
          <Button
            className="w-full"
            disabled={cart.length === 0}
            onClick={() => setShowPayModal(true)}
          >
            Cobrar ${total.toFixed(2)}
          </Button>
        </div>
      </div>

      {/* Customer modal */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Seleccionar Cliente">
        <Input
          placeholder="Buscar por nombre..."
          value={customerSearch}
          onChange={e => setCustomerSearch(e.target.value)}
          className="mb-3"
        />
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {customers.map(c => (
            <button
              key={c.id}
              onClick={() => { setSelectedCustomer(c); setShowCustomerModal(false) }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-sm cursor-pointer"
            >
              <p className="font-medium text-gray-900">{c.name}</p>
              <p className="text-xs text-gray-400">{c.phone} · Saldo: ${c.current_balance.toFixed(2)}</p>
            </button>
          ))}
          {customers.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin resultados</p>}
        </div>
      </Modal>

      {/* Payment modal */}
      <Modal open={showPayModal} onClose={() => setShowPayModal(false)} title="Confirmar Pago">
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total a cobrar</p>
            <p className="text-3xl font-bold text-blue-700">${total.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">Método: {paymentMethod}</p>
            {selectedCustomer && <p className="text-xs text-gray-500">Cliente: {selectedCustomer.name}</p>}
          </div>
          {paymentMethod === 'efectivo' && (
            <Input
              label="Monto recibido"
              type="number"
              value={amountPaid}
              onChange={e => setAmountPaid(e.target.value)}
              placeholder="0.00"
            />
          )}
          {paymentMethod === 'efectivo' && parseFloat(amountPaid) > 0 && (
            <div className={`p-3 rounded-lg text-sm font-medium ${change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {change >= 0 ? `Cambio: $${change.toFixed(2)}` : `Falta: $${Math.abs(change).toFixed(2)}`}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowPayModal(false)}>Cancelar</Button>
            <Button
              className="flex-1"
              variant="success"
              loading={completeSale.isPending}
              disabled={paymentMethod === 'efectivo' && parseFloat(amountPaid || '0') < total}
              onClick={() => completeSale.mutate()}
            >
              Confirmar Venta
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
