import { createClient } from '@/lib/supabase/server'
import InformesClient from './InformesClient'

export const dynamic = 'force-dynamic'

export default async function InformesPage() {
  const supabase = await createClient()

  const hoy = new Date().toISOString().split('T')[0]

  const [{ data: informes }, { data: buses }, { data: choferes }, { data: cierre }] = await Promise.all([
    supabase
      .from('v_informes_diarios')
      .select('*')
      .eq('fecha', hoy)
      .order('patente'),
    supabase.from('buses').select('id, patente, estado').eq('estado', 'activo').order('patente'),
    supabase.from('choferes').select('id, nombre').eq('estado', 'activo').order('nombre'),
    supabase.from('cierres_dia').select('*').eq('fecha', hoy).maybeSingle(),
  ])

  return (
    <InformesClient
      fecha={hoy}
      informes={informes ?? []}
      buses={buses ?? []}
      choferes={choferes ?? []}
      cierreDia={cierre}
    />
  )
}
