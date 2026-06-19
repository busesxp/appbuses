'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

// ── Tipos locales ──────────────────────────────────────────────────────────────

interface ItemCatalogo {
  id: string
  nombre: string
  marca: string | null
  codigo: string | null
  costo_referencia: number
  unidad: string | null
  stock_actual: number
}

interface LineaItem {
  tempId: string
  item_id: string
  cantidad: string
  costo_unitario: string
}

interface MantencionDetalle {
  id: string
  bus_id: string
  fecha: string
  tipo: string | null
  km_actual: number | null
  descripcion: string | null
  costo_mano_obra: number
  created_at: string
  buses: { patente: string } | null
  mantencion_items: {
    id: string
    cantidad: number
    costo_unitario: number
    items_catalogo: { nombre: string; unidad: string | null } | null
  }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function hoy() {
  return new Date().toISOString().split('T')[0]
}

function uid() {
  return Math.random().toString(36).slice(2)
}

const TIPOS = ['Preventiva', 'Correctiva', 'Otro']

const TIPO_COLOR: Record<string, string> = {
  Preventiva: 'bg-blue-100 text-blue-700',
  Correctiva: 'bg-red-100 text-red-700',
  Otro: 'bg-slate-100 text-slate-600',
}

const EMPTY_FORM = {
  bus_id: '',
  fecha: hoy(),
  tipo: 'Preventiva',
  km_actual: '',
  descripcion: '',
  costo_mano_obra: '',
}

// ── Componente principal ───────────────────────────────────────────────────────

interface Props {
  mantenciones: MantencionDetalle[]
  buses: { id: string; patente: string }[]
  items: ItemCatalogo[]
}

export default function MantencionesClient({ mantenciones: initial, buses, items }: Props) {
  const router = useRouter()
  const [mantenciones, setMantenciones] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [lineas, setLineas] = useState<LineaItem[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function openNew() {
    setForm({ ...EMPTY_FORM, fecha: hoy() })
    setLineas([])
    setEditingId(null)
    setError(null)
    setShowForm(true)
  }

  function openEdit(m: MantencionDetalle) {
    setForm({
      bus_id: m.bus_id,
      fecha: m.fecha,
      tipo: m.tipo ?? 'Preventiva',
      km_actual: m.km_actual?.toString() ?? '',
      descripcion: m.descripcion ?? '',
      costo_mano_obra: m.costo_mano_obra?.toString() ?? '',
    })
    setLineas(
      m.mantencion_items.map(it => ({
        tempId: uid(),
        item_id: it.items_catalogo ? items.find(i => i.nombre === it.items_catalogo!.nombre)?.id ?? '' : '',
        cantidad: it.cantidad.toString(),
        costo_unitario: it.costo_unitario.toString(),
      }))
    )
    setEditingId(m.id)
    setError(null)
    setShowForm(true)
  }

  function agregarLinea() {
    setLineas(l => [...l, { tempId: uid(), item_id: '', cantidad: '1', costo_unitario: '' }])
  }

  function quitarLinea(tempId: string) {
    setLineas(l => l.filter(x => x.tempId !== tempId))
  }

  function onSelectItem(tempId: string, item_id: string) {
    const item = items.find(i => i.id === item_id)
    setLineas(l => l.map(x => x.tempId === tempId
      ? { ...x, item_id, costo_unitario: item ? item.costo_referencia.toString() : x.costo_unitario }
      : x
    ))
  }

  const n = (v: string) => v ? parseFloat(v) : 0
  const totalItems = lineas.reduce((s, l) => s + n(l.cantidad) * n(l.costo_unitario), 0)
  const totalMant = n(form.costo_mano_obra) + totalItems

  async function handleSave() {
    if (!form.bus_id) { setError('Selecciona un bus'); return }
    if (!form.fecha) { setError('La fecha es obligatoria'); return }
    setGuardando(true)
    setError(null)

    const supabase = createClient()
    const payload = {
      bus_id: form.bus_id,
      fecha: form.fecha,
      tipo: form.tipo || null,
      km_actual: form.km_actual ? parseFloat(form.km_actual) : null,
      descripcion: form.descripcion || null,
      costo_mano_obra: n(form.costo_mano_obra),
    }

    let mantencionId = editingId

    if (editingId) {
      const res = await supabase.from('mantenciones').update(payload).eq('id', editingId).select('id')
      if (res.error) { setError(res.error.message); setGuardando(false); return }
      if (!res.data?.length) { setError('Sin permisos — sesión expirada'); setGuardando(false); return }
      // Borrar items existentes para re-insertar
      await supabase.from('mantencion_items').delete().eq('mantencion_id', editingId)
    } else {
      const res = await supabase.from('mantenciones').insert(payload).select('id')
      if (res.error) { setError(res.error.message); setGuardando(false); return }
      mantencionId = res.data![0].id
    }

    // Insertar items
    const itemsValidos = lineas.filter(l => l.item_id && n(l.cantidad) > 0)
    if (itemsValidos.length > 0) {
      const itemsPayload = itemsValidos.map(l => ({
        mantencion_id: mantencionId!,
        item_id: l.item_id,
        cantidad: n(l.cantidad),
        costo_unitario: n(l.costo_unitario),
      }))
      const { error: itemErr } = await supabase.from('mantencion_items').insert(itemsPayload)
      if (itemErr) { setError(itemErr.message); setGuardando(false); return }
    }

    setShowForm(false)
    setGuardando(false)
    router.refresh()
    const { data } = await supabase
      .from('mantenciones')
      .select('*, buses(patente), mantencion_items(id, cantidad, costo_unitario, items_catalogo(nombre, unidad))')
      .order('fecha', { ascending: false })
    if (data) setMantenciones(data as any)
  }

  const costoTotal = mantenciones.reduce((s, m) => {
    const itCost = m.mantencion_items.reduce((si, i) => si + i.cantidad * i.costo_unitario, 0)
    return s + m.costo_mano_obra + itCost
  }, 0)

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mantenciones</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {mantenciones.length} registros — costo total {fmt(costoTotal)}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva mantención
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {mantenciones.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
            No hay mantenciones registradas
          </div>
        )}
        {mantenciones.map(m => {
          const itCost = m.mantencion_items.reduce((s, i) => s + i.cantidad * i.costo_unitario, 0)
          const total = m.costo_mano_obra + itCost
          const expanded = expandedId === m.id
          const tipoLabel = m.tipo ?? 'Otro'
          return (
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Fila principal */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3 items-center min-w-0">
                  <div>
                    <p className="font-mono font-bold text-slate-900 text-lg">{m.buses?.patente ?? '—'}</p>
                    <p className="text-xs text-slate-400">{m.fecha}</p>
                  </div>
                  <div>
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', TIPO_COLOR[tipoLabel] ?? TIPO_COLOR['Otro'])}>
                      {tipoLabel}
                    </span>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-xs text-slate-500">Km actual</p>
                    <p className="font-medium text-slate-700">{m.km_actual != null ? m.km_actual.toLocaleString('es-CL') : '—'}</p>
                  </div>
                  <div className="hidden md:block truncate">
                    <p className="text-xs text-slate-500 truncate">{m.descripcion || '—'}</p>
                    <p className="text-xs text-slate-400">{m.mantencion_items.length} repuesto{m.mantencion_items.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{fmt(total)}</p>
                    <p className="text-xs text-slate-400">MO: {fmt(m.costo_mano_obra)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.mantencion_items.length > 0 && (
                    <button
                      onClick={() => setExpandedId(expanded ? null : m.id)}
                      className="text-slate-400 hover:text-slate-700 p-1"
                      title="Ver repuestos"
                    >
                      <svg className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                  <button onClick={() => openEdit(m)} className="text-slate-400 hover:text-blue-600 p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Repuestos expandidos */}
              {expanded && m.mantencion_items.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400">
                        <th className="text-left py-1 font-medium">Repuesto</th>
                        <th className="text-right py-1 font-medium">Cantidad</th>
                        <th className="text-right py-1 font-medium">Precio unit.</th>
                        <th className="text-right py-1 font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.mantencion_items.map(it => (
                        <tr key={it.id} className="border-t border-slate-100">
                          <td className="py-1.5 text-slate-700">{it.items_catalogo?.nombre ?? '—'}</td>
                          <td className="py-1.5 text-right text-slate-600">{it.cantidad} {it.items_catalogo?.unidad ?? ''}</td>
                          <td className="py-1.5 text-right text-slate-600">{fmt(it.costo_unitario)}</td>
                          <td className="py-1.5 text-right font-medium text-slate-900">{fmt(it.cantidad * it.costo_unitario)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-slate-200">
                        <td colSpan={3} className="py-1.5 text-right text-xs text-slate-500 font-medium">Total repuestos</td>
                        <td className="py-1.5 text-right font-bold text-slate-900">{fmt(itCost)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto">

            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-slate-900">
                {editingId ? 'Editar mantención' : 'Nueva mantención'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Datos básicos */}
              <div className="grid grid-cols-2 gap-4">
                <F label="Bus *">
                  <select value={form.bus_id} onChange={e => setForm(f => ({ ...f, bus_id: e.target.value }))} className="inp">
                    <option value="">Seleccionar...</option>
                    {buses.map(b => <option key={b.id} value={b.id}>{b.patente}</option>)}
                  </select>
                </F>
                <F label="Fecha *">
                  <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className="inp" />
                </F>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <F label="Tipo">
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className="inp">
                    {TIPOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </F>
                <F label="Km actual odómetro">
                  <input type="number" value={form.km_actual} onChange={e => setForm(f => ({ ...f, km_actual: e.target.value }))} className="inp" placeholder="125000" />
                </F>
                <F label="Mano de obra $">
                  <input type="number" value={form.costo_mano_obra} onChange={e => setForm(f => ({ ...f, costo_mano_obra: e.target.value }))} className="inp" placeholder="0" />
                </F>
              </div>

              <F label="Descripción / trabajo realizado">
                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className="inp resize-none" rows={2} placeholder="Cambio de aceite, filtros, revisión de frenos..." />
              </F>

              {/* Repuestos */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Repuestos utilizados</p>
                  <button
                    type="button"
                    onClick={agregarLinea}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar repuesto
                  </button>
                </div>

                {lineas.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-lg">
                    Sin repuestos — haz clic en Agregar repuesto
                  </p>
                )}

                <div className="space-y-2">
                  {lineas.map(l => {
                    const item = items.find(i => i.id === l.item_id)
                    const linTotal = n(l.cantidad) * n(l.costo_unitario)
                    return (
                      <div key={l.tempId} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          <select
                            value={l.item_id}
                            onChange={e => onSelectItem(l.tempId, e.target.value)}
                            className="inp text-xs"
                          >
                            <option value="">Seleccionar...</option>
                            {items.map(i => (
                              <option key={i.id} value={i.id}>
                                {i.nombre}{i.marca ? ` (${i.marca})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={l.cantidad}
                            onChange={e => setLineas(ls => ls.map(x => x.tempId === l.tempId ? { ...x, cantidad: e.target.value } : x))}
                            className="inp text-xs"
                            placeholder="Cant."
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            value={l.costo_unitario}
                            onChange={e => setLineas(ls => ls.map(x => x.tempId === l.tempId ? { ...x, costo_unitario: e.target.value } : x))}
                            className="inp text-xs"
                            placeholder="$ unit."
                          />
                        </div>
                        <div className="col-span-1 text-right text-xs font-medium text-slate-600 pb-1">
                          {linTotal > 0 ? fmt(linTotal) : ''}
                        </div>
                        <div className="col-span-1 flex justify-end pb-0.5">
                          <button type="button" onClick={() => quitarLinea(l.tempId)} className="text-slate-300 hover:text-red-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Resumen total */}
              {(n(form.costo_mano_obra) > 0 || totalItems > 0) && (
                <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm flex items-center justify-between">
                  <div className="text-slate-500 space-y-0.5">
                    <p>Mano de obra: <span className="font-medium text-slate-700">{fmt(n(form.costo_mano_obra))}</span></p>
                    <p>Repuestos: <span className="font-medium text-slate-700">{fmt(totalItems)}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Total mantención</p>
                    <p className="text-xl font-black text-slate-900">{fmt(totalMant)}</p>
                  </div>
                </div>
              )}

            </div>

            {error && (
              <p className="mx-6 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={guardando}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {guardando ? 'Guardando...' : 'Guardar mantención'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .inp { width: 100%; padding: 0.45rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.875rem; outline: none; background: white; }
        .inp:focus { box-shadow: 0 0 0 2px #93c5fd; border-color: transparent; }
      `}</style>
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
