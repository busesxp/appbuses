'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import ImportarFactura from './ImportarFactura'

interface Categoria { id: string; nombre: string }
interface Item {
  id: string
  nombre: string
  codigo: string | null
  marca: string | null
  especificacion: string | null
  costo_referencia: number
  stock_actual: number
  stock_minimo: number
  unidad: string | null
  categoria_id: string | null
  categorias_item: { nombre: string } | null
}

const EMPTY_ITEM = {
  nombre: '', codigo: '', marca: '', especificacion: '',
  costo_referencia: '', stock_minimo: '', unidad: 'unidad', categoria_id: '',
}

const EMPTY_MOV = {
  item_id: '', tipo: 'entrada' as 'entrada' | 'salida',
  cantidad: '', costo_unitario: '', referencia: '', notas: '',
}

export default function InventarioClient({ items: initial, categorias }: { items: Item[]; categorias: Categoria[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [tab, setTab] = useState<'catalogo' | 'movimiento'>('catalogo')
  const [showItemForm, setShowItemForm] = useState(false)
  const [showMovForm, setShowMovForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM)
  const [movForm, setMovForm] = useState(EMPTY_MOV)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const itemsFiltrados = items.filter(i =>
    i.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (i.codigo ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (i.categorias_item?.nombre ?? '').toLowerCase().includes(busqueda.toLowerCase())
  )

  const stockBajo = items.filter(i => i.stock_actual <= i.stock_minimo && i.stock_minimo > 0)

  function openNewItem() {
    setItemForm(EMPTY_ITEM)
    setEditingId(null)
    setError(null)
    setShowItemForm(true)
  }

  function openEditItem(item: Item) {
    setItemForm({
      nombre: item.nombre,
      codigo: item.codigo ?? '',
      marca: item.marca ?? '',
      especificacion: item.especificacion ?? '',
      costo_referencia: item.costo_referencia?.toString() ?? '',
      stock_minimo: item.stock_minimo?.toString() ?? '',
      unidad: item.unidad ?? 'unidad',
      categoria_id: item.categoria_id ?? '',
    })
    setEditingId(item.id)
    setError(null)
    setShowItemForm(true)
  }

  async function handleSaveItem() {
    if (!itemForm.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    setError(null)

    const supabase = createClient()
    const payload = {
      nombre: itemForm.nombre.trim(),
      codigo: itemForm.codigo || null,
      marca: itemForm.marca || null,
      especificacion: itemForm.especificacion || null,
      costo_referencia: itemForm.costo_referencia ? parseFloat(itemForm.costo_referencia) : 0,
      stock_minimo: itemForm.stock_minimo ? parseFloat(itemForm.stock_minimo) : 0,
      unidad: itemForm.unidad || 'unidad',
      categoria_id: itemForm.categoria_id || null,
    }

    let err
    if (editingId) {
      const res = await supabase.from('items_catalogo').update(payload).eq('id', editingId).select('id')
      err = res.error
    } else {
      const res = await supabase.from('items_catalogo').insert(payload)
      err = res.error
    }

    if (err) { setError(err.message); setGuardando(false); return }
    setShowItemForm(false)
    setGuardando(false)
    router.refresh()
    const { data } = await supabase.from('items_catalogo').select('*, categorias_item(nombre)').order('nombre')
    if (data) setItems(data as Item[])
  }

  async function handleSaveMov() {
    if (!movForm.item_id) { setError('Selecciona un ítem'); return }
    if (!movForm.cantidad || parseFloat(movForm.cantidad) <= 0) { setError('Cantidad debe ser mayor a 0'); return }
    setGuardando(true)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase.from('movimientos_inventario').insert({
      item_id: movForm.item_id,
      tipo: movForm.tipo,
      cantidad: parseFloat(movForm.cantidad),
      costo_unitario: movForm.costo_unitario ? parseFloat(movForm.costo_unitario) : 0,
      referencia: movForm.referencia || null,
      notas: movForm.notas || null,
      fecha: new Date().toISOString().split('T')[0],
    })

    if (err) { setError(err.message); setGuardando(false); return }
    setShowMovForm(false)
    setMovForm(EMPTY_MOV)
    setGuardando(false)
    router.refresh()
    const { data } = await supabase.from('items_catalogo').select('*, categorias_item(nombre)').order('nombre')
    if (data) setItems(data as Item[])
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventario</h1>
          <p className="text-sm text-slate-500 mt-0.5">{items.length} ítems en catálogo</p>
        </div>
        <div className="flex gap-2">
          <ImportarFactura
            itemsCatalogo={items.map(i => ({ id: i.id, nombre: i.nombre, costo_referencia: i.costo_referencia, unidad: i.unidad }))}
            onImportado={() => router.refresh()}
          />
          <button
            onClick={() => { setMovForm(EMPTY_MOV); setError(null); setShowMovForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Registrar movimiento
          </button>
          <button
            onClick={openNewItem}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo ítem
          </button>
        </div>
      </div>

      {/* Alerta stock bajo */}
      {stockBajo.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Stock bajo en {stockBajo.length} ítem{stockBajo.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-amber-600 mt-0.5">{stockBajo.map(i => i.nombre).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div className="mb-4">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, código o categoría..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tabla catálogo */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Ítem</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Categoría</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Marca</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Especificación</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Stock actual</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Stock mín.</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Costo ref.</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {itemsFiltrados.map(item => {
              const bajo = item.stock_minimo > 0 && item.stock_actual <= item.stock_minimo
              return (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{item.nombre}</p>
                    {item.codigo && <p className="text-xs text-slate-400 font-mono">{item.codigo}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.categorias_item?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.marca ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{item.especificacion ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn('font-semibold', bajo ? 'text-red-600' : 'text-slate-900')}>
                      {item.stock_actual} {item.unidad}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{item.stock_minimo} {item.unidad}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {item.costo_referencia > 0
                      ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(item.costo_referencia)
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEditItem(item)} className="text-slate-400 hover:text-blue-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
            {itemsFiltrados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  {busqueda ? 'Sin resultados para esa búsqueda' : 'No hay ítems en el catálogo'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo/editar ítem */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">{editingId ? 'Editar ítem' : 'Nuevo ítem'}</h2>
              <button onClick={() => setShowItemForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <F label="Nombre *">
                  <input value={itemForm.nombre} onChange={e => setItemForm(f => ({ ...f, nombre: e.target.value }))} className="inp" placeholder="Filtro de aceite" />
                </F>
              </div>
              <F label="Categoría">
                <select value={itemForm.categoria_id} onChange={e => setItemForm(f => ({ ...f, categoria_id: e.target.value }))} className="inp">
                  <option value="">Sin categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </F>
              <F label="Código">
                <input value={itemForm.codigo} onChange={e => setItemForm(f => ({ ...f, codigo: e.target.value }))} className="inp" placeholder="FIL-001" />
              </F>
              <F label="Marca">
                <input value={itemForm.marca} onChange={e => setItemForm(f => ({ ...f, marca: e.target.value }))} className="inp" placeholder="Mann" />
              </F>
              <F label="Especificación">
                <input value={itemForm.especificacion} onChange={e => setItemForm(f => ({ ...f, especificacion: e.target.value }))} className="inp" placeholder="W15/40, 5L" />
              </F>
              <F label="Costo referencia $">
                <input type="number" value={itemForm.costo_referencia} onChange={e => setItemForm(f => ({ ...f, costo_referencia: e.target.value }))} className="inp" />
              </F>
              <F label="Stock mínimo">
                <input type="number" value={itemForm.stock_minimo} onChange={e => setItemForm(f => ({ ...f, stock_minimo: e.target.value }))} className="inp" />
              </F>
              <div className="col-span-2">
                <F label="Unidad">
                  <select value={itemForm.unidad} onChange={e => setItemForm(f => ({ ...f, unidad: e.target.value }))} className="inp">
                    <option value="unidad">unidad</option>
                    <option value="litros">litros</option>
                    <option value="kg">kg</option>
                    <option value="metros">metros</option>
                    <option value="juego">juego</option>
                  </select>
                </F>
              </div>
            </div>
            {error && <p className="mx-6 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowItemForm(false)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={handleSaveItem} disabled={guardando} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal movimiento */}
      {showMovForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Registrar movimiento</h2>
              <button onClick={() => setShowMovForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <F label="Ítem *">
                <select value={movForm.item_id} onChange={e => setMovForm(f => ({ ...f, item_id: e.target.value }))} className="inp">
                  <option value="">Seleccionar...</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.nombre} (stock: {i.stock_actual} {i.unidad})</option>)}
                </select>
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Tipo">
                  <select value={movForm.tipo} onChange={e => setMovForm(f => ({ ...f, tipo: e.target.value as 'entrada' | 'salida' }))} className="inp">
                    <option value="entrada">Entrada (compra)</option>
                    <option value="salida">Salida (uso)</option>
                  </select>
                </F>
                <F label="Cantidad *">
                  <input type="number" value={movForm.cantidad} onChange={e => setMovForm(f => ({ ...f, cantidad: e.target.value }))} className="inp" min="0" step="0.01" />
                </F>
              </div>
              <F label="Costo unitario $">
                <input type="number" value={movForm.costo_unitario} onChange={e => setMovForm(f => ({ ...f, costo_unitario: e.target.value }))} className="inp" />
              </F>
              <F label="Referencia">
                <input value={movForm.referencia} onChange={e => setMovForm(f => ({ ...f, referencia: e.target.value }))} className="inp" placeholder="Ej: Factura 1234, Mantención bus DWSF95" />
              </F>
              <F label="Notas">
                <textarea value={movForm.notas} onChange={e => setMovForm(f => ({ ...f, notas: e.target.value }))} className="inp resize-none" rows={2} />
              </F>
            </div>
            {error && <p className="mx-6 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowMovForm(false)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={handleSaveMov} disabled={guardando} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
                {guardando ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .inp { width: 100%; padding: 0.4rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.875rem; outline: none; }
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
