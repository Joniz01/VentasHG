# Historial de Versiones — VentasHG / VentasFactory

Cada versión lista los archivos modificados, archivos nuevos, migraciones SQL y variables de entorno necesarias.
Cuando una sesión de VentasFactory pregunte "¿qué debo aplicar?", leer este archivo y aplicar las versiones que aún no estén en ese repositorio.

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

## v1.0 — baseline

Estado inicial del proyecto antes del registro de versiones.
