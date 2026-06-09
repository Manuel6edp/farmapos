import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import type { Product, Category } from '../../types/database'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'

interface ProductForm {
  name: string
  description: string
  barcode: string
  category_id: string
  price: string
  cost: string
  unit: string
  requires_prescription: boolean
}

const defaultForm: ProductForm = {
  name: '', description: '', barcode: '', category_id: '',
  price: '', cost: '', unit: 'unidad', requires_prescription: false,
}

export function ProductsPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(defaultForm)
  const qc = useQueryClient()

  const { data: products = [] } = useQuery({
    queryKey: ['products', search],
    queryFn: async () => {
      let q = supabase.from('products').select('*, categories(name)').order('name')
      if (search) q = q.ilike('name', `%${search}%`)
      const { data } = await q
      return (data ?? []) as (Product & { categories: Category | null })[]
    },
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').order('name')
      return (data ?? []) as Category[]
    },
  })

  const saveProduct = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        barcode: form.barcode || null,
        category_id: form.category_id || null,
        price: parseFloat(form.price) || 0,
        cost: parseFloat(form.cost) || 0,
        unit: form.unit,
        requires_prescription: form.requires_prescription,
      }
      if (editing) {
        await supabase.from('products').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      } else {
        const { data: prod } = await supabase.from('products').insert(payload).select().single()
        if (prod) {
          await supabase.from('inventory').insert({ product_id: prod.id, quantity: 0, min_stock: 0 })
        }
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Producto actualizado' : 'Producto creado')
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      closeModal()
    },
    onError: () => toast.error('Error al guardar el producto'),
  })

  const toggleActive = useMutation({
    mutationFn: async (product: Product) => {
      await supabase.from('products').update({ active: !product.active, updated_at: new Date().toISOString() }).eq('id', product.id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const openCreate = () => { setEditing(null); setForm(defaultForm); setShowModal(true) }
  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({
      name: p.name, description: p.description ?? '', barcode: p.barcode ?? '',
      category_id: p.category_id ?? '', price: String(p.price), cost: String(p.cost),
      unit: p.unit, requires_prescription: p.requires_prescription,
    })
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null) }
  const set = (k: keyof ProductForm, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Productos</h1>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
          </div>
          <Button onClick={openCreate}><Plus size={16} /> Nuevo Producto</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Nombre', 'Categoría', 'Precio', 'Costo', 'Unidad', 'Estado', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{p.name}</p>
                  {p.barcode && <p className="text-xs text-gray-400">{p.barcode}</p>}
                  {p.requires_prescription && <Badge color="purple">Rx</Badge>}
                </td>
                <td className="px-4 py-3 text-gray-600">{(p as any).categories?.name ?? '—'}</td>
                <td className="px-4 py-3 font-semibold text-blue-700">${p.price.toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-600">${p.cost.toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-600">{p.unit}</td>
                <td className="px-4 py-3">
                  <Badge color={p.active ? 'green' : 'gray'}>{p.active ? 'Activo' : 'Inactivo'}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 cursor-pointer">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => toggleActive.mutate(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 cursor-pointer">
                      {p.active ? <ToggleRight size={16} className="text-green-600" /> : <ToggleLeft size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No hay productos registrados</p>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={closeModal} title={editing ? 'Editar Producto' : 'Nuevo Producto'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Nombre *" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
            />
          </div>
          <Input label="Código de barras" value={form.barcode} onChange={e => set('barcode', e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Categoría</label>
            <select
              value={form.category_id}
              onChange={e => set('category_id', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Input label="Precio de venta *" type="number" value={form.price} onChange={e => set('price', e.target.value)} />
          <Input label="Costo" type="number" value={form.cost} onChange={e => set('cost', e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Unidad</label>
            <select
              value={form.unit}
              onChange={e => set('unit', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              {['unidad', 'caja', 'blíster', 'frasco', 'tableta', 'cápsula', 'sobre', 'ampolla'].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="rx"
              type="checkbox"
              checked={form.requires_prescription}
              onChange={e => set('requires_prescription', e.target.checked)}
              className="rounded"
            />
            <label htmlFor="rx" className="text-sm font-medium text-gray-700">Requiere receta</label>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="secondary" className="flex-1" onClick={closeModal}>Cancelar</Button>
          <Button
            className="flex-1"
            loading={saveProduct.isPending}
            disabled={!form.name || !form.price}
            onClick={() => saveProduct.mutate()}
          >
            {editing ? 'Actualizar' : 'Crear Producto'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
