# VentasHG — Registro de versiones

---

## v2026-08-27 — Empaque en Salidas de Cortesías + Panel Análisis Financiero IA

### Commits incluidos: `28229d5` → `9485cd4`

---

### 1. Empaque automático en Salidas de Cortesías

**Archivos modificados:**
- `components/SalidaCortesiasPanel.tsx`
- `app/api/salidas-gratuitas/route.ts`

**Descripción:**
Al seleccionar un producto sin stock en el formulario de Salida de Cortesía,
el sistema detecta si hay empaques disponibles (`producto_empaques`) y muestra
un modal idéntico al del POS: nombre del empaque, stock, rendimiento y resultado
esperado en inventario.

Al confirmar, el backend abre el empaque dentro de la misma transacción:
- Decrementa 1 unidad del empaque (`productos.stock_actual -= 1`)
- Acredita `rendimiento` unidades al producto (`productos.stock_actual += rendimiento`)
- Inserta dos filas en `inventario_movimientos` con `origen = 'APERTURA_EMPAQUE'` y `usuario_id`
- Descuenta la cantidad de la salida gratuita normalmente
- Si algo falla → ROLLBACK completo

**Tablas utilizadas:**
- `producto_empaques` — columnas: `id`, `unidad_id`, `empaque_id`, `rendimiento`, `prioridad`, `activo`
- `inventario_movimientos` — columnas: `producto_id`, `tipo`, `cantidad`, `nota`, `usuario_id`, `origen`
- `salidas_gratuitas` — existente
- `salidas_gratuitas_items` — existente

**Columnas requeridas que pueden faltar en instancias antiguas:**
```sql
-- inventario_movimientos necesita:
ALTER TABLE inventario_movimientos
  ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS origen TEXT;

-- producto_empaques debe existir (ver migración abajo)

-- salidas_gratuitas_items.costo debe existir:
ALTER TABLE salidas_gratuitas_items
  ADD COLUMN IF NOT EXISTS costo NUMERIC(10,4) DEFAULT 0;
```

---

### 2. Panel Análisis Financiero — Rentabilidad Mensual con IA

**Archivos creados:**
- `app/analisis-financiero/page.tsx`
- `components/AnalisisFinancieroClient.tsx`
- `app/api/analisis-financiero/rentabilidad/route.ts`
- `app/api/analisis-financiero/ia/route.ts`

**Descripción:**
Panel de análisis financiero mensual con KPIs, tendencia 6 meses, tabla P&L,
top productos por rentabilidad, inventario valorizado y sección IA con
diagnósticos automáticos y asesor de chat libre. Requiere integración LLM
configurada (`callLLM` en `lib/llm/llm-service.ts`).

**Tablas utilizadas (solo lectura):**
- `ventas`, `venta_items` — `precio_unit`, `costo_unit`
- `gastos` — `monto_bs`, `tasa_dia`, `recurrente`, `estado`
- `nomina_pagos`, `periodos_nomina` — `salario_base_bs`, `tasa_dia`, `estado`, `pagado_at`
- `salidas_gratuitas`, `salidas_gratuitas_items` — `costo`
- `productos`, `categorias` — `stock_actual`, `costo`, `tipo_producto`
- `empleados` — `activo`

**Columnas requeridas:**
```sql
-- venta_items necesita precio_unit y costo_unit (numeric):
ALTER TABLE venta_items
  ADD COLUMN IF NOT EXISTS precio_unit NUMERIC(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_unit  NUMERIC(10,4) DEFAULT 0;

-- gastos necesita tasa_dia y recurrente:
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS tasa_dia   NUMERIC(12,4) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrente BOOLEAN DEFAULT false;

-- nomina_pagos necesita salario_base_bs y pagado_at:
ALTER TABLE nomina_pagos
  ADD COLUMN IF NOT EXISTS salario_base_bs NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pagado_at       TIMESTAMPTZ;

-- periodos_nomina necesita tasa_dia:
ALTER TABLE periodos_nomina
  ADD COLUMN IF NOT EXISTS tasa_dia NUMERIC(12,4) DEFAULT 1;

-- productos necesita tipo_producto:
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS tipo_producto TEXT DEFAULT 'NORMAL';
```

