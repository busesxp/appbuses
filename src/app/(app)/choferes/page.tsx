import { createClient } from '@/lib/supabase/server'
import ChoferesClient from './ChoferesClient'

export const dynamic = 'force-dynamic'

export default async function ChoferesPage() {
  const supabase = await createClient()
  const { data: choferes } = await supabase
    .from('choferes')
    .select('*')
    .order('nombre')

  return <ChoferesClient choferes={choferes ?? []} />
}
