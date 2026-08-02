# Historial de Versiones — VentasHG / VentasFactory

Cada versión lista los archivos modificados, archivos nuevos, migraciones SQL y variables de entorno necesarias.
Cuando una sesión de VentasFactory pregunte "¿qué debo aplicar?", leer este archivo y aplicar las versiones que aún no estén en ese repositorio.

---

## v3.3 — 2026-08-02

### Resumen
Módulo de Conteo Físico de Inventario completo (Fases 3 y 4): app PWA para contadores, bandeja de supervisión con alertas visuales, flujo BORRADOR → ENVIADO → APROBADO/RECHAZADO, ajuste automático de stock al aprobar y opción de compartir por WhatsApp. Página pública de inventario disponible. Atributo "Grupo" en productos (Para la Venta / Materia Prima / Servicio). Refactor de Productos: KPIs y grid siempre visibles, paginación 10/15/20/50. Campo "Nombre de Empresa" en Configuración. Correcciones de responsive en múltiples secciones.

### Archivos nuevos
| Archivo | Descripción |
|---------|-------------|
| `app/(main)/inventario/conteos/page.tsx` | Página dedicada Bandeja Conteos (permiso autorizarConteo) |
| `app/(main)/inventario/conteo-app/page.tsx` | App de conteo para contadores (autenticación propia) |
| `app/api/conteo/conteos/route.ts` | GET lista de conteos + DELETE por IDs o rango de fechas |
| `app/api/conteo/conteos/[id]/route.ts` | GET detalle + PATCH (ENVIAR / APROBAR / RECHAZAR / CORREGIR_ITEM) |
| `app/api/conteo/items/route.ts` | POST/PATCH ítems de conteo (app de contadores) |
| `app/api/conteo/pendientes/route.ts` | GET cantidad de conteos ENVIADO (badge ShellBar / sidebar) |
| `app/api/conteo/sesion/route.ts` | Login y logout para conteo_usuarios |
| `app/api/inventario/disponible/route.ts` | GET público: productos Para la Venta con stock > 0 |
| `app/(clean)/inventario-disponible/page.tsx` | Página pública de inventario disponible (sin auth) |
| `components/ConteoAlerta.tsx` | Badge sidebar con conteo de conteos pendientes (ENVIADO) |
| `components/ConteoAlertaShell.tsx` | Botón en ShellBar con badge de conteos pendientes |
| `components/BandejaConteoClient.tsx` | Bandeja de supervisión: filtros, detalle, acciones, WhatsApp |
| `components/ConteoAppClient.tsx` | Interfaz PWA de conteo para contadores |
| `components/ConteoUsuariosConfigClient.tsx` | Gestión de usuarios de conteo en Admin |
| `db/migrations/047_auditoria.sql` | Tabla `auditoria_inventario` |
| `db/migrations/048_conteo_usuarios.sql` | Tabla `conteo_usuarios` (usuarios del app de conteo) |
| `db/migrations/049_supervisor_conteo.sql` | Permiso `autorizar_conteo` en tabla `usuarios` |
| `db/migrations/050_conteo_inventario.sql` | Tablas `conteo_inventario` y `conteo_inventario_items` |
| `db/migrations/051_producto_grupo.sql` | Columna `grupo` en `productos`; semilla `nombre_empresa` en configuracion |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `components/ProductosClient.tsx` | Elimina toggle subTab; KPIs y grid siempre visibles; paginación 10/15/20/50; columna Grupo con chip de color; selector de Grupo en formulario de creación/edición |
| `components/BandejaConteoClient.tsx` | Filtro Pendientes = BORRADOR + ENVIADO; botón Eliminar borrador en detalle; estado vacío para BORRADOR sin ítems; botón Enviar al supervisor desde detalle; encabezados de columna aclarados (Físico / Ajuste); nota explicativa del cálculo; banner WhatsApp post-aprobación |
| `components/SidebarNav.tsx` | Ítem "Bandeja Conteos" con permiso autorizarConteo y badge de conteos pendientes; ítem "App Conteo" para contadores |
| `components/ShellBar.tsx` | Agrega `ConteoAlertaShell`; añade ruta `/inventario/conteos` al mapa de nombres de módulo |
| `components/ConfiguracionClient.tsx` | Campo `nombre_empresa` en sección General |
| `components/AdminTabsClient.tsx` | Tab "Usuarios Conteo" con `ConteoUsuariosConfigClient` |
| `app/api/conteo/conteos/[id]/route.ts` | Acción ENVIAR acepta sesión de supervisor (ADMIN / autorizarConteo) además de conteo_usuarios |
| `app/api/productos/route.ts` | SELECT incluye `COALESCE(p.grupo, 'PARA_LA_VENTA') AS grupo`; respuesta incluye campo `grupo` |
| `app/api/productos/[id]/route.ts` | PATCH acepta y persiste `grupo`; validación de valor permitido |
| `app/api/inventarios/kpis/route.ts` | Fix: nombre de tabla corregido de `movimientos_inventario` a `inventario_movimientos` |
| `lib/types.ts` | Agrega `GrupoProducto`, `GRUPOS_PRODUCTO`, `GRUPO_PRODUCTO_LABELS`; campo `grupo` en tipo `Producto`; permiso `autorizarConteo` |
| `lib/auth.ts` | Lee `autorizar_conteo` (con fallback) en sesión de usuario |
| `app/api/usuarios/route.ts` | GET/POST incluyen `autorizarConteo`; ADMIN recibe `true` |
| `app/api/usuarios/[id]/route.ts` | PUT incluye `autorizarConteo` |
| `app/globals.css` | Responsive para Stock & Costos (`.inv-sc-*`), Dashboard Inventario (`.inv-*`), Productos (`.prod-col-*`, `.prod-kpi-grid` 6→2 col en móvil) |

