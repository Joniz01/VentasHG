# Historial de Versiones — VentasHG / VentasFactory

Cada versión lista los archivos modificados, archivos nuevos, migraciones SQL y variables de entorno necesarias.
Cuando una sesión de VentasFactory pregunte "¿qué debo aplicar?", leer este archivo y aplicar las versiones que aún no estén en ese repositorio.

---

## ⚠️ PENDIENTE PARA VENTASFACTORY (al 2026-07-04)

Aplicar **v1.8 + v1.9** completas. El archivo más crítico es `app/api/resumen/route.ts` — sin él el Dashboard Consolidado de ventas-hg muestra "No se pudo conectar (401)" para ventasfactory.

### Archivos a copiar/reemplazar desde ventas-hg

| Archivo | Tipo | Prioridad | Motivo |
|---------|------|-----------|--------|
| `lib/resumen.ts` | NUEVO | 🔴 CRÍTICO | Función `getResumenLocal()` requerida por /api/resumen |
| `app/api/resumen/route.ts` | REEMPLAZAR | 🔴 CRÍTICO | Sin auth; sin esto el dashboard devuelve 401 siempre |
| `lib/types.ts` | MODIFICAR | 🟡 IMPORTANTE | Agrega permiso `dashboard` a PERMISO_TABS y PERMISOS_VACIOS |
| `lib/auth.ts` | MODIFICAR | 🟡 IMPORTANTE | Lee `ve_dashboard` con fallback si migración pendiente |
| `app/api/usuarios/route.ts` | MODIFICAR | 🟡 IMPORTANTE | Incluye `ve_dashboard` en GET/POST con fallback |
| `app/api/usuarios/[id]/route.ts` | MODIFICAR | 🟡 IMPORTANTE | Incluye `ve_dashboard` en PUT con fallback |
| `app/api/dashboard/route.ts` | MODIFICAR | 🟡 IMPORTANTE | Verifica permiso `dashboard` (además de ADMIN) |
| `app/(main)/dashboard/page.tsx` | MODIFICAR | 🟡 IMPORTANTE | Usa `requirePermiso("dashboard")` |
| `components/NavTabs.tsx` | MODIFICAR | 🟡 IMPORTANTE | Tab Dashboard usa `permiso: "dashboard"` |

### Contenido exacto del archivo crítico

**`app/api/resumen/route.ts`** — reemplazar completamente con:
```typescript
import { NextResponse } from "next/server";
import { getResumenLocal } from "@/lib/resumen";

export async function GET() {
  try {
    const data = await getResumenLocal();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
```

### Migración SQL (ejecutar en Neon de ventasfactory)
```sql
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ve_dashboard BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE usuarios SET ve_dashboard = TRUE WHERE rol = 'ADMIN';
```

### Variables de entorno Vercel (ventasfactory)
- Eliminar `DASHBOARD_API_KEY` — ya no es necesaria
- `EMPRESA_NOMBRE` debe estar seteado (ej. `"Factory HG"`)

Ver detalle completo en las secciones **v1.8** y **v1.9** más abajo.

---

## v1.1 — 2026-07-04

### Resumen
- Personalización del header por instancia (nombre y color)
- Menú de perfil (logout, cambiar clave, teléfono/correo)
- Fecha en Pedidos Pendientes
- Redirección default a /ventas
- Advertencia al salir de Ventas con datos sin guardar
- Reporte limpio compartible + imagen punto de venta desde DB
- Configuración del sistema en Admin

---

### Estructura de rutas (CAMBIO IMPORTANTE)
El directorio `app/` fue reestructurado con route groups para que `/reportes/vista` tenga layout limpio (sin nav):

```
app/
  (main)/          ← todas las páginas con nav/header
    layout.tsx     ← copia del antiguo app/layout.tsx (ajustar globals.css import a ../globals.css)
    admin/page.tsx
    dashboard/page.tsx
    delivery/page.tsx
    page.tsx
    pedidos-pendientes/page.tsx
    productos/page.tsx
    reportes/page.tsx
    sin-acceso/page.tsx
    ventas/page.tsx
  (clean)/         ← páginas sin nav (layout mínimo)
    layout.tsx
    reportes/vista/
      page.tsx
      ImagenPuntoToggle.tsx
  api/             ← sin cambios en ubicación
  globals.css      ← sin cambios en ubicación
  favicon.ico
  manifest.ts
```
El antiguo `app/layout.tsx` raíz se elimina. Cada route group tiene su propio `layout.tsx` con `<html>` y `<body>`.

