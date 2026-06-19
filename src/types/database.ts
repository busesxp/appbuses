export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type BusEstado = 'activo' | 'mantencion' | 'baja'
export type ChoferEstado = 'activo' | 'inactivo'
export type MovimientoTipo = 'entrada' | 'salida'
export type UserRol = 'admin' | 'editor' | 'viewer'

// ---- Row types ----

export interface ModeloBusRow {
  id: string; marca: string; modelo: string; descripcion: string | null; created_at: string
}
export interface BusRow {
  id: string; patente: string; modelo_id: string | null; año: number | null; color: string | null
  n_motor: string | null; n_chasis: string | null; combustible: string | null; estado: BusEstado; notas: string | null; created_at: string
}
export interface ChoferRow {
  id: string; nombre: string; rut: string | null; telefono: string | null; fecha_ingreso: string | null; estado: ChoferEstado; created_at: string
}
export interface CategoriaItemRow { id: string; nombre: string }
export interface ItemCatalogoRow {
  id: string; categoria_id: string | null; codigo: string | null; nombre: string; marca: string | null
  especificacion: string | null; costo_referencia: number; stock_actual: number; stock_minimo: number; unidad: string | null; created_at: string
}
export interface InformeDiarioRow {
  id: string; bus_id: string; fecha: string; conductor_id: string | null; relevo_id: string | null
  cta_cond: number; cta_rel: number; vueltas_cond: number; vueltas_rel: number
  ant_cond: number; ant_rel: number; vuel_cond: number; vuel_rel: number
  petrol_monto: number; petrol_litros: number; km_recorridos: number
  gastos_caja: number; bonos: number; check_list: boolean; notas: string | null; created_at: string; updated_at: string
}
export interface CierreDiaRow {
  id: string; fecha: string; gastos_oficina: number; deposito: number; notas: string | null; created_at: string
}
export interface MantencionRow {
  id: string; bus_id: string; fecha: string; tipo: string | null; km_actual: number | null; descripcion: string | null; costo_mano_obra: number; created_at: string
}
export interface MantencionItemRow {
  id: string; mantencion_id: string; item_id: string; cantidad: number; costo_unitario: number
}
export interface MovimientoInventarioRow {
  id: string; item_id: string; tipo: MovimientoTipo; cantidad: number; costo_unitario: number
  fecha: string; referencia: string | null; mantencion_id: string | null; notas: string | null; created_at: string
}
export interface UsuarioRow { id: string; nombre: string | null; rol: UserRol; created_at: string }

// ---- Vista informe diario ----
export interface InformeDiarioVista extends InformeDiarioRow {
  patente: string; marca: string; modelo: string
  conductor_nombre: string; relevo_nombre: string
  subtotal: number; pro_cond: number | null; pro_rel: number | null
  vuel_total: number; unid_petr: number | null; cons_xkm: number | null; total_neto: number
}

