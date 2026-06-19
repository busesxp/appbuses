'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { BusConModelo, ModeloBus, BusEstado } from '@/types/database'
import { cn } from '@/lib/utils/cn'

const ESTADO_LABEL: Record<BusEstado, string> = {
  activo: 'Activo',
  mantencion: 'En mantención',
  baja: 'Baja',
}

const ESTADO_COLOR: Record<BusEstado, string> = {
  activo: 'bg-green-100 text-green-800',
  mantencion: 'bg-yellow-100 text-yellow-800',
  baja: 'bg-red-100 text-red-800',
}

interface Props {
  buses: BusConModelo[]
  modelos: ModeloBus[]
}

export default function FlotaClient({ buses: initialBuses, modelos }: Props) {
  const router = useRouter()
  const [buses, setBuses] = useState(initialBuses)
  const [showForm, setShowForm] = useState(false)
  const [editingBus, setEditingBus] = useState<BusConModelo | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    patente: '',
    modelo_id: '',
    año: '',
    color: '',
    n_motor: '',
    n_chasis: '',
    combustible: 'Diésel',
    estado: 'activo' as BusEstado,
    notas: '',
  })

  function openNew() {
    setForm({ patente: '', modelo_id: '', año: '', color: '', n_motor: '', n_chasis: '', combustible: 'Diésel', estado: 'activo', notas: '' })
    setEditingBus(null)
    setError(null)
    setShowForm(true)
  }

  function openEdit(bus: BusConModelo) {
    setForm({
      patente: bus.patente,
      modelo_id: bus.modelo_id ?? '',
      año: bus.año?.toString() ?? '',
      color: bus.color ?? '',
      n_motor: bus.n_motor ?? '',
      n_chasis: bus.n_chasis ?? '',
      combustible: bus.combustible ?? 'Diésel',
      estado: bus.estado,
      notas: bus.notas ?? '',
    })
    setEditingBus(bus)
    setError(null)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.patente.trim()) { setError('La patente es obligatoria'); return }
    setGuardando(true)
    setError(null)

    const supabase = createClient()
    const payload = {
      patente: form.patente.trim().toUpperCase(),
      modelo_id: form.modelo_id || null,
      año: form.año ? parseInt(form.año) : null,
      color: form.color || null,
      n_motor: form.n_motor || null,
      n_chasis: form.n_chasis || null,
      combustible: form.combustible || null,
      estado: form.estado,
      notas: form.notas || null,
    }

    let err
    if (editingBus) {
      const res = await supabase.from('buses').update(payload).eq('id', editingBus.id).select('id')
      err = res.error
      if (!res.error && (!res.data || res.data.length === 0)) {
        setError('No se pudo guardar — sin permisos o sesión expirada')
        setGuardando(false)
        return
      }
    } else {
      const res = await supabase.from('buses').insert(payload)
      err = res.error
    }

    if (err) { setError(err.message); setGuardando(false); return }

    setShowForm(false)
    setGuardando(false)
    router.refresh()
    // Recarga optimista
    const { data } = await supabase.from('buses').select('*, modelos_bus(*)').order('patente')
    if (data) setBuses(data as BusConModelo[])
  }

  const activos = buses.filter(b => b.estado === 'activo').length
  const enMantencion = buses.filter(b => b.estado === 'mantencion').length

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Flota</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            {buses.length} vehículos &mdash; {activos} activos, {enMantencion} en mantención
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Agregar bus</span>
          <span className="sm:hidden">Agregar</span>
        </button>
      </div>

      {/* Tabla de flota */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Patente</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Marca / Modelo</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Año</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Color</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">N° Motor</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {buses.map(bus => (
              <tr key={bus.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-semibold text-slate-900">{bus.patente}</td>
                <td className="px-4 py-3 text-slate-700">
                  {bus.modelos_bus ? `${bus.modelos_bus.marca} ${bus.modelos_bus.modelo}` : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">{bus.año ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{bus.color ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{bus.n_motor ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ESTADO_COLOR[bus.estado])}>
                    {ESTADO_LABEL[bus.estado]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => openEdit(bus)}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {buses.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No hay vehículos registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                {editingBus ? `Editar ${editingBus.patente}` : 'Nuevo vehículo'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 grid grid-cols-2 gap-4">
              <Field label="Patente *">
                <input
                  value={form.patente}
                  onChange={e => setForm(f => ({ ...f, patente: e.target.value.toUpperCase() }))}
                  className="input"
                  placeholder="XXXX99"
                />
              </Field>
              <Field label="Modelo">
                <select
                  value={form.modelo_id}
                  onChange={e => setForm(f => ({ ...f, modelo_id: e.target.value }))}
                  className="input"
                >
                  <option value="">Sin especificar</option>
                  {modelos.map(m => (
                    <option key={m.id} value={m.id}>{m.marca} {m.modelo}</option>
                  ))}
                </select>
              </Field>
              <Field label="Año">
                <input
                  type="number"
                  value={form.año}
                  onChange={e => setForm(f => ({ ...f, año: e.target.value }))}
                  className="input"
                  placeholder="2012"
                />
              </Field>
              <Field label="Color">
                <input
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="input"
                  placeholder="Naranjo"
                />
              </Field>
              <Field label="N° Motor">
                <input
                  value={form.n_motor}
                  onChange={e => setForm(f => ({ ...f, n_motor: e.target.value }))}
                  className="input"
                  placeholder="D1A061501"
                />
              </Field>
              <Field label="N° Chasis">
                <input
                  value={form.n_chasis}
                  onChange={e => setForm(f => ({ ...f, n_chasis: e.target.value }))}
                  className="input"
                  placeholder="93PB..."
                />
              </Field>
              <Field label="Combustible">
                <select
                  value={form.combustible}
                  onChange={e => setForm(f => ({ ...f, combustible: e.target.value }))}
                  className="input"
                >
                  <option>Diésel</option>
                  <option>Bencina</option>
                  <option>GNC</option>
                </select>
              </Field>
              <Field label="Estado">
                <select
                  value={form.estado}
                  onChange={e => setForm(f => ({ ...f, estado: e.target.value as BusEstado }))}
                  className="input"
                >
                  <option value="activo">Activo</option>
                  <option value="mantencion">En mantención</option>
                  <option value="baja">Baja</option>
                </select>
              </Field>
              <div className="col-span-2">
                <Field label="Notas">
                  <textarea
                    value={form.notas}
                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                    className="input resize-none"
                    rows={2}
                  />
                </Field>
              </div>
            </div>

            {error && (
              <p className="mx-6 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={guardando}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
          transition: box-shadow 0.15s;
        }
        .input:focus {
          box-shadow: 0 0 0 2px #93c5fd;
          border-color: transparent;
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