---

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `app/(main)/layout.tsx` | Layout principal con header/nav (era `app/layout.tsx`) |
| `app/(clean)/layout.tsx` | Layout mínimo sin nav para páginas públicas |
| `app/(clean)/reportes/vista/page.tsx` | Vista limpia del reporte (solo tarjeta resumen) |
| `app/(clean)/reportes/vista/ImagenPuntoToggle.tsx` | Toggle ◇/◆ para imagen punto de venta |
| `app/api/reportes/imagen/route.ts` | GET y POST para imagen punto de venta en DB |
| `app/api/configuracion/route.ts` | GET y PUT para tabla configuracion |
| `app/api/usuarios/perfil/route.ts` | GET y PUT para teléfono/correo del usuario |
| `components/PerfilMenu.tsx` | Menú de perfil (logout, clave, teléfono/correo) |
| `components/ConfiguracionClient.tsx` | UI de configuración en Admin (días retención imágenes) |
| `lib/getReporte.ts` | Función compartida de consulta de reporte para servidor |
| `db/migrations/017_usuario_perfil.sql` | ADD COLUMN telefono, correo a usuarios |
| `db/migrations/018_reporte_imagenes.sql` | Tabla reporte_imagenes (desde, hasta, data) |
| `db/migrations/019_configuracion.sql` | Tabla configuracion (clave, valor) |

---

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `app/(main)/layout.tsx` | Lee `EMPRESA_NOMBRE` y `EMPRESA_COLOR` del env; agrega `<PerfilMenu>`; import globals.css con ruta `../globals.css` |
| `app/(main)/page.tsx` | ADMIN redirige a `/ventas` (antes `/productos`) |
| `app/api/pedidos-pendientes/route.ts` | SELECT incluye `fecha`; fix conversión Date→string |
| `lib/types.ts` | Agrega `fecha: string` a `PedidoPendiente` |
| `components/PedidosPendientesClient.tsx` | Muestra `Fecha: DD/MM/YYYY` debajo de Hora de entrega (pendientes y entregados) |
| `components/VentasClient.tsx` | Importa `useCallback`; agrega `hayDatosIngresados()` y efecto `beforeunload` |
| `components/ReportesClient.tsx` | Botones WhatsApp + Imagen punto de venta + Copiar enlace limpio; imagen se sube a DB; ◇ aparece si existe imagen para esa fecha; función `comprimirImagen` (JPEG 75%); sin botón "Descargar imagen" |
| `components/AdminTabsClient.tsx` | Agrega tab "Configuración" con `ConfiguracionClient` |
| `proxy.ts` | Sin cambios de estructura, verificar que el matcher excluya los paths necesarios |

---

### Migraciones SQL (ejecutar en Neon en orden)

**017_usuario_perfil.sql**
```sql
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS correo TEXT;
```

**018_reporte_imagenes.sql**
```sql
DROP TABLE IF EXISTS reporte_imagenes;
CREATE TABLE reporte_imagenes (
  desde DATE NOT NULL,
  hasta DATE NOT NULL,
  data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (desde, hasta)
);
```

**019_configuracion.sql**
```sql
CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
INSERT INTO configuracion (clave, valor) VALUES ('imagen_retencion_dias', '7')
  ON CONFLICT (clave) DO NOTHING;
```

---

### Variables de entorno (agregar en Vercel)

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| `EMPRESA_NOMBRE` | `Factory HG` | Nombre que aparece en el header |
| `EMPRESA_COLOR` | `#bbf7d0` | Color de fondo del header (hex, opcional) |
| `NEXT_PUBLIC_EMPRESA_NOMBRE` | `Factory HG` | Mismo valor que EMPRESA_NOMBRE, visible en cliente (para mensaje WhatsApp) |

---

---

## v1.9 — 2026-07-04

