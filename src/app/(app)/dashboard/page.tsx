import { createClient } from '@/lib/supabase/server'

const ALERTA_KM = 10_000
const SPIKE_UMBRAL = 1.15

function hace(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().split('T')[0]
}

function inicioMes() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function nombreMes() {
  return new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: todosLosBuses },
    { data: mantenciones },
    { data: kmOdometro },
    { data: consumoData },
    { data: informesRecientes },
    { data: informesMes },
  ] = await Promise.all([
    supabase.from('buses').select('id, patente, estado').order('patente'),

    supabase.from('mantenciones').select('bus_id, fecha, km_actual').order('fecha', { ascending: false }),

    supabase.from('informes_diarios').select('bus_id, km_recorridos').not('km_recorridos', 'is', null).gt('km_recorridos', 0),

    supabase.from('v_informes_diarios').select('bus_id, patente, fecha, cons_xkm').gte('fecha', hace(30)).not('cons_xkm', 'is', null),

    supabase.from('v_informes_diarios')
      .select('bus_id, patente, fecha, subtotal, total_neto, petrol_monto, km_por_litro')
      .gte('fecha', hace(7))
      .order('fecha', { ascending: false }),

    supabase.from('v_informes_diarios')
      .select('subtotal, total_neto, petrol_monto, fecha')
      .gte('fecha', inicioMes()),
  ])

  // ── Acumulado del mes ─────────────────────────────────────────────────────
  const diasConDatos = new Set((informesMes ?? []).map(r => r.fecha)).size
  const mesBoletaje  = (informesMes ?? []).reduce((s, r) => s + (r.subtotal    ?? 0), 0)
  const mesNeto      = (informesMes ?? []).reduce((s, r) => s + (r.total_neto  ?? 0), 0)
  const mesCombust   = (informesMes ?? []).reduce((s, r) => s + (r.petrol_monto ?? 0), 0)

  // ── Estado de la flota ────────────────────────────────────────────────────
  const activos   = (todosLosBuses ?? []).filter(b => b.estado === 'activo')
  const enMant    = (todosLosBuses ?? []).filter(b => b.estado === 'mantencion')
  const enBaja    = (todosLosBuses ?? []).filter(b => b.estado === 'baja')

  // ── Último día con informes ───────────────────────────────────────────────
  const fechas = [...new Set((informesRecientes ?? []).map(r => r.fecha))].sort().reverse()
  const ultimaFecha = fechas[0] ?? null

  const informesUltimoDia = (informesRecientes ?? []).filter(r => r.fecha === ultimaFecha)
  const totalBoletaje = informesUltimoDia.reduce((s, r) => s + (r.subtotal ?? 0), 0)
  const totalNeto     = informesUltimoDia.reduce((s, r) => s + (r.total_neto ?? 0), 0)
  const totalCombust  = informesUltimoDia.reduce((s, r) => s + (r.petrol_monto ?? 0), 0)
  const busesConInforme = informesUltimoDia.length

  // ── Buses sin informe en el último día registrado ─────────────────────────
  const patentesSinInforme = activos
    .filter(b => !informesUltimoDia.some(r => r.bus_id === b.id))
    .map(b => b.patente)

  // ── Alertas de mantención ─────────────────────────────────────────────────
  const ultimaMant = new Map<string, { fecha: string; km_actual: number | null }>()
  for (const m of mantenciones ?? []) {
    if (!ultimaMant.has(m.bus_id)) ultimaMant.set(m.bus_id, { fecha: m.fecha, km_actual: m.km_actual })
  }

  const alertasMant: { patente: string; kmDesde: number; fechaMant: string | null }[] = []
  for (const bus of activos) {
    const mant = ultimaMant.get(bus.id)
    const registrosBus = (kmOdometro ?? []).filter(r => r.bus_id === bus.id)
    if (registrosBus.length === 0) continue
    const maxOdometro = Math.max(...registrosBus.map(r => r.km_recorridos ?? 0))
    const kmDesde = mant?.km_actual != null ? maxOdometro - mant.km_actual : maxOdometro
    if (kmDesde >= ALERTA_KM * 0.7) {
      alertasMant.push({ patente: bus.patente, kmDesde, fechaMant: mant?.fecha ?? null })
    }
  }
  alertasMant.sort((a, b) => b.kmDesde - a.kmDesde)

  // ── Alertas consumo anómalo ───────────────────────────────────────────────
  const fecha7d = hace(7)
  const consumoPorBus = new Map<string, { reciente: number[]; historico: number[] }>()
  for (const row of consumoData ?? []) {
    if (!row.cons_xkm) continue
    if (!consumoPorBus.has(row.bus_id)) consumoPorBus.set(row.bus_id, { reciente: [], historico: [] })
    const entry = consumoPorBus.get(row.bus_id)!
    if (row.fecha >= fecha7d) entry.reciente.push(row.cons_xkm)
    else entry.historico.push(row.cons_xkm)
  }

  const alertasConsumo: { patente: string; reciente: number; historico: number; ratio: number }[] = []
  for (const [busId, { reciente, historico }] of consumoPorBus) {
    if (reciente.length < 2 || historico.length < 3) continue
    const avgRec = reciente.reduce((s, v) => s + v, 0) / reciente.length
    const avgHis = historico.reduce((s, v) => s + v, 0) / historico.length
    if (avgRec > avgHis * SPIKE_UMBRAL) {
      const bus = activos.find(b => b.id === busId)
      if (bus) alertasConsumo.push({ patente: bus.patente, reciente: avgRec, historico: avgHis, ratio: avgRec / avgHis })
    }
  }
  alertasConsumo.sort((a, b) => b.ratio - a.ratio)

  const totalAlertas = alertasMant.filter(a => a.kmDesde >= ALERTA_KM).length + alertasConsumo.length + patentesSinInforme.length

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {totalAlertas === 0 ? 'Todo en orden' : `${totalAlertas} situación${totalAlertas > 1 ? 'es' : ''} requieren atención`}
        </p>
      </div>

      {/* Estado de la flota */}
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Estado de la flota</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-3xl font-black text-green-600">{activos.length}</p>
            <p className="text-xs text-slate-500 mt-1">Activos</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className={`text-3xl font-black ${enMant.length > 0 ? 'text-yellow-500' : 'text-slate-300'}`}>{enMant.length}</p>
            <p className="text-xs text-slate-500 mt-1">En mantención</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className={`text-3xl font-black ${enBaja.length > 0 ? 'text-red-400' : 'text-slate-300'}`}>{enBaja.length}</p>
            <p className="text-xs text-slate-500 mt-1">Baja</p>
          </div>
        </div>
      </section>

      {/* Resumen último día */}
      {ultimaFecha && (
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Último día registrado — {ultimaFecha} <span className="text-slate-300 font-normal normal-case">({busesConInforme} buses)</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Boletaje total</p>
              <p className="text-xl font-bold text-blue-600">{fmt(totalBoletaje)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Total neto</p>
              <p className={`text-xl font-bold ${totalNeto >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(totalNeto)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 col-span-2 md:col-span-1">
              <p className="text-xs text-slate-500 mb-1">Combustible</p>
              <p className="text-xl font-bold text-amber-600">{fmt(totalCombust)}</p>
            </div>
          </div>
        </section>
      )}

      {/* Acumulado del mes */}
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Acumulado {nombreMes()} <span className="text-slate-300 font-normal normal-case">({diasConDatos} día{diasConDatos !== 1 ? 's' : ''} con datos)</span>
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Boletaje total</p>
            <p className="text-xl font-bold text-blue-600">{fmt(mesBoletaje)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total neto</p>
            <p className={`text-xl font-bold ${mesNeto >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(mesNeto)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Combustible</p>
            <p className="text-xl font-bold text-amber-600">{fmt(mesCombust)}</p>
          </div>
        </div>
      </section>

      {/* Buses sin informe */}
      {patentesSinInforme.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Sin informe el {ultimaFecha}
          </h2>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 flex flex-wrap gap-2">
            {patentesSinInforme.map(p => (
              <span key={p} className="px-3 py-1 bg-white border border-slate-300 rounded-full text-sm font-mono font-semibold text-slate-600">
                {p}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Alertas mantención */}
      {alertasMant.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Mantenciones</h2>
          <div className="space-y-2">
            {alertasMant.map(a => {
              const critica = a.kmDesde >= ALERTA_KM
              return (
                <div key={a.patente} className={`flex items-center justify-between rounded-xl border px-5 py-4 ${critica ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div className="flex items-center gap-4">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${critica ? 'bg-red-500' : 'bg-yellow-400'}`} />
                    <div>
                      <p className="font-semibold text-slate-900">{a.patente}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{a.fechaMant ? `Última mantención: ${a.fechaMant}` : 'Sin mantención registrada'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${critica ? 'text-red-600' : 'text-yellow-600'}`}>{a.kmDesde.toLocaleString('es-CL')} km</p>
                    <p className="text-xs text-slate-500">{critica ? 'Mantención requerida' : `Meta: ${ALERTA_KM.toLocaleString('es-CL')} km`}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Alertas consumo */}
      {alertasConsumo.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Consumo anómalo</h2>
          <div className="space-y-2">
            {alertasConsumo.map(a => (
              <div key={a.patente} className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-5 py-4">
                <div className="flex items-center gap-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-900">{a.patente}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Posible falla de inyección</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-orange-600">+{Math.round((a.ratio - 1) * 100)}%</p>
                  <p className="text-xs text-slate-500">{a.reciente.toFixed(3)} vs {a.historico.toFixed(3)} L/km hist.</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Todo OK */}
      {totalAlertas === 0 && ultimaFecha && alertasMant.length === 0 && alertasConsumo.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-sm text-green-700 text-center">
          Sin alertas activas — flota operando con normalidad
        </div>
      )}

    </div>
  )
}