### Migraciones SQL (ejecutar en Neon SQL Editor, en orden)

**047_auditoria.sql**
```sql
CREATE TABLE IF NOT EXISTS auditoria_inventario (
  id          SERIAL PRIMARY KEY,
  tabla       TEXT NOT NULL,
  operacion   TEXT NOT NULL,
  registro_id INTEGER,
  datos       JSONB,
  usuario_id  INTEGER REFERENCES usuarios(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**048_conteo_usuarios.sql**
```sql
CREATE TABLE IF NOT EXISTS conteo_usuarios (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL,
  pin        TEXT NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**049_supervisor_conteo.sql**
```sql
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS autorizar_conteo BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE usuarios SET autorizar_conteo = TRUE WHERE rol = 'ADMIN';
```

**050_conteo_inventario.sql**
```sql
CREATE TABLE IF NOT EXISTS conteo_inventario (
  id                SERIAL PRIMARY KEY,
  conteo_usuario_id INTEGER REFERENCES conteo_usuarios(id),
  estado            TEXT NOT NULL DEFAULT 'BORRADOR',
  nota              TEXT,
  nota_supervisor   TEXT,
  aprobado_por      INTEGER REFERENCES usuarios(id),
  aprobado_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conteo_inventario_items (
  id              SERIAL PRIMARY KEY,
  conteo_id       INTEGER NOT NULL REFERENCES conteo_inventario(id) ON DELETE CASCADE,
  producto_id     INTEGER NOT NULL REFERENCES productos(id),
  stock_sistema   DECIMAL(12,4) NOT NULL,
  stock_contado   DECIMAL(12,4) NOT NULL,
  stock_corregido DECIMAL(12,4),
  corregido_por   INTEGER REFERENCES usuarios(id),
  corregido_at    TIMESTAMPTZ,
  nota            TEXT,
  UNIQUE(conteo_id, producto_id)
);
```

**051_producto_grupo.sql**
```sql
ALTER TABLE productos ADD COLUMN IF NOT EXISTS grupo VARCHAR(20) DEFAULT 'PARA_LA_VENTA';
UPDATE productos SET grupo = 'PARA_LA_VENTA'
  WHERE nombre ILIKE 'Bandeja%' OR nombre ILIKE 'Raci%' OR nombre ILIKE 'Combo%';
INSERT INTO configuracion (clave, valor) VALUES ('nombre_empresa', '')
  ON CONFLICT (clave) DO NOTHING;
```

### Notas técnicas
- Los conteos BORRADOR son visibles en el filtro Pendientes de la bandeja (junto con ENVIADO).
- El ajuste de stock al aprobar es: `stock_actual += COALESCE(stock_corregido, stock_contado) - stock_sistema`. Un producto en sistema con −1 y contado 1 produce ajuste +2 (correcto matemáticamente).
- La página `/inventario-disponible` es pública (route group `(clean)`) y muestra solo productos con `grupo = 'PARA_LA_VENTA'` y `stock_actual > 0`.
- El WhatsApp deep link usa `https://wa.me/?text=` con mensaje y enlace a `/inventario-disponible`.
- `nombre_empresa` se guarda en la tabla `configuracion` (clave/valor) existente.

### Sin nuevas variables de entorno

---

## v3.2 — 2026-07-12

### Resumen
Wizard horizontal de ventas (stepper paso a paso), ícono oficial Zelle, panel unificado de Cuentas por Cobrar (CxC Directa + Cashea + Yummy) con página propia, KPI cards, filtros de fecha/tipo y chips de conteo. Toggle de visibilidad (ojito) en todos los campos de clave del sistema.

### Archivos nuevos
| Archivo | Descripción |
|---------|-------------|
| `app/(main)/cuentas-por-cobrar/page.tsx` | Página dedicada para Cuentas por Cobrar (CxC Directa, Cashea, Yummy) |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `components/VentasClient.tsx` | Wizard horizontal: stepper de 4 pasos (Productos → Entrega → Formas de Pago → Cliente), tiles de métodos de pago en lugar de selector, panel de totales en paso de pago, ícono SVG oficial de Zelle |
| `components/CuentasPorCobrarPanel.tsx` | Panel unificado: carga CxC Directa + Cashea + Yummy en paralelo, KPI cards por tipo, chips de filtro con conteo, filtros de fecha (Desde/Hasta, Esta semana, Este mes, Limpiar), tabla normalizada |
| `components/SidebarNav.tsx` | Enlace "Cuentas por Cobrar" apunta a `/cuentas-por-cobrar` |
| `components/ReportesClient.tsx` | Elimina tabs CxC/Cashea/Yummy; solo quedan Ventas y Pagos a Delivery |
| `components/LoginClient.tsx` | Ojito en campos de clave (login + bootstrap) |
| `components/DeliveryLoginClient.tsx` | Ojito en campo de clave |
| `components/AdminAccesoClient.tsx` | Ojito en campos de clave actual, nueva y confirmación |
| `components/UsuariosConfigClient.tsx` | Ojito en campo de clave al crear/editar usuario |
| `components/MotorizadosConfigClient.tsx` | Ojito en campo de clave al crear/editar motorizado |
| `components/PerfilMenu.tsx` | Ojito en los 3 campos de cambio de contraseña |
| `app/(main)/page.tsx` | Tile "Cuentas por Cobrar" apunta a `/cuentas-por-cobrar` |
| `app/api/reportes/cuentas-por-cobrar/route.ts` | Query corregida: usa `cashea_pagos`/`yummy_pagos` para detectar tipo (ENUM no incluye CASHEA/YUMMY); incluye `costo_delivery` en total; try/catch con mensaje de error detallado |
| `app/globals.css` | Inputs heredan colores de tokens ERP |
| `lib/types.ts` | `CuentaPorCobrarItem` añade campo `tipoCxC` |

### Migraciones SQL pendientes
Ninguna — las tablas `cashea_pagos` y `yummy_pagos` ya existían (migraciones 021 y 029).

### Notas técnicas
- Cashea y Yummy tienen `cuenta_por_cobrar = FALSE` en `ventas` porque sí registran pagos. Su CxC se rastrea exclusivamente en `cashea_pagos.liquidado` y `yummy_pagos.liquidado`.
- El ENUM `metodo_pago` en PostgreSQL solo tiene: PUNTO_VENTA, TRANSFERENCIA, PAGO_MOVIL, EFECTIVO_BS, EFECTIVO_USD, ZELLE. CASHEA y YUMMY no pertenecen a ese ENUM.

---

## v3.0 — 2026-07-12

### Resumen
Layout ERP completo: shell bar fija + sidebar colapsable con 8 módulos, sistema de 3 temas de color (Corporate, Naranja & Verde, Hechizo Gourmet) cada uno con variante oscura, persistido en localStorage. Páginas placeholder para módulos futuros (Compras, MRP, Nómina). Migración 030 para categorización de productos (Para la Venta / Materia Prima).

### Archivos nuevos
| Archivo | Descripción |
|---------|-------------|
| `lib/theme-context.tsx` | ThemeProvider + useTheme hook para sistema de temas |
| `components/ShellBar.tsx` | Barra superior fija: logo, módulo activo, selector de tema, perfil |
| `components/SidebarNav.tsx` | Sidebar con 8 grupos de navegación (reemplaza NavTabs) |
| `app/(main)/compras/page.tsx` | Placeholder módulo Compras |
| `app/(main)/mrp/page.tsx` | Placeholder módulo MRP |
| `app/(main)/nomina/page.tsx` | Placeholder módulo Nómina & Gastos |
| `db/migrations/030_product_flags.sql` | Columnas `es_venta` y `es_materia_prima` en tabla `productos` |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `app/(main)/layout.tsx` | Reemplaza header+NavTabs por ShellBar+SidebarNav+ThemeProvider; content con offset para shell y sidebar |
| `app/globals.css` | Tokens CSS para 6 variantes de tema (`--erp-shell`, `--erp-primary`, `--erp-accent`, etc.) |

### Migraciones SQL pendientes (ejecutar en Neon)
- `db/migrations/030_product_flags.sql` — columnas de categorización de productos

---

## v2.5 — 2026-07-12

### Resumen
Pago Yummy (cuentas por cobrar simple), conversor USD→Bs en barra de ventas, reordenamiento y 2 líneas de chips, PWA instalable (manifest + service worker), íconos PWA desde logo real, botones de cámara y galería para imagen punto de venta, preferencias de orden de pasos por usuario.

### Archivos nuevos
| Archivo | Descripción |
|---------|-------------|
| `db/migrations/029_yummy_pagos.sql` | Tabla `yummy_pagos` + config keys `yummy_dias` y `yummy_dias_default` |
| `app/api/reportes/yummy/route.ts` | GET cuentas por cobrar Yummy (filtro estado) |
| `app/api/reportes/yummy/[id]/route.ts` | PATCH liquidar/reabrir pago Yummy |
| `components/YummyPanel.tsx` | Panel Yummy con branding verde, tabla CxC, toggle liquidado |
| `public/manifest.json` | Web App Manifest para PWA (display: standalone) |
| `public/sw.js` | Service worker con caché básico y fetch passthrough |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `lib/types.ts` | Agrega `"YUMMY"` a `METODOS_PAGO`, `METODO_PAGO_LABELS` y tipo `YummyPagoItem` |
| `lib/ventas.ts` | `VentaBody` acepta `yummyDatos`; skip YUMMY en `pagos_venta`; insert en `yummy_pagos` |
| `components/VentasClient.tsx` | Carga config Yummy (`yummy_dias`, `yummy_dias_default`); selector días cuando método=YUMMY; monto readonly; CxC Yummy en resumen; conversor USD→Bs como primer chip en barra de indicadores; chips en 2 líneas (`flex-wrap`) |
| `components/ReportesClient.tsx` | Tab Yummy; importa `YummyPanel`; botones separados 📷 Cámara y 🖼️ Galería para imagen punto de venta |
| `components/ConfiguracionClient.tsx` | Sección Yummy: opciones de días + día por defecto |
| `app/(main)/layout.tsx` | `metadata.manifest`, `metadata.icons`; registro service worker inline |
| `public/icons/icon-192.png` | Regenerado desde `logo.jpg` real (192×192) |
| `public/icons/icon-512.png` | Regenerado desde `logo.jpg` real (512×512) |
| `public/icons/maskable-512.png` | Regenerado con padding safe-zone desde `logo.jpg` |

### Migración SQL requerida
```sql
-- Ejecutar en Neon SQL Editor
CREATE TABLE IF NOT EXISTS yummy_pagos (
  venta_id        INTEGER PRIMARY KEY REFERENCES ventas(id) ON DELETE CASCADE,
  monto           DECIMAL(12,2) NOT NULL,
  dias            INTEGER NOT NULL DEFAULT 2,
  fecha_vencimiento DATE NOT NULL,
  liquidado       BOOLEAN NOT NULL DEFAULT FALSE,
  liquidado_at    TIMESTAMPTZ
);

INSERT INTO configuracion (clave, valor) VALUES
  ('yummy_dias', '2,3,4,5'),
  ('yummy_dias_default', '2')
ON CONFLICT (clave) DO NOTHING;
```

### Notas
- PWA instalable en Chrome/Edge (PC y Android). En Brave Android solo crea shortcut (limitación del navegador).
- Yummy cubre el 100% del monto de la venta como cuenta por cobrar; no se registra en `pagos_venta`.
- El conversor USD→Bs usa la tasa BCV cargada en el formulario en tiempo real.

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

## v2.4 — 2026-07-08

### Resumen
- **Inventarios — 6 KPIs**: al entrar a Inventarios se muestran 6 indicadores: Productos en Stock, Valor del Inventario (USD), Productos sin Stock, Unidades Totales, Entradas del Mes (USD), Movimientos del Mes
- **Botón pill toggle**: "Movimientos de Inventario" (mismo estilo que Productos) — al pulsar los KPIs se contraen y aparece el grid; volver a pulsar regresa a KPIs
- **KPIs se refrescan** automáticamente tras registrar un movimiento de inventario
- **Nueva ruta API**: `GET /api/inventarios/kpis` — consulta los 6 KPIs en una sola query SQL

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `app/api/inventarios/kpis/route.ts` | GET — consulta los 6 KPIs de inventario en una query |

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `components/InventariosClient.tsx` | Agrega 6 KPI cards, estado `showGrid`, botón pill toggle, refresco de KPIs tras movimiento |

### Sin migraciones SQL nuevas
### Sin nuevas variables de entorno

---

## v2.3 — 2026-07-08

### Resumen
- **Tab Productos — 6 KPIs**: al entrar a Productos se muestran 6 indicadores: Productos Activos, Valor del Inventario (USD), Sin Stock, Unidades Vendidas Hoy, Producto Más Vendido, Margen Bruto Promedio
- **Sub-tabs pill**: botones "Crear Producto" y "Productos Creados" estilo pill (igual a Ventas) ubicados encima de los KPIs
- **Comportamiento toggle**: por defecto solo se ven los KPIs; al pulsar un botón los KPIs se contraen y aparece el contenido; volver a pulsar el botón activo regresa a la vista de KPIs
- **Botón renombrado**: "Agregar producto" → "Crear Producto"
- **Tab principal Inventarios**: nueva ruta `/inventarios` al mismo nivel que Productos/Ventas, con su propio componente `InventariosClient` que carga los datos de forma independiente
- **Nueva ruta API**: `GET /api/productos/kpis` — consulta los 6 KPIs en una sola query SQL

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `app/api/productos/kpis/route.ts` | GET — consulta los 6 KPIs de productos en una query |
| `app/(main)/inventarios/page.tsx` | Página de la nueva tab Inventarios |
| `components/InventariosClient.tsx` | Componente cliente de Inventarios (carga `/api/productos` de forma autónoma) |

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `components/ProductosClient.tsx` | 6 KPI cards; sub-tabs pill toggle; orden: botones → KPIs → contenido; ningún sub-tab activo por defecto |
| `components/NavTabs.tsx` | Agrega tab `Inventarios` entre Productos y Ventas (permiso: `productos`) |

### Sin migraciones SQL nuevas
### Sin nuevas variables de entorno

---

## v2.2 — 2026-07-08

### Resumen
- **Paso 1 mobile layout**: filas de producto apiladas verticalmente (igual que Paso 3) para mejor usabilidad en móvil
- **Historial → Editar**: al pulsar "Editar" cambia al tab Registro de Ventas y muestra banner ámbar "✏️ Editando venta #X" con botón Cancelar
- **Indicadores como chips horizontales**: chips Hoy / BCV / CxC en una sola línea (overflow-x scroll)
- **Cashea — forma de pago de la inicial**: selector dentro de la tarjeta amarilla Cashea para elegir el método de pago de la cuota inicial (excluye CASHEA)
- **Cashea — resumen de pago**: "Total pagado" muestra solo la cuota inicial; línea "CxC Cashea" muestra el monto financiado en amarillo
- **Fix enum**: excluir CASHEA del INSERT en `pagos_venta` (no es valor del enum `metodo_pago` de la BD)
- **Historial — chip Cashea**: columna Cobro muestra chip con logo Cashea y monto pendiente + botón "Marcar Pagada" con panel tasa+Bs inline
- **Reportes/Cashea — Marcar pagado**: panel de confirmación inline con tasa del día, montos en Bs y botón Confirmar
- **Fix Reportes/Cashea**: ruta GET usaba columna inexistente `v.tasa_del_dia`; corregido a `v.tasa_dia AS tasa_del_dia`
- **Columna "Pago inicial"** en tabla Reportes/Cashea mostrando el método de pago de la inicial

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `db/migrations/026_cashea_metodo_inicial.sql` | `ALTER TABLE cashea_pagos ADD COLUMN IF NOT EXISTS metodo_inicial TEXT;` |

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `components/VentasClient.tsx` | Paso 1 mobile cards; switch-to-tab al editar; banner ámbar edición; chips indicadores; selector metodoInicial en Cashea; resumen Total pagado + CxC Cashea; historial chip Cashea + Marcar Pagada inline |
| `components/CasheaPanel.tsx` | Panel confirmación inline para Marcar pagado; columna Pago inicial; colSpan 10 |
| `lib/types.ts` | `CasheaPagoItem`: añade `tasaDelDia`, `metodoInicial`; `Venta.casheaDatos`: añade `metodoInicial` |
| `lib/ventas.ts` | INSERT `cashea_pagos` incluye `metodo_inicial`; skip CASHEA en loop de `pagos_venta` |
| `app/api/ventas/route.ts` | Query `casheaResult` con fallback; mapea `casheaDatos` por venta |
| `app/api/ventas/[id]/route.ts` | DELETE `cashea_pagos` antes de reinsertar al editar; logging detallado de errores pg |
| `app/api/reportes/cashea/route.ts` | Corrige columna a `v.tasa_dia`; mapea `tasaDelDia` y `metodoInicial`; logging de errores |

### Migración SQL

Ejecutar en Neon (manualmente vía SQL editor):

```sql
ALTER TABLE cashea_pagos ADD COLUMN IF NOT EXISTS metodo_inicial TEXT;
```

### Sin nuevas variables de entorno

---

## v2.1 — 2026-07-07

### Resumen
- Botón "Probar" individual por API key en el panel LLM
- Ojo (show/hide) en el campo API key al agregar nueva key
- Modo edición inline por key: etiqueta, nueva key (opcional, con ojo), límite de tokens
- PATCH `/api/admin/llm/keys/[id]` acepta `api_key` para actualizar y re-encriptar la key
- Mensajes de error detallados del proveedor (antes solo mostraba código HTTP)
- Modelos actualizados: Gemini `gemini-2.0-flash`, Groq `llama-3.1-8b-instant`

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `app/api/admin/llm/test/[id]/route.ts` | POST prueba una key específica por ID (descifra, llama al proveedor, loguea) |

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `app/api/admin/llm/keys/[id]/route.ts` | PATCH ahora acepta `api_key` → re-encripta y guarda |
| `components/LLMAdminPanel.tsx` | Ojo en form agregar; botón Probar por fila con resultado inline; modo edición por fila con ojo en key |
| `lib/llm/llm-config.ts` | Default Gemini → `gemini-2.0-flash`; Default Groq → `llama-3.1-8b-instant` |

### Sin migraciones SQL nuevas

### Variables opcionales actualizadas

| Variable | Default actualizado | Descripción |
|----------|---------------------|-------------|
| `GEMINI_MODEL` | `gemini-2.0-flash` | Modelo Gemini (antes `gemini-1.5-flash`) |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Modelo Groq (antes `llama3-8b-8192`) |

---

## v2.0 — 2026-07-04

### Resumen
- Módulo LLM con soporte Gemini (principal) + Groq (failback automático)
- Keys encriptadas en DB con AES-256-CBC
- Failback automático ante errores 429/5xx/timeout; errores 400 no hacen failback
- Cuota diaria por key con autoreset
- Log de uso completo (tokens, latencia, proveedor, estado)
- Panel de administración en Admin → pestaña "IA / LLM"
- Si la migración no está aplicada, el panel muestra aviso en lugar de crashear

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `db/migrations/024_llm.sql` | Tablas `llm_api_keys` y `llm_usage_log` |
| `lib/llm/llm-config.ts` | Encriptación AES-256-CBC, timeouts, modelos default, códigos failback |
| `lib/llm/llm-service.ts` | `callLLM()` — punto de entrada único con failback Gemini→Groq |
| `lib/llm/key-manager.ts` | `getActiveKey()` con rotación entre múltiples keys; `incrementQuotaUsed()` |
| `lib/llm/usage-logger.ts` | `logUsage()` + `getUsageSummary()` con validación SQL injection |
| `lib/llm/providers/gemini.ts` | Cliente fetch Gemini con timeout via AbortController |
| `lib/llm/providers/groq.ts` | Cliente fetch Groq con timeout y try/catch para log de error |
| `app/api/admin/llm/keys/route.ts` | GET lista / POST crear key (solo ADMIN) |
| `app/api/admin/llm/keys/[id]/route.ts` | PATCH activar/editar / DELETE (solo ADMIN) |
| `app/api/admin/llm/keys/[id]/reset-quota/route.ts` | POST reset manual de cuota (solo ADMIN) |
| `app/api/admin/llm/usage/route.ts` | GET resumen de uso por día/proveedor (solo ADMIN) |
| `app/api/admin/llm/test/route.ts` | POST prueba de conexión global desde Admin (solo ADMIN) |
| `components/LLMAdminPanel.tsx` | Panel de gestión: keys, test, tabla de uso |

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `components/AdminTabsClient.tsx` | Nueva pestaña "IA / LLM" con `LLMAdminPanel` |

### Migración SQL (ejecutar en Neon)

**024_llm.sql** — ver archivo completo en `db/migrations/`

### Variable de entorno requerida

| Variable | Descripción |
|----------|-------------|
| `LLM_ENCRYPTION_KEY` | Exactamente 32 caracteres; encripta las API keys en DB. Sin esto el endpoint no acepta keys nuevas. |

### Variables opcionales

| Variable | Default | Descripción |
|----------|---------|-------------|
| `GEMINI_MODEL` | `gemini-2.0-flash` | Modelo Gemini a usar |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Modelo Groq a usar |
| `GEMINI_TIMEOUT_MS` | `15000` | Timeout Gemini en ms |
| `GROQ_TIMEOUT_MS` | `10000` | Timeout Groq en ms |

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
