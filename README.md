# VentasHG

Sistema de registro de ventas, inventario, delivery y reportes.

---

## Setup para nueva empresa

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/TU_REPO.git nueva-empresa
cd nueva-empresa
npm install
```

### 2. Base de datos (Neon)

1. Crear una nueva base de datos en [neon.tech](https://neon.tech)
2. Copiar la **Connection String** (formato `postgresql://...`)
3. En el editor SQL de Neon, ejecutar **en este orden**:
   - `db/schema_completo.sql` — crea todas las tablas (una sola vez, idempotente)
   - *(opcional)* `db/seed_productos.sql` — carga el catálogo de productos HG

### 3. Variables de entorno

```bash
cp .env.example .env.local
```

Editar `.env.local`:

```env
DATABASE_URL="postgresql://usuario:password@host/db"
EMPRESA_NOMBRE="Nombre de la empresa"
```

### 4. Crear el primer usuario ADMIN

En el editor SQL de Neon, después de correr el schema:

```sql
-- 1. Genera el hash de tu contraseña en terminal:
--    node -e "const b=require('bcrypt');b.hash('TU_CLAVE',10).then(console.log)"
-- 2. Pega el hash aquí:
INSERT INTO usuarios (nombre, usuario, clave_hash, rol,
  ve_productos, ve_ventas, ve_reportes, ve_pedidos_pendientes, activo)
VALUES (
  'Administrador', 'admin',
  '$2b$10$REEMPLAZAR_CON_HASH_REAL',
  'ADMIN', true, true, true, true, true
);
```

### 5. Desplegar en Vercel

1. Importar el repositorio en [vercel.com](https://vercel.com)
2. Agregar `DATABASE_URL` y `EMPRESA_NOMBRE` en Settings → Environment Variables
3. Deploy (Vercel detecta Next.js automáticamente)

---

## Dashboard consolidado multi-empresa

Permite ver indicadores de **N empresas** en un solo panel en `/dashboard`.

### Configurar en **cada** instancia (Vercel → Settings → Environment Variables)

| Variable | Descripción |
|---|---|
| `DASHBOARD_API_KEY` | Misma clave secreta en todas las instancias |
| `EMPRESA_NOMBRE` | Nombre de esta empresa |
| `EMPRESA2_URL` | URL de la segunda instancia (ej: `https://ventasfactory.vercel.app`) |
| `EMPRESA2_NOMBRE` | Nombre de la segunda empresa |

Generar la clave compartida:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Acceder

Ir a `/dashboard` con sesión ADMIN activa.

---

## Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Backend**: Next.js API Routes, PostgreSQL (`pg`)
- **Auth**: Sesiones en DB, cookies HTTP-only
- **Deploy**: Vercel + Neon

---

<!-- descripción original -->
Aplicación para llevar el control de productos (nombre, descripción, costo y precio
de venta) y registrar las ventas diarias (productos vendidos, costo total, total de
venta y forma de pago), pensada para desplegarse en Vercel.

## Pestañas

- **Productos**: alta, edición y baja de productos del catálogo, con su costo y
  precio de venta.
- **Ventas**: registro de cada venta con fecha, tasa del día, cliente, productos
  vendidos (con su costo y precio tomados del catálogo), forma(s) de pago
  (Punto de Venta, Transferencia, Pago Móvil, Efectivo Bs, Efectivo USD, Zelle),
  modo de entrega (Local/Delivery) y observaciones.

## Requisitos

- Node.js 18+
- Una base de datos PostgreSQL (local para desarrollo, o un proveedor compatible
  con Vercel como Vercel Postgres, Neon o Supabase para producción).

## Configuración local

1. Copia `.env.example` a `.env` y configura `DATABASE_URL`.
2. Crea las tablas ejecutando el script SQL incluido:

   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```

3. Instala dependencias y levanta el servidor de desarrollo:

   ```bash
   npm install
   npm run dev
   ```

4. Abre [http://localhost:3000](http://localhost:3000).

## Despliegue en Vercel

1. Crea una base de datos PostgreSQL (por ejemplo desde el marketplace de
   integraciones de Vercel: Postgres / Neon / Supabase).
2. Define la variable de entorno `DATABASE_URL` en el proyecto de Vercel.
3. Ejecuta `db/schema.sql` contra esa base de datos para crear las tablas.
4. Despliega el proyecto normalmente (Vercel detecta Next.js automáticamente).

## Estructura

- `db/schema.sql`: esquema de la base de datos (productos, ventas, items de
  venta y pagos).
- `lib/db.ts`: conexión a PostgreSQL (`pg`).
- `lib/types.ts`: tipos compartidos y catálogos (métodos de pago, modos de
  entrega).
- `app/api/productos`: endpoints CRUD de productos.
- `app/api/ventas`: endpoints para listar y registrar ventas.
- `app/productos`, `app/ventas`: páginas con las pestañas Productos y Ventas.
