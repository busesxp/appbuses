'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ChoferRow, ChoferEstado } from '@/types/database'
import { cn } from '@/lib/utils/cn'

const ESTADO_COLOR: Record<ChoferEstado, string> = {
  activo: 'bg-green-100 text-green-800',
  inactivo: 'bg-slate-100 text-slate-600',
}

const EMPTY_FORM = {
  nombre: '',
  rut: '',
  telefono: '',
  fecha_ingreso: '',
  estado: 'activo' as ChoferEstado,
}

export default function ChoferesClient({ choferes: initial }: { choferes: ChoferRow[] }) {
  const router = useRouter()
  const [choferes, setChoferes] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openNew() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setError(null)
    setShowForm(true)
  }

  function openEdit(c: ChoferRow) {
    setForm({
      nombre: c.nombre,
      rut: c.rut ?? '',
      telefono: c.telefono ?? '',
      fecha_ingreso: c.fecha_ingreso ?? '',
      estado: c.estado,
    })
    setEditingId(c.id)
    setError(null)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    setError(null)

    const supabase = createClient()
    const payload = {
      nombre: form.nombre.trim(),
      rut: form.rut || null,
      telefono: form.telefono || null,
      fecha_ingreso: form.fecha_ingreso || null,
      estado: form.estado,
    }

    let err
    if (editingId) {
      const res = await supabase.from('choferes').update(payload).eq('id', editingId).select('id')
      err = res.error
      if (!res.error && (!res.data || res.data.length === 0)) {
        setError('Sin permisos para guardar — sesión expirada')
        setGuardando(false)
        return
      }
    } else {
      const res = await supabase.from('choferes').insert(payload)
      err = res.error
    }

    if (err) { setError(err.message); setGuardando(false); return }

    setShowForm(false)
    setGuardando(false)
    router.refresh()
    const { data } = await supabase.from('choferes').select('*').order('nombre')
    if (data) setChoferes(data as ChoferRow[])
  }

  const activos = choferes.filter(c => c.estado === 'activo').length

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Choferes</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">{choferes.length} registrados — {activos} activos</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar chofer
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">RUT</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Teléfono</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Ingreso</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {choferes.map(c => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{c.nombre}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{c.rut ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{c.telefono ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{c.fecha_ingreso ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ESTADO_COLOR[c.estado])}>
                    {c.estado === 'activo' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-blue-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {choferes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No hay choferes registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                {editingId ? 'Editar chofer' : 'Nuevo chofer'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <F label="Nombre *">
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="inp" placeholder="Juan Pérez" />
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="RUT">
                  <input value={form.rut} onChange={e => setForm(f => ({ ...f, rut: e.target.value }))} className="inp" placeholder="12.345.678-9" />
                </F>
                <F label="Teléfono">
                  <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} className="inp" placeholder="+56 9 1234 5678" />
                </F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Fecha ingreso">
                  <input type="date" value={form.fecha_ingreso} onChange={e => setForm(f => ({ ...f, fecha_ingreso: e.target.value }))} className="inp" />
                </F>
                <F label="Estado">
                  <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as ChoferEstado }))} className="inp">
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </F>
              </div>
            </div>

            {error && (
              <p className="mx-6 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
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
