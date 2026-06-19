'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { InformeDiarioVista, CierreDia } from '@/types/database'
import { cn } from '@/lib/utils/cn'

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function fmtNum(n: number | null | undefined, decimals = 0) {
  if (n == null) return '—'
  return n.toFixed(decimals)
}

interface Props {
  fecha: string
  informes: InformeDiarioVista[]
  buses: { id: string; patente: string; estado: string }[]
  choferes: { id: string; nombre: string }[]
  cierreDia: CierreDia | null
}

const EMPTY_FORM = {
  bus_id: '',
  fecha: '',
  conductor_id: '',
  relevo_id: '',
  cta_cond: '',
  cta_rel: '',
  vueltas_cond: '',
  vueltas_rel: '',
  ant_cond: '',
  ant_rel: '',
  vuel_cond: '',
  vuel_rel: '',
  petrol_monto: '',
  petrol_litros: '',
  km_recorridos: '',
  gastos_caja: '',
  bonos: '',
  check_list: false as boolean,
  notas: '',
}

export default function InformesClient({ fecha, informes: initialInformes, buses, choferes, cierreDia: initialCierre }: Props) {
  const router = useRouter()
  const [informes, setInformes] = useState(initialInformes)
  const [cierreDia, setCierreDia] = useState(initialCierre)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fechaVer, setFechaVer] = useState(fecha)
  const [showCierreForm, setShowCierreForm] = useState(false)
  const [cierreForm, setCierreForm] = useState({ gastos_oficina: '', deposito: '', notas: '' })

  function num(v: string) { return v ? parseFloat(v) : 0 }

  const subtotal = num(form.cta_cond) + num(form.cta_rel)
  const totalNeto = subtotal - num(form.ant_cond) - num(form.ant_rel) - num(form.petrol_monto) - num(form.gastos_caja) - num(form.bonos)
  const proCond = num(form.vueltas_cond) > 0 ? num(form.cta_cond) / num(form.vueltas_cond) : null
  const proRel = num(form.vueltas_rel) > 0 ? num(form.cta_rel) / num(form.vueltas_rel) : null

  function ayer() {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }

  function openNew() {
    setForm({ ...EMPTY_FORM, fecha: ayer() })
    setEditingId(null)
    setError(null)
    setShowForm(true)
  }

  function openEdit(inf: InformeDiarioVista) {
    setForm({
      bus_id: inf.bus_id,
      fecha: inf.fecha ?? fechaVer,
      conductor_id: inf.conductor_id ?? '',
      relevo_id: inf.relevo_id ?? '',
      cta_cond: inf.cta_cond?.toString() ?? '',
      cta_rel: inf.cta_rel?.toString() ?? '',
      vueltas_cond: inf.vueltas_cond?.toString() ?? '',
      vueltas_rel: inf.vueltas_rel?.toString() ?? '',
      ant_cond: inf.ant_cond?.toString() ?? '',
      ant_rel: inf.ant_rel?.toString() ?? '',
      vuel_cond: inf.vuel_cond?.toString() ?? '',
      vuel_rel: inf.vuel_rel?.toString() ?? '',
      petrol_monto: inf.petrol_monto?.toString() ?? '',
      petrol_litros: inf.petrol_litros?.toString() ?? '',
      km_recorridos: inf.km_recorridos?.toString() ?? '',
      gastos_caja: inf.gastos_caja?.toString() ?? '',
      bonos: inf.bonos?.toString() ?? '',
      check_list: inf.check_list ?? false,
      notas: inf.notas ?? '',
    })
    setEditingId(inf.id)
    setError(null)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.bus_id) { setError('Selecciona un bus'); return }
    setGuardando(true)
    setError(null)

    const supabase = createClient()
    const payload = {
      bus_id: form.bus_id,
      fecha: form.fecha || fechaVer,
      conductor_id: form.conductor_id || null,
      relevo_id: form.relevo_id || null,
      cta_cond: num(form.cta_cond),
      cta_rel: num(form.cta_rel),
      vueltas_cond: num(form.vueltas_cond),
      vueltas_rel: num(form.vueltas_rel),
      ant_cond: num(form.ant_cond),
      ant_rel: num(form.ant_rel),
      vuel_cond: num(form.vuel_cond),
      vuel_rel: num(form.vuel_rel),
      petrol_monto: num(form.petrol_monto),
      petrol_litros: num(form.petrol_litros),
      km_recorridos: num(form.km_recorridos),
      gastos_caja: num(form.gastos_caja),
      bonos: num(form.bonos),
      check_list: form.check_list,
      notas: form.notas || null,
    }

    let err
    if (editingId) {
      const res = await supabase.from('informes_diarios').update(payload).eq('id', editingId).select('id')
      err = res.error
      if (!res.error && (!res.data || res.data.length === 0)) {
        setError('Sin permisos para guardar — sesión expirada')
        setGuardando(false)
        return
      }
    } else {
      const res = await supabase.from('informes_diarios').insert(payload)
      err = res.error
    }

    if (err) { setError(err.message); setGuardando(false); return }

    setShowForm(false)
    setGuardando(false)
    router.refresh()
    const { data } = await supabase.from('v_informes_diarios').select('*').eq('fecha', fechaVer).order('patente')
    if (data) setInformes(data as InformeDiarioVista[])
  }

  async function handleGuardarCierre() {
    const supabase = createClient()
    const payload = {
      fecha: fechaVer,
      gastos_oficina: num(cierreForm.gastos_oficina),
      deposito: num(cierreForm.deposito),
      notas: cierreForm.notas || null,
    }
    if (cierreDia) {
      await supabase.from('cierres_dia').update(payload).eq('id', cierreDia.id)
    } else {
      await supabase.from('cierres_dia').insert(payload)
    }
    const { data } = await supabase.from('cierres_dia').select('*').eq('fecha', fechaVer).maybeSingle()
    setCierreDia(data)
    setShowCierreForm(false)
  }

  const totalBoletaje = informes.reduce((s, i) => s + (i.subtotal ?? 0), 0)
  const totalNeto2 = informes.reduce((s, i) => s + (i.total_neto ?? 0), 0)
  const totalComb = informes.reduce((s, i) => s + (i.petrol_monto ?? 0), 0)
  const totalAnts = informes.reduce((s, i) => s + (i.ant_cond ?? 0) + (i.ant_rel ?? 0), 0)

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Informe Diario</h1>
          <div className="flex items-center gap-3 mt-1">
            <input
              type="date"
              value={fechaVer}
              onChange={async e => {
                const f = e.target.value
                setFechaVer(f)
                const supabase = createClient()
                const { data } = await supabase.from('v_informes_diarios').select('*').eq('fecha', f).order('patente')
                setInformes((data as InformeDiarioVista[]) ?? [])
                const { data: c } = await supabase.from('cierres_dia').select('*').eq('fecha', f).maybeSingle()
                setCierreDia(c)
              }}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-500">{informes.length} buses registrados</span>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar registro
        </button>
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 md:mb-6">
        {[
          { label: 'Boletaje total', value: fmt(totalBoletaje), color: 'text-blue-600' },
          { label: 'Combustible', value: fmt(totalComb), color: 'text-amber-600' },
          { label: 'Anticipos', value: fmt(totalAnts), color: 'text-purple-600' },
          { label: 'Total neto', value: fmt(totalNeto2), color: totalNeto2 >= 0 ? 'text-green-600' : 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla informe */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto mb-4 -mx-4 md:mx-0 rounded-none md:rounded-xl border-x-0 md:border-x">
        <table className="w-full text-sm min-w-max">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-3 py-2.5 font-medium text-slate-600">Bus</th>
              <th className="text-left px-3 py-2.5 font-medium text-slate-600">Conductor</th>
              <th className="text-left px-3 py-2.5 font-medium text-slate-600">Relevo</th>
              <th className="text-right px-3 py-2.5 font-medium text-slate-600">Cta.Cond</th>
              <th className="text-right px-3 py-2.5 font-medium text-slate-600">Cta.Rel</th>
              <th className="text-right px-3 py-2.5 font-medium text-slate-600">Subtotal</th>
              <th className="text-right px-3 py-2.5 font-medium text-slate-600">Petróleo $</th>
              <th className="text-right px-3 py-2.5 font-medium text-slate-600">Litros</th>
              <th className="text-right px-3 py-2.5 font-medium text-slate-600">Km</th>
              <th className="text-right px-3 py-2.5 font-medium text-slate-600">Gastos</th>
              <th className="text-right px-3 py-2.5 font-medium text-slate-600">Total</th>
              <th className="text-center px-3 py-2.5 font-medium text-slate-600">CL</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {informes.map(inf => (
              <tr key={inf.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono font-semibold text-slate-900">{inf.patente}</td>
                <td className="px-3 py-2 text-slate-600">{inf.conductor_nombre || '—'}</td>
                <td className="px-3 py-2 text-slate-500">{inf.relevo_nombre || '—'}</td>
                <td className="px-3 py-2 text-right text-slate-700">{fmt(inf.cta_cond)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{fmt(inf.cta_rel)}</td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">{fmt(inf.subtotal)}</td>
                <td className="px-3 py-2 text-right text-amber-600">{fmt(inf.petrol_monto)}</td>
                <td className="px-3 py-2 text-right text-slate-500">{fmtNum(inf.petrol_litros, 1)} L</td>
                <td className="px-3 py-2 text-right text-slate-500">{fmtNum(inf.km_recorridos)} km</td>
                <td className="px-3 py-2 text-right text-slate-600">{fmt(inf.gastos_caja)}</td>
                <td className={cn('px-3 py-2 text-right font-bold', (inf.total_neto ?? 0) >= 0 ? 'text-green-700' : 'text-red-600')}>
                  {fmt(inf.total_neto)}
                </td>
                <td className="px-3 py-2 text-center">
                  {inf.check_list
                    ? <span className="text-green-600">✓</span>
                    : <span className="text-slate-300">—</span>
                  }
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => openEdit(inf)} className="text-slate-400 hover:text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {informes.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-slate-400">
                  No hay registros para esta fecha
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cierre del día */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-700">Cierre del día</h2>
          <button
            onClick={() => {
              setCierreForm({
                gastos_oficina: cierreDia?.gastos_oficina?.toString() ?? '',
                deposito: cierreDia?.deposito?.toString() ?? '',
                notas: cierreDia?.notas ?? '',
              })
              setShowCierreForm(true)
            }}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {cierreDia ? 'Editar' : 'Registrar cierre'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Gastos de oficina</p>
            <p className="font-medium text-slate-900">{fmt(cierreDia?.gastos_oficina)}</p>
          </div>
          <div>
            <p className="text-slate-500">Depósito banco</p>
            <p className="font-medium text-slate-900">{fmt(cierreDia?.deposito)}</p>
          </div>
          <div>
            <p className="text-slate-500">Notas</p>
            <p className="text-slate-600">{cierreDia?.notas || '—'}</p>
          </div>
        </div>
      </div>

      {/* Modal de formulario de informe */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-slate-900">
                {editingId ? 'Editar registro' : 'Nuevo registro'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Fecha del registro */}
              <F label="Fecha del registro">
                <input
                  type="date"
                  value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  className="inp"
                />
              </F>

              {/* Bus */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <F label="Bus *">
                    <select value={form.bus_id} onChange={e => setForm(f => ({ ...f, bus_id: e.target.value }))} className="inp">
                      <option value="">Seleccionar...</option>
                      {buses.map(b => <option key={b.id} value={b.id}>{b.patente}</option>)}
                    </select>
                  </F>
                </div>
                <div>
                  <F label="Conductor">
                    <select value={form.conductor_id} onChange={e => setForm(f => ({ ...f, conductor_id: e.target.value }))} className="inp">
                      <option value="">—</option>
                      {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </F>
                </div>
                <div>
                  <F label="Relevo">
                    <select value={form.relevo_id} onChange={e => setForm(f => ({ ...f, relevo_id: e.target.value }))} className="inp">
                      <option value="">—</option>
                      {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </F>
                </div>
              </div>

              {/* Boletaje */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Boletaje</p>
                <div className="grid grid-cols-4 gap-3">
                  <F label="Cta. Conductor $"><input type="number" value={form.cta_cond} onChange={e => setForm(f => ({ ...f, cta_cond: e.target.value }))} className="inp" /></F>
                  <F label="Vueltas conductor"><input type="number" value={form.vueltas_cond} onChange={e => setForm(f => ({ ...f, vueltas_cond: e.target.value }))} className="inp" /></F>
                  <F label="Cta. Relevo $"><input type="number" value={form.cta_rel} onChange={e => setForm(f => ({ ...f, cta_rel: e.target.value }))} className="inp" /></F>
                  <F label="Vueltas relevo"><input type="number" value={form.vueltas_rel} onChange={e => setForm(f => ({ ...f, vueltas_rel: e.target.value }))} className="inp" /></F>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                  <span>Subtotal: <strong className="text-slate-900">{fmt(subtotal)}</strong></span>
                  <span>Pro/vuelta Cond: <strong>{proCond != null ? fmt(proCond) : '—'}</strong></span>
                  <span>Pro/vuelta Rel: <strong>{proRel != null ? fmt(proRel) : '—'}</strong></span>
                </div>
              </div>

              {/* Anticipos y vueltos */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Anticipos y vueltos</p>
                <div className="grid grid-cols-4 gap-3">
                  <F label="Ant. Conductor $"><input type="number" value={form.ant_cond} onChange={e => setForm(f => ({ ...f, ant_cond: e.target.value }))} className="inp" /></F>
                  <F label="Vuelto conductor"><input type="number" value={form.vuel_cond} onChange={e => setForm(f => ({ ...f, vuel_cond: e.target.value }))} className="inp" /></F>
                  <F label="Ant. Relevo $"><input type="number" value={form.ant_rel} onChange={e => setForm(f => ({ ...f, ant_rel: e.target.value }))} className="inp" /></F>
                  <F label="Vuelto relevo"><input type="number" value={form.vuel_rel} onChange={e => setForm(f => ({ ...f, vuel_rel: e.target.value }))} className="inp" /></F>
                </div>
              </div>

              {/* Combustible y km */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Combustible y kilómetros</p>
                <div className="grid grid-cols-3 gap-3">
                  <F label="Petróleo $"><input type="number" value={form.petrol_monto} onChange={e => setForm(f => ({ ...f, petrol_monto: e.target.value }))} className="inp" /></F>
                  <F label="Litros"><input type="number" value={form.petrol_litros} onChange={e => setForm(f => ({ ...f, petrol_litros: e.target.value }))} className="inp" /></F>
                  <F label="Km recorridos"><input type="number" value={form.km_recorridos} onChange={e => setForm(f => ({ ...f, km_recorridos: e.target.value }))} className="inp" /></F>
                </div>
              </div>

              {/* Gastos y bonos */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Gastos y bonos</p>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Gastos caja $"><input type="number" value={form.gastos_caja} onChange={e => setForm(f => ({ ...f, gastos_caja: e.target.value }))} className="inp" /></F>
                  <F label="Bonos $"><input type="number" value={form.bonos} onChange={e => setForm(f => ({ ...f, bonos: e.target.value }))} className="inp" /></F>
                </div>
              </div>

              {/* Check list y resumen */}
              <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.check_list}
                    onChange={e => setForm(f => ({ ...f, check_list: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-700">Check list realizado</span>
                </label>
                <div className="ml-auto text-sm">
                  Total neto: <strong className={totalNeto >= 0 ? 'text-green-700' : 'text-red-600'}>{fmt(totalNeto)}</strong>
                </div>
              </div>

              <F label="Notas">
                <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} className="inp resize-none" rows={2} />
              </F>
            </div>

            {error && (
              <p className="mx-6 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={guardando}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cierre del día */}
      {showCierreForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-sm">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Cierre del día — {fechaVer}</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <F label="Gastos de oficina $">
                <input type="number" value={cierreForm.gastos_oficina} onChange={e => setCierreForm(f => ({ ...f, gastos_oficina: e.target.value }))} className="inp" />
              </F>
              <F label="Depósito banco $">
                <input type="number" value={cierreForm.deposito} onChange={e => setCierreForm(f => ({ ...f, deposito: e.target.value }))} className="inp" />
              </F>
              <F label="Notas">
                <textarea value={cierreForm.notas} onChange={e => setCierreForm(f => ({ ...f, notas: e.target.value }))} className="inp resize-none" rows={2} />
              </F>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowCierreForm(false)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={handleGuardarCierre} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg">Guardar</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .inp {
          width: 100%;
          padding: 0.4rem 0.6rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
        }
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
