import { createClient } from '@/lib/supabase/server'
import InventarioClient from './InventarioClient'

export const dynamic = 'force-dynamic'

export default async function InventarioPage() {
  const supabase = await createClient()

  const [{ data: items }, { data: categorias }] = await Promise.all([
    supabase
      .from('items_catalogo')
      .select('*, categorias_item(nombre)')
      .order('nombre'),
    supabase
      .from('categorias_item')
      .select('*')
      .order('nombre'),
  ])

  return <InventarioClient items={items ?? []} categorias={categorias ?? []} />
}
