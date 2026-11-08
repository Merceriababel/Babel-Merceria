# Guía de mantenimiento · Babel Mercería

Esta guía explica **dónde está cada cosa** y **cómo agregar o cambiar funciones** sin romper nada.

## 1. Mapa del proyecto

```
├── vercel.json            Configuración de Vercel (servicios: public/ + backend/)
├── public/                FRONTEND: sitio estático (HTML + CSS + JS puro)
│   ├── index.html         Cáscara de la página única
│   ├── css/styles.css     Todos los estilos (paleta en las variables de arriba)
│   ├── assets/logo.png    Emblema
│   └── js/
│       ├── config.js      Dirección del backend
│       ├── ui.js          Utilidades: formato, toast, modal, piezas de HTML
│       ├── api.js         get() / post() / put() hacia el backend
│       ├── app.js         Sesión, menú y rutas
│       └── pages/         Una pantalla por archivo
├── backend/               BACKEND: API en Python (FastAPI)
│   ├── main.py            Entrada para Vercel (monta la API bajo /api)
│   ├── app/
│   │   ├── main.py        Crea la app y registra los módulos
│   │   ├── config.py      Variables de entorno
│   │   ├── db.py          Conexión a PostgreSQL
│   │   ├── models.py      Tablas (SQLAlchemy)
│   │   ├── schemas.py     Validación de lo que envía el frontend
│   │   ├── security.py    Contraseñas y tokens
│   │   ├── deps.py        Protección de rutas (login / solo admin)
│   │   ├── routers/       Un archivo por módulo (rutas de la API)
│   │   └── services/      Reglas de negocio reutilizables
│   ├── alembic/           Migraciones de la base
│   └── scripts/seed.py    Crea los dos usuarios y las categorías
└── database/schema.sql    Esquema SQL de PostgreSQL
```

## 2. Cómo viaja un pedido (ejemplo: registrar una venta)

1. El usuario toca **Confirmar venta** en `public/js/pages/venta.js`.
2. La página llama a `post('/sales', {...})` (`public/js/api.js` agrega el token de sesión).
3. En el backend, `routers/sales.py` recibe el pedido; `schemas.py` valida los datos.
4. `services/stock.py → move()` descuenta el stock y deja el registro en el historial.
5. La API responde y la página muestra el aviso con `toast()`.

## 3. Reglas que no hay que romper

- **El stock solo se cambia con `move()`** (`services/stock.py`). Así el historial siempre cuadra.
- **El stock vive en la variante (color)**, no en el producto. Un producto sin colores tiene una variante "Único".
- **El empleado nunca recibe el costo** (`precio_compra`): lo controla `services/serialize.py`.
- **Ganancia** = venta − costo congelado al momento de vender (`SaleItem.costo_unit`).
- **Datos de usuario en HTML**: siempre pasarlos por `esc()` en el frontend (evita inyección de código).
- Si cambiás `models.py`, actualizá también `database/schema.sql` o generá una migración (`alembic revision --autogenerate -m "..."`).

## 4. Recetas comunes

### Agregar un dato nuevo a los productos (ej. "marca")
1. `backend/app/models.py`: agregar la columna en `Product`.
2. `backend/app/schemas.py`: agregar el campo en `ProductIn`.
3. `backend/app/services/serialize.py`: incluirlo en `product_out`.
4. `database/schema.sql` (o migración de Alembic): agregar la columna a la tabla `products`.
5. `public/js/pages/productos.js`: sumar el campo al formulario y a la lectura (`cuerpo`).

### Agregar una pantalla nueva (ej. "Clientes")
1. Backend: crear `backend/app/routers/clientes.py` con un `router = APIRouter(...)` y registrarlo en `main.py`.
2. Frontend: crear `public/js/pages/clientes.js` con `pages.clientes = async (el) => { ... }`.
3. Cargarlo en `public/index.html` (antes de `app.js`).
4. Agregarlo a la lista `NAV` de `public/js/app.js` (tercer valor `true` = solo admin).

### Cambiar los colores
Editar las variables de la sección 1 de `public/css/styles.css` (`--brand`, `--soft`, etc.).

### Cambiar el mínimo para "Crítico"
`backend/app/services/stock.py → estado()` (hoy: 0 o ≤ 25 % del mínimo).

### Cambiar quién recibe los avisos de stock bajo
Variable de entorno `ALERT_EMAIL` en Vercel (y `SMTP_USER` / `SMTP_PASSWORD` para el envío).

## 5. Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL (Neon) |
| `SECRET_KEY` | Firma de las sesiones (larga y secreta) |
| `FRONTEND_URL` | URL pública del sitio (enlace de recuperar contraseña) |
| `SMTP_USER` / `SMTP_PASSWORD` | Gmail y su contraseña de aplicación |
| `ALERT_EMAIL` | Quién recibe los avisos de stock bajo |
| `TZ` | Zona horaria (`America/Argentina/Cordoba`) |

Después de cambiar una variable hay que hacer **Redeploy** en Vercel.

## 6. Probar en la computadora

```bash
cd backend && uvicorn app.main:app --reload      # API:  http://localhost:8000/docs
cd public  && python -m http.server 5173         # Sitio: http://localhost:5173
```
