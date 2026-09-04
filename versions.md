# VentasHG — Registro de versiones

---

## v7.0 — OCR Cédula + Estado Civil en Empleados

**Fecha:** 2026-08-29 | **Commits:** en curso

---

### 1. Escanear Cédula (OCR) en formulario de Empleados

**Archivos creados:**
- `app/api/nomina/ocr-cedula/route.ts`

**Archivos modificados:**
- `lib/types.ts`
- `app/api/empleados/route.ts`
- `app/api/empleados/[id]/route.ts`
- `components/NominaClient.tsx`

**Descripción:**
Botón "📷 Escanear Cédula" en el formulario de registro/edición de empleados.
Al pulsarlo, abre el selector de archivo (cámara en móvil, galería en escritorio).
La imagen se envía al endpoint `/api/nomina/ocr-cedula` que usa Gemini (primario)
o Groq (fallback) para extraer: nombres, apellidos, cédula (formateada como `V-12345678`),
fecha de nacimiento (YYYY-MM-DD), sexo y estado civil.
Los campos del formulario se rellenan automáticamente con los datos extraídos.

**Prompt OCR:**
Específico para Cédula de Identidad venezolana (campo EDO CIVIL, prefijo V/E,
formato DD/MM/AAAA → YYYY-MM-DD, sin markdown, solo JSON).

**Cambios en base de datos:**
```sql
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS estado_civil TEXT;
```

---

### 2. Campo Estado Civil en Empleados

**Descripción:**
Se agrega el campo Estado Civil al formulario de empleados con las opciones:
SOLTERO (default), CASADO, DIVORCIADO, VIUDO.
El campo se persiste en `empleados.estado_civil` y se incluye en INSERT/UPDATE.
El SAVEPOINT fallback (para instancias sin la columna) sigue funcionando;
el valor simplemente no se guarda hasta que se aplique la migración.

**Cambios en base de datos:** ver migración arriba.

---

## Migraciones SQL — v7.0

```sql
-- MIGRACIÓN v2026-08-29 — VentasHG
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS estado_civil TEXT;
```

---

## v6.0 — Bandeja Variada en Cortesías + Empaque en Raciones

**Fecha:** 2026-08-28 | **Commits:** `3006376` → `c34d1dd`

---

### 1. Raciones de Bandeja Variada en Salidas de Cortesías

**Archivos modificados:**
- `components/SalidaCortesiasPanel.tsx`

**Descripción:**
Al seleccionar un producto de tipo `VARIADA` en el formulario de Salida de Cortesía,
aparecen los N selects de raciones (igual que en Registro de Ventas).
Cada ración muestra todos los productos `NORMAL` (con o sin stock) con indicador 📦
si tiene empaque disponible. Si se selecciona una ración con stock 0 que tiene empaque,
se muestra el modal de confirmación idéntico al del POS para abrir el empaque.
Se valida que todas las raciones estén seleccionadas antes de guardar.

**Cambios en base de datos:** ninguno.

**Cambio en payload API `POST /api/salidas-gratuitas`:**
```json
{ "productoId": "12", "cantidad": "1", "empaqueRelId": null, "variadaSelecciones": ["3","7","5"] }
```

---

### 2. Empaque en Raciones del POS (Registro de Ventas)

**Archivos modificados:**
- `components/VentasClient.tsx`

**Descripción:**
Los selects de raciones de Bandeja Variada en el POS ahora también detectan stock 0
con empaque disponible. Al seleccionar una ración así, abre el modal de confirmación.
Al confirmar, el empaque se abre inmediatamente (llamada a `/api/inventario/abrir-empaque`)
y la ración queda asignada. Al cancelar, solo limpia esa posición de ración sin afectar
el producto principal.

**Cambios en base de datos:** ninguno.

---

## Migraciones SQL — v6.0

> Ninguna. Todos los cambios son de lógica de frontend y payload de API.

---

## v5.0 — Empaque en Salidas de Cortesías + Panel Análisis Financiero IA

**Fecha:** 2026-08-27 | **Commits:** `28229d5` → `84e81fa`

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
