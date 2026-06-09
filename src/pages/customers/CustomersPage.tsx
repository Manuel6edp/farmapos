import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Edit2, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import type { Customer, CustomerPayment, SaleWithCustomer } from '../../types/database'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { format } from 'date-fns'

interface CustomerForm {
  name: string
  email: string
  phone: string
  address: string
  document_number: string
  credit_limit: string
  notes: string
}

const defaultForm: CustomerForm = { name: '', email: '', phone: '', address: '', document_number: '', credit_limit: '0', notes: '' }

export function CustomersPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(defaultForm)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('efectivo')
  const qc = useQueryClient()

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', search],
    queryFn: async () => {
      let q = supabase.from('customers').select('*').order('name')
      if (search) q = q.ilike('name', `%${search}%`)
      const { data } = await q
      return (data ?? []) as Customer[]
    },
  })

  const { data: customerSales = [] } = useQuery({
    queryKey: ['customer-sales', selected?.id],
    queryFn: async () => {
      const { data } = await supabase.from('sales').select('*').eq('customer_id', selected!.id).order('created_at', { ascending: false }).limit(20)
      return (data ?? []) as SaleWithCustomer[]
    },
    enabled: !!selected && showDetailModal,
  })

  const { data: payments = [] } = useQuery({
    queryKey: ['customer-payments', selected?.id],
    queryFn: async () => {
      const { data } = await supabase.from('customer_payments').select('*').eq('customer_id', selected!.id).order('created_at', { ascending: false }).limit(20)
      return (data ?? []) as CustomerPayment[]
    },
    enabled: !!selected && showDetailModal,
  })

  const saveCustomer = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name, email: form.email || null, phone: form.phone || null,
        address: form.address || null, document_number: form.document_number || null,
        credit_limit: parseFloat(form.credit_limit) || 0, notes: form.notes || null,
      }
      if (editing) {
        await supabase.from('customers').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      } else {
        await supabase.from('customers').insert(payload)
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Cliente actualizado' : 'Cliente creado')
      qc.invalidateQueries({ queryKey: ['customers'] })
      closeModal()
    },
    onError: () => toast.error('Error al guardar'),
  })

  const registerPayment = useMutation({
    mutationFn: async () => {
      if (!selected) return
      const amount = parseFloat(payAmount)
      await supabase.from('customer_payments').insert({
        customer_id: selected.id,
        amount,
        payment_method: payMethod,
      })
      await supabase.from('customers').update({
        current_balance: Math.max(0, selected.current_balance - amount),
        updated_at: new Date().toISOString(),
      }).eq('id', selected.id)
    },
    onSuccess: () => {
      toast.success('Pago registrado')
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['customer-payments', selected?.id] })
      setShowPayModal(false)
      setPayAmount('')
    },
    onError: () => toast.error('Error al registrar pago'),
  })

  const openCreate = () => { setEditing(null); setForm(defaultForm); setShowModal(true) }
  const openEdit = (c: Customer) => {
    setEditing(c)
    setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '', document_number: c.document_number ?? '', credit_limit: String(c.credit_limit), notes: c.notes ?? '' })
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null) }
  const set = (k: keyof CustomerForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
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
          <Button onClick={openCreate}><Plus size={16} /> Nuevo Cliente</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Cliente', 'Contacto', 'Documento', 'Límite Crédito', 'Saldo Pendiente', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  {c.notes && <p className="text-xs text-gray-400 truncate max-w-40">{c.notes}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  <p>{c.phone ?? '—'}</p>
                  <p className="text-xs text-gray-400">{c.email ?? ''}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{c.document_number ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">${c.credit_limit.toFixed(2)}</td>
                <td className="px-4 py-3">
                  {c.current_balance > 0
                    ? <Badge color="red">${c.current_balance.toFixed(2)}</Badge>
                    : <Badge color="green">Al día</Badge>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 cursor-pointer">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => { setSelected(c); setShowDetailModal(true) }} className="p-1.5 rounded hover:bg-gray-100 text-blue-500 cursor-pointer text-xs font-medium">
                      Ver
                    </button>
                    {c.current_balance > 0 && (
                      <button onClick={() => { setSelected(c); setShowPayModal(true) }} className="p-1.5 rounded hover:bg-gray-100 text-green-600 cursor-pointer">
                        <DollarSign size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <div className="text-center py-12 text-gray-400">No hay clientes registrados</div>
        )}
      </div>

      {/* Form modal */}
      <Modal open={showModal} onClose={closeModal} title={editing ? 'Editar Cliente' : 'Nuevo Cliente'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Input label="Nombre *" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <Input label="Teléfono" value={form.phone} onChange={e => set('phone', e.target.value)} />
          <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          <Input label="Documento" value={form.document_number} onChange={e => set('document_number', e.target.value)} />
          <Input label="Límite de crédito" type="number" value={form.credit_limit} onChange={e => set('credit_limit', e.target.value)} />
          <div className="col-span-2"><Input label="Dirección" value={form.address} onChange={e => set('address', e.target.value)} /></div>
          <div className="col-span-2">
            <label className="text-sm font-medium text-gray-700">Notas</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={2} />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="secondary" className="flex-1" onClick={closeModal}>Cancelar</Button>
          <Button className="flex-1" loading={saveCustomer.isPending} disabled={!form.name} onClick={() => saveCustomer.mutate()}>
            {editing ? 'Actualizar' : 'Crear Cliente'}
          </Button>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title={selected?.name ?? ''} size="xl">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-600 font-medium">Saldo pendiente</p>
                <p className="text-2xl font-bold text-blue-700">${selected.current_balance.toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-medium">Límite crédito</p>
                <p className="text-2xl font-bold text-gray-700">${selected.credit_limit.toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-medium">Compras</p>
                <p className="text-2xl font-bold text-gray-700">{customerSales.length}</p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">Historial de compras</h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {customerSales.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                    <span className="text-gray-600">{format(new Date(s.created_at), 'dd/MM/yyyy HH:mm')}</span>
                    <Badge color={s.payment_status === 'pagado' ? 'green' : 'yellow'}>{s.payment_status}</Badge>
                    <span className="font-semibold">${s.total.toFixed(2)}</span>
                  </div>
                ))}
                {customerSales.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Sin compras</p>}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">Pagos realizados</h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-green-50 rounded-lg text-sm">
                    <span className="text-gray-600">{format(new Date(p.created_at), 'dd/MM/yyyy HH:mm')}</span>
                    <span className="text-gray-500">{p.payment_method}</span>
                    <span className="font-semibold text-green-700">+${p.amount.toFixed(2)}</span>
                  </div>
                ))}
                {payments.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Sin pagos</p>}
              </div>
            </div>
            {selected.current_balance > 0 && (
              <Button className="w-full" onClick={() => { setShowDetailModal(false); setShowPayModal(true) }}>
                <DollarSign size={16} /> Registrar Pago
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* Pay modal */}
      <Modal open={showPayModal} onClose={() => setShowPayModal(false)} title="Registrar Pago">
        <div className="space-y-4">
          {selected && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p className="text-gray-600">Saldo de <strong>{selected.name}</strong></p>
              <p className="text-2xl font-bold text-blue-700">${selected.current_balance.toFixed(2)}</p>
            </div>
          )}
          <Input label="Monto a pagar" type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Método de pago</label>
            <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              {['efectivo', 'tarjeta', 'transferencia'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowPayModal(false)}>Cancelar</Button>
            <Button className="flex-1" variant="success" loading={registerPayment.isPending} disabled={!payAmount || parseFloat(payAmount) <= 0} onClick={() => registerPayment.mutate()}>
              Confirmar Pago
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