### Resumen
- Permiso `dashboard` por usuario, controlado en Admin/Acceso al Sistema
- `/api/resumen` sin autenticación (exposición solo de métricas agregadas; sin datos sensibles)
- Fix definitivo del 401 en dashboard consolidado entre instancias con distintas bases de datos

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `db/migrations/023_ve_dashboard.sql` | Agrega columna `ve_dashboard` a usuarios; ADMIN existentes la reciben automáticamente |

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `lib/types.ts` | Agrega `{ key: "dashboard", label: "Dashboard Consolidado" }` a PERMISO_TABS y `dashboard: false` a PERMISOS_VACIOS |
| `lib/auth.ts` | Lee `COALESCE(ve_dashboard, FALSE)` en sesión |
| `app/api/usuarios/route.ts` | GET/POST incluyen `ve_dashboard`; ADMIN siempre `true` |
| `app/api/usuarios/[id]/route.ts` | PUT incluye `ve_dashboard`; ADMIN siempre `true` |
| `app/api/dashboard/route.ts` | Verifica `sesion.permisos.dashboard` (además de ADMIN) |
| `app/(main)/dashboard/page.tsx` | `requirePermiso("dashboard")` en vez de `"reportes"` |
| `components/NavTabs.tsx` | Tab Dashboard usa `permiso: "dashboard"` como los demás tabs |
| `app/api/resumen/route.ts` | Sin autenticación; solo llama `getResumenLocal()` |

### Migración SQL (ejecutar en Neon)

**023_ve_dashboard.sql**
```sql
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ve_dashboard BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE usuarios SET ve_dashboard = TRUE WHERE rol = 'ADMIN';
```

### Sin cambios de variables de entorno

---

## v1.8 — 2026-07-04

### Resumen
- Dashboard Consolidado funcional para empresa1 y empresa2 **sin coordinación manual de API keys**
- Autenticación entre instancias derivada automáticamente de `DATABASE_URL` compartida (mismo Neon)
- Colores Cashea corregidos a amarillo (color real de la marca)
- Fix crash en Admin/Configuración cuando migración Cashea no está aplicada
- Fix error "Unexpected end of JSON input" en Reportes/Cashea

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `lib/resumen.ts` | Función `getResumenLocal()` que consulta DB directamente (reutilizada por `/api/resumen` y `/api/dashboard`) |
| `lib/dashboard-token.ts` | Token compartido derivado de `DATABASE_URL` via SHA-256; igual en ambas instancias que comparten Neon |

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `app/api/dashboard/route.ts` | Empresa1: consulta DB directamente via `getResumenLocal()`; empresa2: fetch HTTP con token derivado de `DATABASE_URL` |
| `app/api/resumen/route.ts` | Acepta token derivado de `DATABASE_URL` O `DASHBOARD_API_KEY` (si seteado); usa `getResumenLocal()` |
| `components/AlarmasConfigClient.tsx` | Fix TypeScript: añade `casheaVencimientoHora` al Exclude del tipo; ícono Cashea `bg-yellow-400 text-black` |
| `components/CasheaAlerta.tsx` | Badge `bg-yellow-400 text-black` (era naranja) |
| `components/CasheaPanel.tsx` | Clases orange → yellow |
| `components/ReportesClient.tsx` | Tab Cashea con colores yellow |
| `components/ConfiguracionClient.tsx` | Fix crash: `setConfig(prev => ({ ...prev, ...d }))` + guard `?? ""` en split; sección Cashea con tema yellow |
| `app/api/reportes/cashea/route.ts` | Try/catch devuelve `{ items: [] }` si tabla no existe |
| `app/api/reportes/cashea/[id]/route.ts` | Try/catch devuelve 503 si tabla no existe |

### Variables de entorno para Dashboard

| Variable | Proyecto | Descripción |
|----------|----------|-------------|
| `EMPRESA_NOMBRE` | ambos | Nombre en el dashboard consolidado (ej. `"Hechizo Gourmet Polanco"`) |
| `EMPRESA2_URL` | ventas-hg | URL de la segunda instancia (ej. `https://ventasfactory.vercel.app`) |
| `DASHBOARD_API_KEY` | — | Ya **no es necesario**; el token se deriva automáticamente de `DATABASE_URL`. Puede eliminarse de Vercel. |