---

### 3. Tesorería — mejoras previas

**Archivos modificados:**
- `app/api/tesoreria/route.ts`
- `components/TesoreriaClient.tsx`

Queries defensivas, acción directa para nóminas, responsive móvil.
No requiere cambios de schema.

---

## Migraciones SQL — resumen completo para ejecutar en Neon

Ejecutar en orden en el editor SQL de Neon:

```sql
-- ============================================================
-- MIGRACIÓN v2026-08-27 — VentasHG
-- Ejecutar en el editor SQL de Neon (idempotente con IF NOT EXISTS)
-- ============================================================

-- 1. tabla producto_empaques (relación unidad ↔ empaque)
CREATE TABLE IF NOT EXISTS producto_empaques (
  id          SERIAL PRIMARY KEY,
  unidad_id   INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  empaque_id  INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  rendimiento NUMERIC(10,4) NOT NULL DEFAULT 1,
  prioridad   INTEGER NOT NULL DEFAULT 1,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_producto_empaques_unidad  ON producto_empaques(unidad_id);
CREATE INDEX IF NOT EXISTS idx_producto_empaques_empaque ON producto_empaques(empaque_id);

-- 2. tabla salidas_gratuitas
CREATE TABLE IF NOT EXISTS salidas_gratuitas (
  id           SERIAL PRIMARY KEY,
  tipo         TEXT NOT NULL,
  fecha        DATE NOT NULL,
  beneficiario TEXT,
  motivo       TEXT,
  usuario_id   INTEGER REFERENCES usuarios(id),
  anulada      BOOLEAN NOT NULL DEFAULT false,
  anulada_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. tabla salidas_gratuitas_items
CREATE TABLE IF NOT EXISTS salidas_gratuitas_items (
  id          SERIAL PRIMARY KEY,
  salida_id   INTEGER NOT NULL REFERENCES salidas_gratuitas(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad    NUMERIC(10,4) NOT NULL,
  costo       NUMERIC(10,4) NOT NULL DEFAULT 0
);
-- Si la tabla ya existe pero le falta la columna costo:
ALTER TABLE salidas_gratuitas_items ADD COLUMN IF NOT EXISTS costo NUMERIC(10,4) DEFAULT 0;

-- 4. columnas en inventario_movimientos
ALTER TABLE inventario_movimientos ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id);
ALTER TABLE inventario_movimientos ADD COLUMN IF NOT EXISTS origen     TEXT;

-- 5. columnas en venta_items
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS precio_unit NUMERIC(10,4) DEFAULT 0;
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS costo_unit  NUMERIC(10,4) DEFAULT 0;

-- 6. columnas en gastos
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tasa_dia   NUMERIC(12,4) DEFAULT 1;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS recurrente BOOLEAN DEFAULT false;

-- 7. columnas en nomina_pagos
ALTER TABLE nomina_pagos ADD COLUMN IF NOT EXISTS salario_base_bs NUMERIC(14,2) DEFAULT 0;
ALTER TABLE nomina_pagos ADD COLUMN IF NOT EXISTS pagado_at       TIMESTAMPTZ;

-- 8. columnas en periodos_nomina
ALTER TABLE periodos_nomina ADD COLUMN IF NOT EXISTS tasa_dia NUMERIC(12,4) DEFAULT 1;

-- 9. columna tipo_producto en productos
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tipo_producto TEXT DEFAULT 'NORMAL';
```

---

## Historial anterior

| Fecha       | Descripción                                              |
|-------------|----------------------------------------------------------|
| 2026-08-20  | Tesorería — timeline de pagos y compromisos              |
| 2026-08-15  | Delivery — pestaña separada sin filtro de sesión         |
| 2026-08-12  | Usuarios — campo teléfono en ventas                      |
| 2026-08-10  | Incrementos enteros en flechas de cantidad               |
| 2026-08-08  | Autocompletado desactivado en login de usuarios          |
