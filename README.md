# VentasHG

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