### IMPORTANTE para VentasFactory
Aplicar **todos** los archivos nuevos y modificados de esta versión, especialmente:
- `lib/dashboard-token.ts` (NUEVO — requerido para que `/api/resumen` acepte el token del dashboard)
- `lib/resumen.ts` (NUEVO)
- `app/api/resumen/route.ts` (MODIFICADO — sin esto, el dashboard sigue recibiendo 401)

### Sin migraciones SQL nuevas

---

## v1.7 — 2026-07-04

### Resumen
- Guard de navegación en Ventas restaurado y mejorado
  - Intercepta clicks en links del nav (navegación client-side de Next.js) en fase de captura
  - Cancelar → se queda en la página con los datos intactos
  - Aceptar → navega a la página solicitada
  - Sigue protegiendo cierre/recarga de pestaña con `beforeunload`
- Fixes de resiliencia: APIs Cashea y Categorías toleran migraciones pendientes

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `components/VentasClient.tsx` | Guard de navegación via `document.addEventListener('click', ..., true)` en fase de captura; usa `dirtyRef` para leer estado sin re-registrar el listener |

### Sin migraciones SQL ni variables de entorno nuevas

---

## v1.6 — 2026-07-04

### Resumen
- Productos ordenados por categoría (orden configurable en BD)
- Nuevo campo `orden` en tabla `categorias` para definir secuencia de display
- Al crear nueva categoría se puede asignar su número de orden
- Vista "por categoría" en Productos usa el orden del API en lugar de alfabético
- Orden por defecto en Productos cambiado a Categoría

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `db/migrations/022_categorias_orden.sql` | Agrega columna `orden` a `categorias`; asigna valores automáticos por nombre |

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `app/api/productos/route.ts` | ORDER BY `c.orden ASC, c.nombre, p.nombre`; fallback si migración pendiente |
| `app/api/categorias/route.ts` | GET retorna y ordena por `orden`; POST acepta y guarda `orden`; fallback si migración pendiente |
| `components/ProductosClient.tsx` | Campo de orden al crear nueva categoría; vista categoría respeta orden del API; default cambiado a "categoria" |

### Migración SQL (ejecutar en Neon)

**022_categorias_orden.sql**
```sql
ALTER TABLE categorias
  ADD COLUMN IF NOT EXISTS orden INT NOT NULL DEFAULT 99;

UPDATE categorias SET orden = 1  WHERE LOWER(nombre) LIKE '%queso%';
UPDATE categorias SET orden = 2  WHERE LOWER(nombre) LIKE '%premium%';
UPDATE categorias SET orden = 3  WHERE LOWER(nombre) LIKE '%especial%';
UPDATE categorias SET orden = 4  WHERE LOWER(nombre) LIKE '%masa%' AND LOWER(nombre) LIKE '%intervenid%';
UPDATE categorias SET orden = 5  WHERE LOWER(nombre) LIKE '%variado%' OR LOWER(nombre) LIKE '%variada%';
UPDATE categorias SET orden = 6  WHERE LOWER(nombre) LIKE '%racion%';
UPDATE categorias SET orden = 7  WHERE LOWER(nombre) LIKE '%combo%' OR LOWER(nombre) LIKE '%pack%';
UPDATE categorias SET orden = 8  WHERE LOWER(nombre) LIKE '%bebida%';
```

### Sin cambios de variables de entorno

---

## v1.5 — 2026-07-04

### Resumen
- Nueva forma de pago **Cashea** (BNPL nivel Cotidiana)
  - Selector de % de cuota inicial y cantidad de días (configurables en Admin)
  - Monto inicial auto-calculado (solo lectura); muestra monto financiado y fecha de vencimiento
  - Tabla `cashea_pagos` registra cada venta Cashea con estado de liquidación
- Pestaña **Cashea** en Reportes (con ícono naranja "C")
  - Filtros: Pendientes / Liquidados / Todos
  - Acción "Marcar liquidado / Marcar pendiente" por fila
  - Resumen de montos pendientes (inicial cobrado + financiado)
- **Alerta de Cashea** en la barra de navegación (ícono naranja "C" con contador)
  - Se activa diariamente a la hora configurada, para pagos vencidos sin liquidar
  - Silenciable por item; enlaza a la pestaña Cashea en Reportes
