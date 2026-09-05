<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Vercel / Deployment

- **Production branch**: `claude/wizardly-darwin-6dpfhj` — Vercel está configurado para deployar producción desde ESTE branch, NO desde `main`.
- Los commits a `main` solo generan deployments de **Preview**, no de producción.
- Después de merges a `main`, siempre hacer: `git checkout claude/wizardly-darwin-6dpfhj && git merge origin/main --no-edit && git push -u origin claude/wizardly-darwin-6dpfhj`
- El sitio de producción es `ventas-hg.vercel.app`.

# Reglas permanentes

- DATABASE_URL y LLM_ENCRYPTION_KEY NUNCA en código — solo como variables de entorno en Vercel.
- Migraciones SQL SIEMPRE se aplican manualmente en el editor SQL de Neon — NUNCA de forma programática.
- NUNCA ejecutar acciones destructivas (DROP, TRUNCATE, force-push, reset --hard) sin confirmación explícita del usuario.
- Sidebar y home page cards deben estar sincronizados — actualizar ambos en el mismo commit.
- Siempre declarar el plan primero, el usuario aprueba, luego ejecutar.
