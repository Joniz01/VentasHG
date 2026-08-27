# VentasHG — Registro de versiones

---

## v2026-08-27 — Empaque en Salidas de Cortesías + Panel Análisis Financiero IA

### Cambios incluidos en este bloque (commits `28229d5` → `1eda3b1`)

---

### 1. Empaque automático en Salidas de Cortesías

**Archivos modificados:**
- `components/SalidaCortesiasPanel.tsx`
- `app/api/salidas-gratuitas/route.ts`

**Descripción:**
Cuando se selecciona un producto sin stock en el formulario de Salida de Cortesía,
el sistema detecta si existen empaques disponibles (tabla `producto_empaques`) y
muestra un modal idéntico al del POS con el detalle del empaque, el rendimiento
y el resultado esperado en inventario.

Al confirmar, el backend abre el empaque dentro de la misma transacción de la
salida gratuita (atómica): descuenta 1 unidad del empaque, acredita las unidades
al producto, registra los movimientos de inventario con `origen = 'APERTURA_EMPAQUE'`
y luego procesa la salida normal. Si algo falla, se hace rollback completo.

**Cambios en base de datos:** ninguno — usa tablas y columnas existentes:
`producto_empaques`, `inventario_movimientos`, `salidas_gratuitas`, `salidas_gratuitas_items`.

**Campo nuevo en payload API:**
```json
{ "productoId": "5", "cantidad": "1", "empaqueRelId": 3 }
```
`empaqueRelId` es el `id` de la fila en `producto_empaques` (opcional; null = sin empaque).

---

### 2. Panel Análisis Financiero — Rentabilidad Mensual con IA

**Archivos modificados/creados:**
- `app/analisis-financiero/page.tsx` (nuevo)
- `components/AnalisisFinancieroClient.tsx` (nuevo, ~1200 líneas)
- `app/api/analisis-financiero/rentabilidad/route.ts` (nuevo)
- `app/api/analisis-financiero/ia/route.ts` (nuevo)

**Descripción:**
Panel completo de análisis financiero mensual con:
- KPIs: Ingresos, Ganancia Bruta, Gastos Op., Utilidad Neta
- Deltas vs mes anterior en cada KPI
- Gráfico de tendencia 6 meses (línea SVG)
- Tabla P&L mensual (Ingresos, COGS, Nómina, OPEX, Cortesías, Utilidad)
- Ventas por semana del mes
- Top 15 productos por rentabilidad (margen USD y %)
- Inventario valorizado (top 10 por valor)
- Sección IA colapsable con dos sub-secciones mutuamente exclusivas:
  - **Diagnósticos** (3 análisis: Rentabilidad, Caja, Eficiencia) vía LLM
  - **Asesor** (chat libre sobre el contexto financiero del mes) vía LLM

**Fuentes de datos:**
- Ingresos: `ventas` + `venta_items` (`SUM(cantidad * precio_unit)`)
- COGS: `gastos WHERE recurrente = false`
- Nómina: `nomina_pagos` + `periodos_nomina`
- OPEX: `gastos WHERE recurrente = true`
- Cortesías: `salidas_gratuitas` + `salidas_gratuitas_items`
- Inventario: `productos` + `categorias`

**Cambios en base de datos:** ninguno — lectura pura de tablas existentes.

---

### 3. Tesorería — mejoras y correcciones (commits previos)

**Archivos modificados:**
- `app/api/tesoreria/route.ts`
- `components/TesoreriaClient.tsx`

**Descripción:**
- Queries defensivas ante columnas opcionales (`numero_factura`, `tipos_gasto`)
- Acción directa para marcar pagos de nómina desde el timeline
- Semana de tesorería = semana calendario (lunes-domingo)
- Botón renombrado a "Registrar Pagado"
- Tabla responsive para móvil

**Cambios en base de datos:** ninguno.

---

## Migraciones SQL pendientes

> Todos los cambios de este bloque usan tablas ya existentes.
> No se requieren migraciones SQL para este bloque.

Las tablas que deben existir en producción para que todo funcione:

```
ventas, venta_items, gastos, nomina_pagos, periodos_nomina,
salidas_gratuitas, salidas_gratuitas_items,
producto_empaques, inventario_movimientos,
productos, categorias, empleados, usuarios
```

Si alguna de estas tablas falta, ejecutar `db/schema_completo.sql` en el editor SQL de Neon.

---

## Historial anterior

| Fecha       | Descripción                                              |
|-------------|----------------------------------------------------------|
| 2026-08-20  | Tesorería — timeline de pagos y compromisos              |
| 2026-08-15  | Delivery — pestaña separada sin filtro de sesión         |
| 2026-08-12  | Usuarios — campo teléfono en ventas                      |
| 2026-08-10  | Incrementos enteros en flechas de cantidad               |
| 2026-08-08  | Autocompletado desactivado en login de usuarios          |
