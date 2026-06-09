import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Edit2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import type { InventoryWithProduct } from '../../types/database'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { format } from 'date-fns'

interface AdjustForm {
  type: 'entrada' | 'salida' | 'ajuste'
  quantity: string
  reason: string
  lot_number: string
  expiry_date: string
  min_stock: string
}

export function InventoryPage() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<InventoryWithProduct | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<AdjustForm>({ type: 'entrada', quantity: '', reason: '', lot_number: '', expiry_date: '', min_stock: '' })
  const qc = useQueryClient()

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', search],
    queryFn: async () => {
      let q = supabase
        .from('inventory')
        .select('*, products(id, name, unit, price, active)')
        .order('updated_at', { ascending: false })
      const { data } = await q
      const items = (data ?? []) as InventoryWithProduct[]
      if (search) return items.filter(i => i.products.name.toLowerCase().includes(search.toLowerCase()))
      return items
    },
  })

  const adjustInventory = useMutation({
    mutationFn: async () => {
      if (!selected) return
      const qty = parseFloat(form.quantity)
      let newQty = selected.quantity
      if (form.type === 'entrada') newQty += qty
      else if (form.type === 'salida') newQty = Math.max(0, newQty - qty)
      else newQty = qty

      await supabase.from('inventory').update({
        quantity: newQty,
        lot_number: form.lot_number || selected.lot_number,
        expiry_date: form.expiry_date || selected.expiry_date,
        min_stock: form.min_stock ? parseFloat(form.min_stock) : selected.min_stock,
        updated_at: new Date().toISOString(),
      }).eq('id', selected.id)

      await supabase.from('inventory_movements').insert({
        product_id: selected.product_id,
        type: form.type,
        quantity: qty,
        reason: form.reason || null,
      })
    },
    onSuccess: () => {
      toast.success('Inventario actualizado')
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inventory-map'] })
      setShowModal(false)
    },
    onError: () => toast.error('Error al ajustar inventario'),
  })

  const openModal = (item: InventoryWithProduct) => {
    setSelected(item)
    setForm({ type: 'entrada', quantity: '', reason: '', lot_number: item.lot_number ?? '', expiry_date: item.expiry_date ?? '', min_stock: String(item.min_stock) })
    setShowModal(true)
  }

  const lowStock = inventory.filter(i => i.quantity <= i.min_stock && i.min_stock > 0)
  const expiringSoon = inventory.filter(i => {
    if (!i.expiry_date) return false
    const diff = (new Date(i.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff <= 30
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
        <div className="relative">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="pl-3 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
        </div>
      </div>

      {(lowStock.length > 0 || expiringSoon.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {lowStock.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Stock bajo ({lowStock.length})</p>
                <p className="text-xs text-yellow-600">{lowStock.slice(0, 3).map(i => i.products.name).join(', ')}{lowStock.length > 3 ? '...' : ''}</p>
              </div>
            </div>
          )}
          {expiringSoon.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">Por vencer ({expiringSoon.length})</p>
                <p className="text-xs text-red-600">{expiringSoon.slice(0, 3).map(i => i.products.name).join(', ')}{expiringSoon.length > 3 ? '...' : ''}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Producto', 'Stock Actual', 'Stock Mínimo', 'Lote', 'Vencimiento', 'Estado', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inventory.map(item => {
              const isLow = item.quantity <= item.min_stock && item.min_stock > 0
              const expDiff = item.expiry_date ? (new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24) : null
              const isExpiring = expDiff !== null && expDiff <= 30
              return (
                <tr key={item.id} className={`hover:bg-gray-50 ${isLow ? 'bg-yellow-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.products.name}</p>
                    <p className="text-xs text-gray-400">{item.products.unit}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{item.quantity}</td>
                  <td className="px-4 py-3 text-gray-600">{item.min_stock}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{item.lot_number ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {item.expiry_date ? (
                      <span className={isExpiring ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                        {format(new Date(item.expiry_date), 'dd/MM/yyyy')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {item.quantity === 0
                      ? <Badge color="red">Sin stock</Badge>
                      : isLow
                      ? <Badge color="yellow">Bajo</Badge>
                      : <Badge color="green">OK</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openModal(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 cursor-pointer">
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {inventory.length === 0 && (
          <div className="text-center py-12 text-gray-400">Sin registros de inventario</div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={`Ajustar: ${selected?.products.name}`} size="md">
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['entrada', 'salida', 'ajuste'] as const).map(t => (
              <button
                key={t}
                onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition cursor-pointer ${form.type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}
              >
                {t === 'entrada' ? <><ArrowUpCircle size={14} className="inline mr-1" />Entrada</> : t === 'salida' ? <><ArrowDownCircle size={14} className="inline mr-1" />Salida</> : 'Ajuste'}
              </button>
            ))}
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <span className="text-gray-500">Stock actual:</span>
            <span className="font-bold text-gray-900 ml-2">{selected?.quantity} {selected?.products.unit}</span>
          </div>
          <Input label="Cantidad *" type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
          <Input label="Razón" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Ej: Compra a proveedor" />
          <Input label="Número de lote" value={form.lot_number} onChange={e => setForm(f => ({ ...f, lot_number: e.target.value }))} />
          <Input label="Fecha de vencimiento" type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
          <Input label="Stock mínimo" type="number" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button className="flex-1" loading={adjustInventory.isPending} disabled={!form.quantity} onClick={() => adjustInventory.mutate()}>
              Aplicar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
