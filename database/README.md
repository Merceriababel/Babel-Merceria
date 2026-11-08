# Base de datos (PostgreSQL)

La base se aloja afuera de Vercel. Recomendado: **Neon** (gratis) o **Supabase**.

1. Creá un proyecto en https://neon.tech y copiá la cadena de conexión **pooled**.
2. Creá las tablas con **una** de estas dos opciones:
   - Pegar `schema.sql` en el editor SQL de Neon, o
   - Desde `backend/`: `alembic revision --autogenerate -m "inicial"` y luego `alembic upgrade head`.
3. Creá los dos usuarios (admin y empleado) y las categorías: ver `backend/scripts/seed.py`.

`schema.sql` impide por diseño tener más de un usuario por rol (solo admin + empleado).
