# VentasHG — Documento de Arquitectura y Contexto del Proyecto

## Descripción General

**VentasHG** es un ERP web completo para **Hechizo Gourmet Polanco**, una empresa venezolana del sector gastronómico. El sistema gestiona ventas, inventario, compras, nómina, tesorería, gastos y finanzas. Está construido en **Next.js** (App Router) con **PostgreSQL (Neon)** como base de datos y desplegado en **Vercel**.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js (App Router) — leer `node_modules/next/dist/docs/` antes de escribir código |
| Base de datos | PostgreSQL en Neon (serverless) |
| ORM / DB client | `pg` (pool directo) vía `@/lib/db` |
| Autenticación | Sesiones propias — `getSesionFromRequest()` en `@/lib/auth` |
| Deploy | Vercel |
| Estilo | CSS-in-JS inline (React `style` props) con variables CSS ERP (`--erp-*`) |
| Lenguaje | TypeScript |

---

## Reglas Permanentes (INVIOLABLES)

1. **`DATABASE_URL` y `LLM_ENCRYPTION_KEY` NUNCA en código** — solo como variables de entorno en Vercel.
2. **Migraciones SQL SIEMPRE se aplican manualmente en el editor SQL de Neon** — NUNCA de forma programática desde la app.
3. **NUNCA ejecutar acciones destructivas** (DROP, TRUNCATE, force-push, reset --hard) sin confirmación explícita del usuario.
4. **Sidebar y home page cards deben estar sincronizados** — actualizar ambos en el mismo commit.
5. **Siempre declarar el plan primero, el usuario aprueba, luego ejecutar.**

---

## Deployment

- **Rama de producción**: `claude/wizardly-darwin-6dpfhj` — Vercel despliega producción desde ESTE branch.
- **`main`** solo genera deployments de **Preview**, no de producción.
- Después de merges a `main`: `git checkout claude/wizardly-darwin-6dpfhj && git merge origin/main --no-edit && git push -u origin claude/wizardly-darwin-6dpfhj`
- **URL producción**: `ventas-hg.vercel.app`

---

## Arquitectura de Módulos

### Módulos existentes (rutas)

| Ruta | Módulo |
|------|--------|
| `/dashboard` | Dashboard principal |
| `/ventas` | Punto de venta + historial |
| `/compras` | Facturas de compra, recepciones, proveedores |
| `/inventarios` | Inventario, conteos, MRP |
| `/gastos` | Gastos operativos + Configuración de servicios recurrentes |
| `/cuentas-por-pagar` | Panel consolidado CxP |
| `/tesoreria` | Planificación de Pagos (flujo de caja) |
| `/nomina` | Nómina de empleados |
| `/reportes` | Reportes generales |
| `/analisis-financiero` | P&L y análisis IA |
| `/clientes` | CRM básico |
| `/admin` | Administración de usuarios y configuración |

---

## Arquitectura AP (Accounts Payable)

El módulo financiero sigue el patrón ERP estándar (SAP B1 / Odoo / QuickBooks):

### Gastos (`/gastos`)
- **Tab Ocasionales**: Registro de gastos operativos únicos. Tabla `gastos`.
- **Tab Recurrentes**: Configuración de servicios recurrentes (CORPOELEC, alquiler, etc.). Tabla `cuentas_pagar WHERE recurrente=true`.

### Cuentas por Pagar (`/cuentas-por-pagar`)
Panel consolidado de obligaciones de pago. Tabla principal: `cuentas_pagar`.

**Secciones:**
- 🔧 **Servicios Recurrentes**: `recurrente=true` (alquiler, servicios, etc.)
- 📋 **Gastos Ocasionales**: `recurrente=false AND tipo='gasto'`
- 🛒 **Compras a Crédito**: `tipo='compra'` — sincronizadas automáticamente desde tabla `compras`

**Sync automático de compras**: En cada GET de `/api/cuentas-pagar`, se ejecuta `syncCompras()` que inserta en `cuentas_pagar` las compras activas que no tienen registro previo (dedup por `numero_factura`).

**Estados operativos** (vista de trabajo, no historial):
- `PENDIENTE` — "Por Pagar" (default al cargar)
- `PENDIENTE_PARCIAL` — con abono parcial
- `PAGADO` / `ANULADO` — solo historial, no aparecen en vista principal

---

## Arquitectura de Tesorería

`/api/tesoreria/planificacion` actúa como **agregador** que une en tiempo real:

| Prefijo ID | Fuente | Tipo |
|-----------|--------|------|
| `N{id}` | `periodos_nomina` + `nomina_pagos` | `"nomina"` (período real) |
| `NE{id}_{date}` | `nominas` + proyección automática | `"nomina"` (estimado) |
| `G{id}` | `gastos` + `tipos_gasto` | `"gasto"` / `"gasto-fijo"` |
| `CP{id}` | `cuentas_pagar` | `"proveedor"` |
| `COMP{id}` | `compras` + `compra_items` | `"compra"` |

**Nómina NO pasa por `cuentas_pagar`** — tiene su propio flujo paralelo directo a tablas de nómina.

---

## Tablas Principales de Base de Datos