- Configuración Cashea en Admin/Configuración:
  - Lista de % de cuota inicial con agregar/eliminar y selector de default
  - Lista de días de financiamiento con agregar/eliminar y selector de default
- Sección de alerta Cashea en Admin/Alarmas (igual que la de Cuentas por Cobrar)

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `db/migrations/021_cashea.sql` | Tabla `cashea_pagos`; claves de configuración Cashea; índice y FK |
| `app/api/reportes/cashea/route.ts` | GET lista pagos Cashea con filtro `?estado=PENDIENTE|LIQUIDADO` |
| `app/api/reportes/cashea/[id]/route.ts` | PATCH: marcar liquidado/pendiente o silenciar alarma |
| `components/CasheaPanel.tsx` | Tabla de pagos Cashea con filtros, estado y acciones |
| `components/CasheaAlerta.tsx` | Badge naranja en nav con conteo de pagos Cashea vencidos activos |

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `lib/types.ts` | Agrega `"CASHEA"` a `METODOS_PAGO`; agrega `CasheaPagoItem`; agrega `casheaVencimientoHora` a `AlarmasConfig` |
| `lib/ventas.ts` | Agrega `casheaDatos` a `VentaBody`; INSERT en `cashea_pagos` en `insertarItemsYPagos` |
| `app/api/alarmas-config/route.ts` | GET/PUT incluyen `casheaVencimientoHora` |
| `components/VentasClient.tsx` | UI de Cashea al seleccionar esa forma de pago: selectors de % y días, montos calculados, payload con `casheaDatos` |
| `components/ConfiguracionClient.tsx` | Sección Cashea: gestión de opciones de % e días, defaults |
| `components/ReportesClient.tsx` | Pestaña Cashea con ícono naranja; renderiza `CasheaPanel` |
| `components/NavTabs.tsx` | Agrega `CasheaAlerta` junto a `CuentasPorCobrarAlerta` |
| `components/AlarmasConfigClient.tsx` | Sección "Alerta de Pagos Cashea Vencidos" con input de hora |

### Migración SQL (ejecutar en Neon)

**021_cashea.sql**
```sql
CREATE TABLE IF NOT EXISTS cashea_pagos (
  venta_id          INT PRIMARY KEY REFERENCES ventas(id) ON DELETE CASCADE,
  porcentaje        DECIMAL(5,2) NOT NULL,
  monto_inicial     DECIMAL(12,2) NOT NULL,
  monto_financiado  DECIMAL(12,2) NOT NULL,
  dias              INT NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  liquidado         BOOLEAN NOT NULL DEFAULT FALSE,
  liquidado_at      TIMESTAMPTZ,
  alarma_silenciada_hasta TIMESTAMPTZ
);
INSERT INTO configuracion (clave, valor) VALUES ('cashea_porcentajes', '40,50,60') ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('cashea_porcentaje_default', '50') ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('cashea_dias', '15,30') ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('cashea_dias_default', '15') ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('cashea_vencimiento_hora', '09:00') ON CONFLICT (clave) DO NOTHING;
```

### Sin cambios de variables de entorno

---

## v1.4 — 2026-07-04

### Resumen
- Inicialización de inventario en Admin: lleva a cero el stock de todos los productos normales activos
- Doble confirmación con checkbox antes de ejecutar el reset

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `app/api/inventario/reset/route.ts` | POST protegido (solo ADMIN): lleva stock a 0 y registra movimiento AJUSTE por producto |
| `components/InventarioInicialClient.tsx` | UI: lista stock actual, advertencia, checkbox de confirmación, botón de ejecución |

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `components/AdminTabsClient.tsx` | Import de `InventarioInicialClient`; nueva tab "Inventario Inicial" entre "Configuración" y "Acceso al Sistema" |

### Sin migraciones SQL ni variables de entorno nuevas

---

## v1.3.1 — 2026-07-04

### Resumen
- Fix: al seleccionar "Motorizado de la Empresa" como tipo de delivery, mostrar el selector de motorizados (igual que antes)
- Grid de parámetros de entrega cambiado a `sm:grid-cols-2 lg:grid-cols-4` para acomodar los 4 campos

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `components/VentasClient.tsx` | Agrega selector de motorizado condicionado a `modoEntrega === "DELIVERY" && tipoDelivery === "EMPRESA"`; ajusta grid |

