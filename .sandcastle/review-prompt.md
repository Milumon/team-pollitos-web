# Tarea

Revisa la implementación del issue #{{TASK_ID}} (`{{ISSUE_TITLE}}`) en `{{BRANCH}}` como un agente independiente.

# Proceso

1. Lee el issue con `gh issue view {{TASK_ID}} --repo Milumon/team-pollitos-web --comments`, su PRD padre, ADR 0013, `CONTEXT.md`, `AGENTS.md` y `.sandcastle/CODING_STANDARDS.md`.
2. Ejecuta `git status --short`, `git log {{TARGET_BRANCH}}..{{BRANCH}} --oneline`, `git diff --stat {{TARGET_BRANCH}}...{{BRANCH}}` y `git diff --ignore-space-at-eol --stat {{TARGET_BRANCH}}...{{BRANCH}}`. Incorpora cambios sin commit que pertenezcan al issue. Si el primer stat contiene churn de finales de línea, ejecuta `git add --renormalize .` y crea un commit correctivo antes de continuar.
3. Inspecciona el diff real con `git diff {{TARGET_BRANCH}}...{{BRANCH}}`; no intentes incluirlo completo en otro prompt o argumento de proceso.
4. Busca primero regresiones, incumplimientos del issue, fallos de autorización, redirects inseguros, pérdida de estado navegable y pruebas ausentes.
5. Verifica que no se hayan traducido contratos `/api/**` o `/overlay`, ni cambiado reglas de negocio fuera del slice.
6. Corrige en la rama todos los hallazgos confirmados y añade o ajusta pruebas.
7. Ejecuta pruebas relevantes, `pnpm exec tsc --noEmit` y lint focalizado. NUNCA ejecutes un build.
8. Si modificas código, crea un commit convencional sin atribución de IA.

No hagas push, no abras PR y no cierres el issue. Si el issue no está realmente completo, falla de forma explícita en vez de aprobar por cortesía.

Cuando la rama esté lista para revisión humana, emite `<promise>COMPLETE</promise>`.