| Tabla | Propósito |
|-------|-----------|
| `cuentas_pagar` | Obligaciones con proveedores (servicios, compras, gastos) |
| `cuentas_pagar_historial` | Historial de pagos/abonos de CxP |
| `compras` | Facturas de compra (estado: `ACTIVA`) |
| `compra_items` | Líneas de factura de compra |
| `gastos` | Gastos operativos |
| `tipos_gasto` | Categorías de gastos |
| `nominas` | Definiciones de nómina |
| `periodos_nomina` | Períodos de pago generados |
| `nomina_pagos` | Pagos individuales por empleado por período |
| `nomina_incidencias` | Bonos/deducciones por pago |
| `empleados` | Empleados con `salario_base_usd` |
| `empleado_nominas` | Relación empleado-nómina |
| `proveedores` | Catálogo de proveedores |
| `productos` | Catálogo de productos |
| `inventario_movimientos` | Movimientos de inventario |
| `ventas` / `venta_items` | Ventas y sus líneas |
| `tasas_bcv_historico` | Historial de tasas BCV (Bs/$) |
| `usuarios` / `sesiones` | Auth |
| `configuracion` / `app_config` | Config global del sistema |

### Columna `tipo` en `cuentas_pagar`
Agregada en esta sesión. Valores: `'gasto'` (default) o `'compra'`. Permite distinguir compras migradas/sincronizadas de gastos manuales.

---

## Patrones de Código

### API Routes
```typescript
// Siempre validar sesión primero
const sesion = await getSesionFromRequest(request);
if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

// Permisos admin para escritura
if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) { ... }
```

### Componentes Client
- Todos los componentes interactivos son `"use client"`
- Estilo con variables CSS: `var(--erp-text)`, `var(--erp-text-2)`, `var(--erp-text-3)`, `var(--erp-bg)`, `var(--erp-surface)`, `var(--erp-border)`
- Paginación server-side en APIs (`page`, `pageSize`)
- Filtros en URL params del API

### Convenciones visuales
- **Tabla estilo inventario**: headers small-caps uppercase 11px, padding celdas `7px 14px`, zebra striping (`#ffffff` / `#f9fafb`)
- **Chips/filtros**: `borderRadius: 99`, activo con color sólido o fondo tenue
- **Pills de estado**: `borderRadius: 99`, colores semánticos definidos en `ESTADO_STYLE`
- **Panel de filtros**: card con `border`, 2 filas compactas (Sección+buscador / Estado+Vencimiento)
- **Badges de frecuencia**: fondo azul tenue `rgba(37,99,235,0.10)`, 9-10px, uppercase

### React.Fragment con key
Cuando se usan fragmentos dentro de `.map()` con section headers:
```tsx
<React.Fragment key={cp.id}>
  {showSeccion && <tr><td colSpan={N}>...</td></tr>}
  <tr>...</tr>
</React.Fragment>
```
**Nunca usar `<>` shorthand** con `key` prop.

---

## Flujo de Git

```bash
# Desarrollo siempre en:
git checkout claude/wizardly-darwin-6dpfhj

# Push
git push -u origin claude/wizardly-darwin-6dpfhj

# Formato de commits
git commit -m "feat(módulo): descripción corta

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Fk6eFfeMZMLhHq3QuejTeN"
```

---

## Estado Actual del Módulo CxP (última sesión)

### Implementado
- ✅ Rediseño visual tabla estilo inventario (6 columnas)
- ✅ Zebra striping en filas
- ✅ Panel de filtros compacto (2 filas: Sección+buscador / Estado+Vencimiento)
- ✅ Chips de sección: 🔧 Servicios · 📋 Ocasionales · 🛒 Compras (color verde activo)
- ✅ Filtros de fecha: Esta semana / Próx. semana / Rango desde-hasta
- ✅ Vista operativa: solo "Por Pagar" y "Pend. Parcial" (sin Todos/Pagado)
- ✅ Sync automático de compras desde tabla `compras` en cada GET
- ✅ Sección 🛒 Compras a Crédito separada de Gastos Ocasionales
- ✅ Totales pendientes en header (Bs y USD)
- ✅ Columna `tipo` en `cuentas_pagar` (SQL aplicado en Neon)
- ✅ Migración manual de 5 compras existentes con saldo pendiente

### Pendiente / Futuro
- ⬜ Historial de pagados (tab o página separada de auditoría)
- ⬜ Notificaciones/alertas de vencimiento próximo
- ⬜ Reporte exportable de CxP

---

## Instrucciones para el Agente Ejecutor

1. **Leer este documento completo** antes de cada sesión de trabajo.
2. **Nunca ejecutar sin plan aprobado** — siempre declarar el plan, esperar aprobación.
3. **SQL siempre manual en Neon** — proporcionar el script, el usuario lo ejecuta.
4. **Branch de trabajo**: `claude/wizardly-darwin-6dpfhj` — nunca pushear a `main`.
5. **Verificar build** (`npx tsc --noEmit && npm run build`) antes de cada commit.
6. **PR existente**: `Joniz01/VentasHG#6` — los commits van al mismo PR abierto.
7. Los componentes de UI usan variables CSS `--erp-*`, no hardcodear colores base del tema.
8. Antes de modificar cualquier archivo grande, leerlo completo o la sección relevante.
