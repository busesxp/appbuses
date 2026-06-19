import { createClient } from '@/lib/supabase/server'

const ALERTA_KM = 10_000
const SPIKE_UMBRAL = 1.15

function hoy() {
  return new Date().toISOString().split('T')[0]
}

function hace(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().split('T')[0]
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: buses }, { data: mantenciones }, { data: kmRecorridos }, { data: consumoData }] =
    await Promise.all([
      supabase
        .from('buses')
        .select('id, patente')
        .eq('estado', 'activo')
        .order('patente'),

      supabase
        .from('mantenciones')
        .select('bus_id, fecha, km_actual')
        .order('fecha', { ascending: false }),

      supabase
        .from('informes_diarios')
        .select('bus_id, fecha, km_recorridos')
        .gte('fecha', hace(90))
        .not('km_recorridos', 'is', null),

      supabase
        .from('v_informes_diarios')
        .select('bus_id, patente, fecha, cons_xkm')
        .gte('fecha', hace(30))
        .not('cons_xkm', 'is', null),
    ])

  // Last mantención per bus
  const ultimaMant = new Map<string, { fecha: string; km_actual: number | null }>()
  for (const m of mantenciones ?? []) {
    if (!ultimaMant.has(m.bus_id)) {
      ultimaMant.set(m.bus_id, { fecha: m.fecha, km_actual: m.km_actual })
    }
  }

  // Km driven per bus since last mantención
  const alertasMant: { patente: string; kmDesde: number; fechaMant: string | null }[] = []
  for (const bus of buses ?? []) {
    const mant = ultimaMant.get(bus.id)
    const fechaDesde = mant?.fecha ?? hace(365)
    const kmDesde = (kmRecorridos ?? [])
      .filter(r => r.bus_id === bus.id && r.fecha >= fechaDesde)
      .reduce((s, r) => s + (r.km_recorridos ?? 0), 0)

    if (kmDesde >= ALERTA_KM * 0.7) {
      alertasMant.push({
        patente: bus.patente,
        kmDesde,
        fechaMant: mant?.fecha ?? null,
      })
    }
  }
  alertasMant.sort((a, b) => b.kmDesde - a.kmDesde)

  // Consumo anómalo: avg cons_xkm últimos 7d vs 8–30d
  const fecha7d = hace(7)
  const alertasConsumo: { patente: string; reciente: number; historico: number; ratio: number }[] = []

  const consumoPorBus = new Map<string, { reciente: number[]; historico: number[] }>()
  for (const row of consumoData ?? []) {
    if (!row.cons_xkm) continue
    if (!consumoPorBus.has(row.bus_id)) consumoPorBus.set(row.bus_id, { reciente: [], historico: [] })
    const entry = consumoPorBus.get(row.bus_id)!
    if (row.fecha >= fecha7d) {
      entry.reciente.push(row.cons_xkm)
    } else {
      entry.historico.push(row.cons_xkm)
    }
  }

  for (const [busId, { reciente, historico }] of consumoPorBus) {
    if (reciente.length < 2 || historico.length < 3) continue
    const avgRec = reciente.reduce((s, v) => s + v, 0) / reciente.length
    const avgHis = historico.reduce((s, v) => s + v, 0) / historico.length
    if (avgRec > avgHis * SPIKE_UMBRAL) {
      const bus = (buses ?? []).find(b => b.id === busId)
      if (bus) {
        alertasConsumo.push({
          patente: bus.patente,
          reciente: avgRec,
          historico: avgHis,
          ratio: avgRec / avgHis,
        })
      }
    }
  }
  alertasConsumo.sort((a, b) => b.ratio - a.ratio)

  const totalAlertas = alertasMant.filter(a => a.kmDesde >= ALERTA_KM).length + alertasConsumo.length

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {totalAlertas === 0 ? 'Todo en orden' : `${totalAlertas} alerta${totalAlertas > 1 ? 's' : ''} activa${totalAlertas > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Alertas mantención */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Mantenciones
        </h2>

        {alertasMant.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-5 text-sm text-slate-400 text-center">
            Sin datos de kilometraje — ingresa informes diarios para activar alertas
          </div>
        ) : (
          <div className="space-y-2">
            {alertasMant.map(a => {
              const critica = a.kmDesde >= ALERTA_KM
              const advertencia = a.kmDesde >= ALERTA_KM * 0.7 && !critica
              return (
                <div
                  key={a.patente}
                  className={`flex items-center justify-between rounded-xl border px-5 py-4 ${
                    critica
                      ? 'bg-red-50 border-red-200'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${critica ? 'bg-red-500' : 'bg-yellow-400'}`} />
                    <div>
                      <p className="font-semibold text-slate-900">{a.patente}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {a.fechaMant
                          ? `Última mantención: ${a.fechaMant}`
                          : 'Sin mantención registrada'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${critica ? 'text-red-600' : 'text-yellow-600'}`}>
                      {a.kmDesde.toLocaleString('es-CL')} km
                    </p>
                    <p className="text-xs text-slate-500">
                      {critica ? 'Mantención requerida' : `Meta: ${ALERTA_KM.toLocaleString('es-CL')} km`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Alertas consumo */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Consumo de combustible
        </h2>

        {alertasConsumo.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-5 text-sm text-slate-400 text-center">
            Consumo normal en todos los buses — sin anomalías detectadas
          </div>
        ) : (
          <div className="space-y-2">
            {alertasConsumo.map(a => (
              <div
                key={a.patente}
                className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-900">{a.patente}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Posible falla de inyección — consumo elevado
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-orange-600">
                    +{Math.round((a.ratio - 1) * 100)}%
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.reciente.toFixed(3)} L/km vs {a.historico.toFixed(3)} L/km hist.
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
