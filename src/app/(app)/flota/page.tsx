import { createClient } from '@/lib/supabase/server'
import FlotaClient from './FlotaClient'

export const dynamic = 'force-dynamic'

export default async function FlotaPage() {
  const supabase = await createClient()

  const [{ data: buses }, { data: modelos }] = await Promise.all([
    supabase
      .from('buses')
      .select('*, modelos_bus(*)')
      .order('patente'),
    supabase
      .from('modelos_bus')
      .select('*')
      .order('marca'),
  ])

  return <FlotaClient buses={buses ?? []} modelos={modelos ?? []} />
}
