# Flujo de Migraciones de Supabase

Las migraciones nuevas deben crearse en `supabase/migrations/` con un prefijo de fecha y hora:

```text
supabase/migrations/20260807000000_descripcion.sql
```

Cada push a `master` ejecuta automáticamente:

1. `supabase db push` contra la conexión de producción.
2. El despliegue a Cloud Run solo si las migraciones terminan correctamente.

El workflow usa el secret de GitHub `DATABASE_URL_PROD`. Debe ser una conexión PostgreSQL de producción, preferiblemente mediante el connection pooler de Supabase. Nunca debe guardarse en el repositorio ni en una imagen Docker.

Los archivos SQL históricos que permanecen directamente en `supabase/` son migraciones legacy aplicadas antes de automatizar el historial. No se deben duplicar ni mover sin reconciliar primero el historial de migraciones remoto.

Para desarrollo local se puede aplicar la migración con:

```bash
supabase db push --db-url "$DATABASE_URL"
```
