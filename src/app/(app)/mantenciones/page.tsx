export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import MantencionesClient from './MantencionesClient'

export default async function Page() {
  const supabase = await createClient()

  const [{ data: mantenciones }, { data: buses }, { data: items }] = await Promise.all([
    supabase
      .from('mantenciones')
      .select('*, buses(patente), mantencion_items(id, cantidad, costo_unitario, items_catalogo(nombre, unidad))')
      .order('fecha', { ascending: false }),
    supabase
      .from('buses')
      .select('id, patente')
      .eq('estado', 'activo')
      .order('patente'),
    supabase
      .from('items_catalogo')
      .select('id, nombre, marca, codigo, costo_referencia, unidad, stock_actual')
      .order('nombre'),
  ])

  return (
    <MantencionesClient
      mantenciones={(mantenciones ?? []) as any}
      buses={buses ?? []}
      items={items ?? []}
    />
  )
}
