-- ============================================================
-- Buses XP — Schema inicial
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";

-- ============================================================
-- MODELOS DE BUS
-- ============================================================
create table modelos_bus (
  id          uuid primary key default uuid_generate_v4(),
  marca       text not null,
  modelo      text not null,
  descripcion text,
  created_at  timestamptz default now()
);

insert into modelos_bus (id, marca, modelo) values
  ('11111111-0000-0000-0000-000000000001', 'Volare', 'W9'),
  ('11111111-0000-0000-0000-000000000002', 'Volare', 'W9 Fly'),
  ('11111111-0000-0000-0000-000000000003', 'Volare', 'W8'),
  ('11111111-0000-0000-0000-000000000004', 'Mercedes-Benz', 'LO 915'),
  ('11111111-0000-0000-0000-000000000005', 'Marcopolo/Volare', 'Volare');

-- ============================================================
-- BUSES (FLOTA)
-- ============================================================
create table buses (
  id          uuid primary key default uuid_generate_v4(),
  patente     text not null unique,
  modelo_id   uuid references modelos_bus(id),
  año         integer,
  color       text,
  n_motor     text,
  n_chasis    text,
  combustible text default 'Diésel',
  estado      text not null default 'activo' check (estado in ('activo', 'mantencion', 'baja')),
  notas       text,
  created_at  timestamptz default now()
);

-- Flota inicial confirmada
insert into buses (patente, modelo_id, año, color, n_motor, n_chasis) values
  ('DWSF95', '11111111-0000-0000-0000-000000000001', 2012, 'Naranjo',  'D1A061501',    '93PB40E3PCC038690'),
  ('DPZZ97', '11111111-0000-0000-0000-000000000002', 2012, 'Blanco',   'D1A061181',    '93PB40E31CC038761'),
  ('DPZZ96', '11111111-0000-0000-0000-000000000001', 2012, 'Celeste',  'D1A062728',    '93PB40E31CC038735'),
  ('DWSF94', '11111111-0000-0000-0000-000000000001', 2012, 'Naranjo',  'D1A062092',    '93PB40E3PCC038689'),
  ('CSGC60', '11111111-0000-0000-0000-000000000001', 2011, 'Naranjo',  'D1A044696',    '93PB40E3PAC033892'),
  ('YY1253', '11111111-0000-0000-0000-000000000003', 2005, 'Blanco',   '4122306',      '93PB12B3P5C015160'),
  ('BVPW56', '11111111-0000-0000-0000-000000000004', 2009, 'Gris',     '904957U0756738','9BM688277-8B-570243'),
  ('SR4464', '11111111-0000-0000-0000-000000000005', 2000, 'Blanco',   '40704015594',  '93PB02A3NXC001412');

-- ============================================================
-- CHOFERES
-- ============================================================
create table choferes (
  id            uuid primary key default uuid_generate_v4(),
  nombre        text not null,
  rut           text,
  telefono      text,
  fecha_ingreso date,
  estado        text not null default 'activo' check (estado in ('activo', 'inactivo')),
  created_at    timestamptz default now()
);

-- ============================================================
-- CATEGORÍAS DE ITEMS
-- ============================================================
create table categorias_item (
  id     uuid primary key default uuid_generate_v4(),
  nombre text not null unique
);

insert into categorias_item (nombre) values
  ('Aceite motor'),
  ('Aceite caja'),
  ('Filtro aceite'),
  ('Filtro aire'),
  ('Filtro combustible'),
  ('Correa'),
  ('Rodamiento'),
  ('Pastillas/balatas'),
  ('Neumático'),
  ('Batería'),
  ('Otro');

-- ============================================================
-- CATÁLOGO DE ITEMS / REPUESTOS
-- ============================================================
create table items_catalogo (
  id               uuid primary key default uuid_generate_v4(),
  categoria_id     uuid references categorias_item(id),
  codigo           text,
  nombre           text not null,
  marca            text,
  especificacion   text,
  costo_referencia numeric(12,2) default 0,
  stock_actual     numeric(10,2) default 0,
  stock_minimo     numeric(10,2) default 0,
  unidad           text default 'unidad',
  created_at       timestamptz default now()
);

-- ============================================================
-- FICHA TÉCNICA POR MODELO (heredable)
-- ============================================================
create table ficha_tecnica_modelo (
  id         uuid primary key default uuid_generate_v4(),
  modelo_id  uuid references modelos_bus(id) on delete cascade,
  item_id    uuid references items_catalogo(id) on delete cascade,
  cantidad_uso numeric(8,2) default 1,
  notas      text,
  unique(modelo_id, item_id)
);

-- ============================================================
-- FICHA TÉCNICA POR BUS (override por máquina)
-- ============================================================
create table ficha_tecnica_bus (
  id         uuid primary key default uuid_generate_v4(),
  bus_id     uuid references buses(id) on delete cascade,
  item_id    uuid references items_catalogo(id) on delete cascade,
  cantidad_uso numeric(8,2) default 1,
  notas      text,
  unique(bus_id, item_id)
);