### Sin migraciones SQL ni variables de entorno nuevas

---

## v1.3 — 2026-07-04

### Resumen
- Modo de entrega por defecto configurable (Local/Delivery) en Admin/Configuración
- Eliminar campo "Modalidad de entrega" de la UI de ventas (columna se mantiene en BD)
- Sub-selector de tipo de delivery: Motorizado de la Empresa, Wink, Yummy
  - Empresa: monto libre
  - Wink: precio por defecto configurable ($3), editable
  - Yummy: campo deshabilitado (sin costo)
- % de descuento en ventas (aplica al subtotal de productos, no al delivery)
  - Controlado por permiso `ve_descuento` por usuario en Admin/Acceso al Sistema
  - ADMIN tiene el permiso siempre habilitado

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `db/migrations/020_ventas_descuento_tipo_delivery.sql` | Agrega columnas ve_descuento, descuento_porcentaje, tipo_delivery + config keys |

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `lib/types.ts` | Agrega `descuento` a `PERMISO_TABS`/`PERMISOS_VACIOS`; agrega `TIPOS_DELIVERY`, `TipoDelivery`, `TIPO_DELIVERY_LABELS`; agrega `tipoDelivery` y `descuentoPorcentaje` a `Venta` |
| `lib/auth.ts` | Incluye `ve_descuento` en SELECT de sesión y mapeo de permisos |
| `lib/ventas.ts` | Agrega `tipoDelivery` y `descuentoPorcentaje` a `VentaBody` |
| `app/api/usuarios/route.ts` | GET/POST incluyen `ve_descuento`; ADMIN lo recibe `true` |
| `app/api/usuarios/[id]/route.ts` | PUT incluye `ve_descuento` |
| `app/api/ventas/route.ts` | GET y POST incluyen `tipo_delivery` y `descuento_porcentaje` |
| `app/api/ventas/[id]/route.ts` | PUT incluye `tipo_delivery` y `descuento_porcentaje` |
| `app/(main)/ventas/page.tsx` | Pasa `puedeDescuento` a VentasClient |
| `components/VentasClient.tsx` | Default modoEntrega desde config; elimina UI "Modalidad de compra"; sub-selector tipo_delivery; campo descuento si tiene permiso; totales con descuento |
| `components/ConfiguracionClient.tsx` | Agrega selectores modo_entrega_default y wink_costo_default |

### Migraciones SQL (ejecutar en Neon en orden)

**020_ventas_descuento_tipo_delivery.sql**
```sql
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ve_descuento BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS descuento_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_delivery TEXT;

INSERT INTO configuracion (clave, valor) VALUES ('modo_entrega_default', 'DELIVERY')
  ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('wink_costo_default', '3')
  ON CONFLICT (clave) DO NOTHING;
```

### Sin cambios de variables de entorno

---

## v1.2 — 2026-07-04

### Resumen
- Imagen punto de venta: ampliar al click (lightbox), botón eliminar
- Paginación con selector de cantidad en Reportes (ventas por cliente, ventas por producto), Pagos a Delivery, Productos, Ventas

### Archivos NUEVOS
| Archivo | Descripción |
|---------|-------------|
| `components/Paginador.tsx` | Componente reutilizable de paginación con selector de ítems por página |

### Archivos MODIFICADOS
| Archivo | Cambios |
|---------|---------|
| `app/api/reportes/imagen/route.ts` | Agrega método DELETE para eliminar imagen por (desde, hasta) |
| `app/(clean)/reportes/vista/ImagenPuntoToggle.tsx` | Lightbox al hacer click en la imagen |
| `components/ReportesClient.tsx` | Lightbox + botón eliminar imagen; paginación 10/15/20/25/50 en "por cliente" y "por producto" |
| `components/DeliveryPagosPanel.tsx` | Paginación 10/15/20/25/50 en la tabla de pagos |
| `components/ProductosClient.tsx` | Paginación 15/25/50/100 (default 25) en la tabla de productos |
| `components/VentasClient.tsx` | Paginación 15/25/50/100 (default 25) en la lista de ventas |

### Sin cambios de BD ni de env vars

---

## v1.0 — baseline

Estado inicial del proyecto antes del registro de versiones.
