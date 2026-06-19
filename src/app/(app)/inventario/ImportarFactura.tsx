'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

interface ItemExtraido {
  nombre: string
  cantidad: number
  precio_unitario: number
  item_id: string | null   // null = nuevo item a crear
  _match: string           // texto de ayuda del match
}

interface ItemCatalogo {
  id: string
  nombre: string
  costo_referencia: number
  unidad: string | null
}

interface Props {
  itemsCatalogo: ItemCatalogo[]
  onImportado: () => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

export default function ImportarFactura({ itemsCatalogo, onImportado }: Props) {
  const [show, setShow] = useState(false)
  const [paso, setPaso] = useState<'captura' | 'revision' | 'guardando' | 'listo'>('captura')
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proveedor, setProveedor] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [items, setItems] = useState<ItemExtraido[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function hoy() { return new Date().toISOString().split('T')[0] }

  function encontrarMatch(nombre: string): { item_id: string | null; _match: string } {
    const nl = nombre.toLowerCase()
    const match = itemsCatalogo.find(i =>
      i.nombre.toLowerCase().includes(nl) || nl.includes(i.nombre.toLowerCase())
    )
    return match
      ? { item_id: match.id, _match: `→ ${match.nombre}` }
      : { item_id: null, _match: 'Nuevo ítem' }
  }

  async function handleImagen(file: File) {
    setError(null)
    setProcesando(true)
    setPreview(URL.createObjectURL(file))

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1]
      const mimeType = file.type

      try {
        const res = await fetch('/api/ocr-factura', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        })
        const data = await res.json()
        if (!res.ok || data.error) {
          setError(data.error ?? 'Error al procesar la imagen')
          setProcesando(false)
          return
        }

        setProveedor(data.proveedor ?? '')
        setFecha(data.fecha ?? hoy())
        setItems(
          (data.items ?? []).map((it: any) => ({
            nombre: it.nombre ?? '',
            cantidad: it.cantidad ?? 1,
            precio_unitario: it.precio_unitario ?? 0,
            ...encontrarMatch(it.nombre ?? ''),
          }))
        )
        setProcesando(false)
        setPaso('revision')
      } catch {
        setError('Error de conexión')
        setProcesando(false)
      }
    }
    reader.readAsDataURL(file)
  }

  function actualizarItem(idx: number, campo: keyof ItemExtraido, valor: any) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }

  function quitarItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function agregarFila() {
    setItems(prev => [...prev, { nombre: '', cantidad: 1, precio_unitario: 0, item_id: null, _match: 'Nuevo ítem' }])
  }

  async function handleGuardar() {
    if (items.length === 0) return
    setPaso('guardando')
    const supabase = createClient()

    for (const it of items) {
      if (!it.nombre.trim()) continue

      let itemId = it.item_id

      // Si no hay match, crear nuevo ítem en catálogo
      if (!itemId) {
        const { data: nuevo } = await supabase
          .from('items_catalogo')
          .insert({ nombre: it.nombre.trim(), costo_referencia: it.precio_unitario })
          .select('id')
        itemId = nuevo?.[0]?.id ?? null
      }

      if (!itemId) continue

      // Registrar movimiento de entrada
      await supabase.from('movimientos_inventario').insert({
        item_id: itemId,
        tipo: 'entrada',
        cantidad: it.cantidad,
        costo_unitario: it.precio_unitario,
        fecha: fecha || hoy(),
        referencia: proveedor || 'Factura importada',
      })
    }

    setPaso('listo')
    onImportado()
  }

  function cerrar() {
    setShow(false)
    setPaso('captura')
    setPreview(null)
    setItems([])
    setProveedor('')
    setFecha(hoy())
    setError(null)
  }

  const totalFactura = items.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0)

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="flex items-center gap-2 px-3 py-2 border border-slate-300 hover:border-blue-400 hover:text-blue-600 text-slate-600 text-sm font-medium rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Importar factura
      </button>

      {show && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto">

            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-semibold text-slate-900">Importar factura</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {paso === 'captura' && 'Sube o toma foto de la factura'}
                  {paso === 'revision' && 'Revisa y corrige los productos detectados'}
                  {paso === 'guardando' && 'Guardando en inventario...'}
                  {paso === 'listo' && '¡Importación completada!'}
                </p>
              </div>
              <button onClick={cerrar} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Paso 1: Captura ── */}
            {paso === 'captura' && (
              <div className="px-6 py-8">
                {!procesando ? (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleImagen(e.target.files[0]) }}
                    />
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-2xl p-10 text-center cursor-pointer transition-colors group"
                    >
                      <div className="w-16 h-16 bg-slate-100 group-hover:bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors">
                        <svg className="w-8 h-8 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <p className="font-semibold text-slate-700 mb-1">Tomar foto o subir imagen</p>
                      <p className="text-sm text-slate-400">Desde el celular abre la cámara directamente</p>
                    </div>
                    {error && (
                      <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">{error}</p>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    {preview && (
                      <img src={preview} alt="Factura" className="max-h-48 mx-auto rounded-xl object-contain mb-6 shadow" />
                    )}
                    <div className="flex items-center justify-center gap-3 text-slate-500">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <span className="text-sm">Leyendo factura con IA...</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Paso 2: Revisión ── */}
            {paso === 'revision' && (
              <div className="px-6 py-5 space-y-5">
                {/* Datos de la factura */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Proveedor</label>
                    <input
                      value={proveedor}
                      onChange={e => setProveedor(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Nombre del proveedor"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={e => setFecha(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                </div>

                {/* Tabla de items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Productos detectados</p>
                    <button onClick={agregarFila} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Agregar fila</button>
                  </div>

                  <div className="space-y-2">
                    {items.map((it, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <input
                              value={it.nombre}
                              onChange={e => actualizarItem(idx, 'nombre', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                              placeholder="Nombre del producto"
                            />
                            <p className={cn('text-xs mt-0.5', it.item_id ? 'text-green-600' : 'text-slate-400')}>{it._match}</p>
                          </div>
                          <button onClick={() => quitarItem(idx)} className="text-slate-300 hover:text-red-400 mt-1 flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-slate-400 mb-0.5">Cantidad</label>
                            <input
                              type="number"
                              value={it.cantidad}
                              onChange={e => actualizarItem(idx, 'cantidad', parseFloat(e.target.value) || 1)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-0.5">Precio unit. $</label>
                            <input
                              type="number"
                              value={it.precio_unitario}
                              onChange={e => actualizarItem(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                          </div>
                          <div className="flex flex-col justify-end">
                            <label className="block text-xs text-slate-400 mb-0.5">Subtotal</label>
                            <p className="px-2 py-1.5 text-sm font-semibold text-slate-700">{fmt(it.cantidad * it.precio_unitario)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <p className="text-sm text-slate-500">{items.length} producto{items.length !== 1 ? 's' : ''}</p>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Total factura</p>
                    <p className="text-xl font-black text-slate-900">{fmt(totalFactura)}</p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    onClick={() => { setPaso('captura'); setPreview(null); setError(null) }}
                    className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800"
                  >
                    Volver
                  </button>
                  <button
                    onClick={handleGuardar}
                    disabled={items.length === 0}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Confirmar e ingresar a inventario
                  </button>
                </div>
              </div>
            )}

            {/* ── Paso 3: Guardando ── */}
            {paso === 'guardando' && (
              <div className="px-6 py-12 text-center">
                <svg className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <p className="text-slate-600">Ingresando productos al inventario...</p>
              </div>
            )}

            {/* ── Paso 4: Listo ── */}
            {paso === 'listo' && (
              <div className="px-6 py-12 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-semibold text-slate-900 mb-1">¡Importación completada!</p>
                <p className="text-sm text-slate-500 mb-6">{items.length} producto{items.length !== 1 ? 's' : ''} ingresados al inventario</p>
                <button onClick={cerrar} className="px-6 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg">
                  Cerrar
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}