-- ============================================================
-- INFORMES DIARIOS (operación por bus/día)
-- ============================================================
create table informes_diarios (
  id              uuid primary key default uuid_generate_v4(),
  bus_id          uuid not null references buses(id),
  fecha           date not null,
  conductor_id    uuid references choferes(id),
  relevo_id       uuid references choferes(id),

  -- Boletaje
  cta_cond        numeric(12,2) default 0,  -- recaudación conductor
  cta_rel         numeric(12,2) default 0,  -- recaudación relevo
  vueltas_cond    integer default 0,
  vueltas_rel     integer default 0,

  -- Anticipos y vueltos
  ant_cond        numeric(12,2) default 0,
  ant_rel         numeric(12,2) default 0,
  vuel_cond       numeric(12,2) default 0,
  vuel_rel        numeric(12,2) default 0,

  -- Combustible
  petrol_monto    numeric(12,2) default 0,
  petrol_litros   numeric(8,2)  default 0,

  -- Kilómetros
  km_recorridos   numeric(10,2) default 0,

  -- Gastos y bonos
  gastos_caja     numeric(12,2) default 0,
  bonos           numeric(12,2) default 0,

  -- Check list
  check_list      boolean default false,

  -- Campos calculados (almacenados para evitar división por cero en reportes)
  -- subtotal = cta_cond + cta_rel
  -- pro_cond = cta_cond / vueltas_cond (null si vueltas_cond = 0)
  -- pro_rel  = cta_rel  / vueltas_rel  (null si vueltas_rel  = 0)
  -- total    = subtotal - ant_cond - ant_rel - petrol_monto - gastos_caja - bonos

  notas           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  unique(bus_id, fecha)
);

-- Vista con campos calculados (no almacenados)
create view v_informes_diarios as
select
  i.*,
  b.patente,
  mb.marca,
  mb.modelo,
  concat_ws(' ', c1.nombre, '') as conductor_nombre,
  concat_ws(' ', c2.nombre, '') as relevo_nombre,

  -- Subtotal
  i.cta_cond + i.cta_rel as subtotal,

  -- Promedio por vuelta (null si 0 vueltas)
  case when i.vueltas_cond > 0 then round(i.cta_cond / i.vueltas_cond, 0) else null end as pro_cond,
  case when i.vueltas_rel  > 0 then round(i.cta_rel  / i.vueltas_rel,  0) else null end as pro_rel,

  -- Vuelto total
  i.vuel_cond + i.vuel_rel as vuel_total,

  -- Precio por litro
  case when i.petrol_litros > 0 then round(i.petrol_monto / i.petrol_litros, 0) else null end as unid_petr,

  -- Consumo por km
  case when i.km_recorridos > 0 then round(i.petrol_litros / i.km_recorridos, 3) else null end as cons_xkm,

  -- Total neto
  (i.cta_cond + i.cta_rel) - i.ant_cond - i.ant_rel - i.petrol_monto - i.gastos_caja - i.bonos as total_neto

from informes_diarios i
join buses b on b.id = i.bus_id
join modelos_bus mb on mb.id = b.modelo_id
left join choferes c1 on c1.id = i.conductor_id
left join choferes c2 on c2.id = i.relevo_id;

-- ============================================================
-- CIERRES DE DÍA (nivel empresa)
-- ============================================================
create table cierres_dia (
  id              uuid primary key default uuid_generate_v4(),
  fecha           date not null unique,
  gastos_oficina  numeric(12,2) default 0,
  deposito        numeric(12,2) default 0,
  notas           text,
  created_at      timestamptz default now()
);

-- ============================================================
-- MOVIMIENTOS DE INVENTARIO
-- ============================================================
create table movimientos_inventario (
  id               uuid primary key default uuid_generate_v4(),
  item_id          uuid not null references items_catalogo(id),
  tipo             text not null check (tipo in ('entrada', 'salida')),
  cantidad         numeric(10,2) not null,
  costo_unitario   numeric(12,2) default 0,
  fecha            date not null default current_date,
  referencia       text,          -- "compra" / mantencion_id / etc.
  mantencion_id    uuid,          -- FK se agrega después (forward ref)
  notas            text,
  created_at       timestamptz default now()
);

-- Trigger para actualizar stock_actual en items_catalogo
create or replace function actualizar_stock()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.tipo = 'entrada' then
      update items_catalogo set stock_actual = stock_actual + NEW.cantidad where id = NEW.item_id;
    else
      update items_catalogo set stock_actual = stock_actual - NEW.cantidad where id = NEW.item_id;
    end if;
  elsif TG_OP = 'DELETE' then
    if OLD.tipo = 'entrada' then
      update items_catalogo set stock_actual = stock_actual - OLD.cantidad where id = OLD.item_id;
    else
      update items_catalogo set stock_actual = stock_actual + OLD.cantidad where id = OLD.item_id;
    end if;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

create trigger trg_actualizar_stock
after insert or delete on movimientos_inventario
for each row execute function actualizar_stock();

-- ============================================================
-- MANTENCIONES
-- ============================================================
create table mantenciones (
  id               uuid primary key default uuid_generate_v4(),
  bus_id           uuid not null references buses(id),
  fecha            date not null,
  tipo             text,          -- preventiva / correctiva / otro
  km_actual        numeric(10,0),
  descripcion      text,
  costo_mano_obra  numeric(12,2) default 0,
  created_at       timestamptz default now()
);