// ---- Database type for Supabase client ----
// NOTE: Relationships: [] is required by @supabase/postgrest-js GenericTable
export interface Database {
  public: {
    Tables: {
      modelos_bus: {
        Row: ModeloBusRow
        Insert: { id?: string; marca: string; modelo: string; descripcion?: string | null }
        Update: { marca?: string; modelo?: string; descripcion?: string | null }
        Relationships: []
      }
      buses: {
        Row: BusRow
        Insert: {
          id?: string; patente: string; modelo_id?: string | null; año?: number | null; color?: string | null
          n_motor?: string | null; n_chasis?: string | null; combustible?: string | null; estado?: BusEstado; notas?: string | null
        }
        Update: {
          patente?: string; modelo_id?: string | null; año?: number | null; color?: string | null
          n_motor?: string | null; n_chasis?: string | null; combustible?: string | null; estado?: BusEstado; notas?: string | null
        }
        Relationships: []
      }
      choferes: {
        Row: ChoferRow
        Insert: { id?: string; nombre: string; rut?: string | null; telefono?: string | null; fecha_ingreso?: string | null; estado?: ChoferEstado }
        Update: { nombre?: string; rut?: string | null; telefono?: string | null; fecha_ingreso?: string | null; estado?: ChoferEstado }
        Relationships: []
      }
      categorias_item: {
        Row: CategoriaItemRow
        Insert: { id?: string; nombre: string }
        Update: { nombre?: string }
        Relationships: []
      }
      items_catalogo: {
        Row: ItemCatalogoRow
        Insert: {
          id?: string; categoria_id?: string | null; codigo?: string | null; nombre: string; marca?: string | null
          especificacion?: string | null; costo_referencia?: number; stock_actual?: number; stock_minimo?: number; unidad?: string | null
        }
        Update: {
          categoria_id?: string | null; codigo?: string | null; nombre?: string; marca?: string | null
          especificacion?: string | null; costo_referencia?: number; stock_actual?: number; stock_minimo?: number; unidad?: string | null
        }
        Relationships: []
      }
      informes_diarios: {
        Row: InformeDiarioRow
        Insert: {
          id?: string; bus_id: string; fecha: string; conductor_id?: string | null; relevo_id?: string | null
          cta_cond?: number; cta_rel?: number; vueltas_cond?: number; vueltas_rel?: number
          ant_cond?: number; ant_rel?: number; vuel_cond?: number; vuel_rel?: number
          petrol_monto?: number; petrol_litros?: number; km_recorridos?: number
          gastos_caja?: number; bonos?: number; check_list?: boolean; notas?: string | null
        }
        Update: {
          bus_id?: string; fecha?: string; conductor_id?: string | null; relevo_id?: string | null
          cta_cond?: number; cta_rel?: number; vueltas_cond?: number; vueltas_rel?: number
          ant_cond?: number; ant_rel?: number; vuel_cond?: number; vuel_rel?: number
          petrol_monto?: number; petrol_litros?: number; km_recorridos?: number
          gastos_caja?: number; bonos?: number; check_list?: boolean; notas?: string | null
        }
        Relationships: []
      }
      cierres_dia: {
        Row: CierreDiaRow
        Insert: { id?: string; fecha: string; gastos_oficina?: number; deposito?: number; notas?: string | null }
        Update: { fecha?: string; gastos_oficina?: number; deposito?: number; notas?: string | null }
        Relationships: []
      }
      mantenciones: {
        Row: MantencionRow
        Insert: { id?: string; bus_id: string; fecha: string; tipo?: string | null; km_actual?: number | null; descripcion?: string | null; costo_mano_obra?: number }
        Update: { bus_id?: string; fecha?: string; tipo?: string | null; km_actual?: number | null; descripcion?: string | null; costo_mano_obra?: number }
        Relationships: []
      }
      mantencion_items: {
        Row: MantencionItemRow
        Insert: { id?: string; mantencion_id: string; item_id: string; cantidad: number; costo_unitario?: number }
        Update: { mantencion_id?: string; item_id?: string; cantidad?: number; costo_unitario?: number }
        Relationships: []
      }
      movimientos_inventario: {
        Row: MovimientoInventarioRow
        Insert: { id?: string; item_id: string; tipo: MovimientoTipo; cantidad: number; costo_unitario?: number; fecha?: string; referencia?: string | null; mantencion_id?: string | null; notas?: string | null }
        Update: { item_id?: string; tipo?: MovimientoTipo; cantidad?: number; costo_unitario?: number; fecha?: string; referencia?: string | null; mantencion_id?: string | null; notas?: string | null }
        Relationships: []
      }
      usuarios: {
        Row: UsuarioRow
        Insert: { id: string; nombre?: string | null; rol?: UserRol }
        Update: { nombre?: string | null; rol?: UserRol }
        Relationships: []
      }
    }
    Views: {
      v_informes_diarios: {
        Row: InformeDiarioVista
        Relationships: []
      }
    }
    Functions: {
      mi_rol: { Args: Record<never, never>; Returns: string }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

// Alias convenientes
export type Bus = BusRow
export type BusInsert = Database['public']['Tables']['buses']['Insert']
export type ModeloBus = ModeloBusRow
export type Chofer = ChoferRow
export type ChoferInsert = Database['public']['Tables']['choferes']['Insert']
export type ItemCatalogo = ItemCatalogoRow
export type InformeDiario = InformeDiarioRow
export type InformeDiarioInsert = Database['public']['Tables']['informes_diarios']['Insert']
export type CierreDia = CierreDiaRow
export type Mantencion = MantencionRow
export type MantencionItem = MantencionItemRow
export type MovimientoInventario = MovimientoInventarioRow

export type BusConModelo = BusRow & { modelos_bus: ModeloBusRow | null }