create table mantencion_items (
  id               uuid primary key default uuid_generate_v4(),
  mantencion_id    uuid not null references mantenciones(id) on delete cascade,
  item_id          uuid not null references items_catalogo(id),
  cantidad         numeric(10,2) not null,
  costo_unitario   numeric(12,2) default 0
);

-- FK forward ref en movimientos_inventario
alter table movimientos_inventario
  add constraint fk_mantencion
  foreign key (mantencion_id) references mantenciones(id) on delete set null;

-- ============================================================
-- LIQUIDACIONES DE CHOFERES
-- ============================================================
create table liquidaciones_chofer (
  id               uuid primary key default uuid_generate_v4(),
  chofer_id        uuid not null references choferes(id),
  periodo_inicio   date not null,
  periodo_fin      date not null,
  total_anticipos  numeric(12,2) default 0,
  total_bonos      numeric(12,2) default 0,
  sueldo_base      numeric(12,2) default 0,
  liquido_a_pagar  numeric(12,2) default 0,  -- sueldo_base + bonos - anticipos
  notas            text,
  created_at       timestamptz default now()
);

-- ============================================================
-- USUARIOS (auth integrado con Supabase Auth)
-- ============================================================
create table usuarios (
  id       uuid primary key references auth.users(id) on delete cascade,
  nombre   text,
  rol      text not null default 'editor' check (rol in ('admin', 'editor', 'viewer')),
  created_at timestamptz default now()
);

-- Helper functions
create or replace function mi_rol()
returns text language sql security definer stable as $$
  select rol from usuarios where id = auth.uid()
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table buses                  enable row level security;
alter table modelos_bus            enable row level security;
alter table choferes               enable row level security;
alter table categorias_item        enable row level security;
alter table items_catalogo         enable row level security;
alter table ficha_tecnica_modelo   enable row level security;
alter table ficha_tecnica_bus      enable row level security;
alter table informes_diarios       enable row level security;
alter table cierres_dia            enable row level security;
alter table movimientos_inventario enable row level security;
alter table mantenciones           enable row level security;
alter table mantencion_items       enable row level security;
alter table liquidaciones_chofer   enable row level security;
alter table usuarios               enable row level security;

-- Política de lectura: cualquier usuario autenticado puede leer todo
create policy "auth_read_all" on buses                  for select using (auth.uid() is not null);
create policy "auth_read_all" on modelos_bus            for select using (auth.uid() is not null);
create policy "auth_read_all" on choferes               for select using (auth.uid() is not null);
create policy "auth_read_all" on categorias_item        for select using (auth.uid() is not null);
create policy "auth_read_all" on items_catalogo         for select using (auth.uid() is not null);
create policy "auth_read_all" on ficha_tecnica_modelo   for select using (auth.uid() is not null);
create policy "auth_read_all" on ficha_tecnica_bus      for select using (auth.uid() is not null);
create policy "auth_read_all" on informes_diarios       for select using (auth.uid() is not null);
create policy "auth_read_all" on cierres_dia            for select using (auth.uid() is not null);
create policy "auth_read_all" on movimientos_inventario for select using (auth.uid() is not null);
create policy "auth_read_all" on mantenciones           for select using (auth.uid() is not null);
create policy "auth_read_all" on mantencion_items       for select using (auth.uid() is not null);
create policy "auth_read_all" on liquidaciones_chofer   for select using (auth.uid() is not null);
create policy "auth_read_self" on usuarios              for select using (auth.uid() = id);

-- Política de escritura: admin y editor
create policy "editor_write" on buses                  for all using (mi_rol() in ('admin', 'editor'));
create policy "editor_write" on modelos_bus            for all using (mi_rol() in ('admin', 'editor'));
create policy "editor_write" on choferes               for all using (mi_rol() in ('admin', 'editor'));
create policy "editor_write" on categorias_item        for all using (mi_rol() in ('admin', 'editor'));
create policy "editor_write" on items_catalogo         for all using (mi_rol() in ('admin', 'editor'));
create policy "editor_write" on ficha_tecnica_modelo   for all using (mi_rol() in ('admin', 'editor'));
create policy "editor_write" on ficha_tecnica_bus      for all using (mi_rol() in ('admin', 'editor'));
create policy "editor_write" on informes_diarios       for all using (mi_rol() in ('admin', 'editor'));
create policy "editor_write" on cierres_dia            for all using (mi_rol() in ('admin', 'editor'));
create policy "editor_write" on movimientos_inventario for all using (mi_rol() in ('admin', 'editor'));
create policy "editor_write" on mantenciones           for all using (mi_rol() in ('admin', 'editor'));
create policy "editor_write" on mantencion_items       for all using (mi_rol() in ('admin', 'editor'));
create policy "editor_write" on liquidaciones_chofer   for all using (mi_rol() in ('admin', 'editor'));
create policy "admin_write_usuarios" on usuarios       for all using (mi_rol() = 'admin');
