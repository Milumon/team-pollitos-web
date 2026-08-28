# ADR-0010: Guía de Migración de Cuenta GCP

## Contexto

El proyecto despliega a Google Cloud Run via GitHub Actions usando Workload Identity Federation. Cuando se rota la cuenta de GCP (por ejemplo, creando un proyecto nuevo), hay que recrear toda la infraestructura IAM y actualizar las referencias en código y secrets.

## Archivos afectados

| Archivo | Qué tiene | Qué cambia |
|---------|-----------|------------|
| `.github/workflows/deploy.yml` | `PROJECT_ID` y `PROJECT_NUMBER` hardcodeados | Actualizar a los valores del nuevo proyecto |
| `.env.local` | JSON de service account `team-pollito-tts` (Google Cloud TTS) | Reemplazar con nueva SA key del proyecto nuevo |
| GitHub Secret `GOOGLE_APPLICATION_CREDENTIALS_JSON` | JSON de la SA de TTS para Cloud Run | Reemplazar con nueva SA key |

## Pasos en GCP

### 1. Seleccionar proyecto

```bash
gcloud auth login
gcloud config set project <NUEVO_PROJECT_ID>
```

### 2. Habilitar APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  texttospeech.googleapis.com \
  iamcredentials.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com
```

### 3. Service Account para deploy (CI/CD)

```bash
gcloud iam service-accounts create github-deployer \
  --display-name="GitHub Actions Deployer"

for role in roles/run.admin roles/artifactregistry.admin roles/iam.serviceAccountUser roles/storage.admin; do
  gcloud projects add-iam-policy-binding <PROJECT_ID> \
    --member="serviceAccount:github-deployer@<PROJECT_ID>.iam.gserviceaccount.com" \
    --role="$role"
done
```

### 4. Service Account para TTS (runtime)

```bash
gcloud iam service-accounts create team-pollito-tts \
  --display-name="Team Pollito TTS"

gcloud iam service-accounts keys create tts-key.json \
  --iam-account=team-pollito-tts@<PROJECT_ID>.iam.gserviceaccount.com
```

> **Nota:** La key se usa para `.env.local` (dev local) y el GitHub Secret `GOOGLE_APPLICATION_CREDENTIALS_JSON` (producción).

### 5. Workload Identity Federation

```bash
# Pool
gcloud iam workload-identity-pools create github-awards-pool \
  --location="global" \
  --display-name="GitHub Awards Pool"

# Provider
gcloud iam workload-identity-pools providers create-oidc github-awards-provider \
  --location="global" \
  --workload-identity-pool="github-awards-pool" \
  --display-name="GitHub Awards Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-condition="assertion.repository == 'Milumon/team-pollitos-web'"

# Binding
gcloud iam service-accounts add-iam-policy-binding \
  github-deployer@<PROJECT_ID>.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-awards-pool/attribute.repository/Milumon/team-pollitos-web"
```

> El `attribute_condition` con `assertion.repository` es obligatorio desde 2025. Sin él, la creación del provider falla.

### 6. Artifact Registry

```bash
gcloud artifacts repositories create team-pollito-registry \
  --repository-format=docker \
  --location=us-central1
```

## Cambios en código

### `deploy.yml`

```yaml
env:
  PROJECT_ID: <NUEVO_PROJECT_ID>
  PROJECT_NUMBER: "<NUEVO_PROJECT_NUMBER>"
```

### `.env.local`

Reemplazar `GOOGLE_APPLICATION_CREDENTIALS_JSON` con el contenido del `tts-key.json` generado.

### GitHub Secret

Actualizar `GOOGLE_APPLICATION_CREDENTIALS_JSON` en Settings → Secrets → Actions con el mismo JSON.

## Contratiempos resueltos

### gcloud CLI corrupto

**Problema:** El Python bundled del SDK de Google Cloud dejó de funcionar tras una actualización. Error: `No module named 'enum'`.

**Solución:** Reinstalar Google Cloud SDK desde https://cloud.google.com/sdk/docs/install

**Prevención:** Si se instala una versión nueva de Python del sistema (ej. 3.13), puede romper el bundled Python del SDK.

### Restricción `iam.disableServiceAccountKeyCreation`

**Problema:** Al intentar crear la key JSON de la SA de TTS, GCP rechaza con `FAILED_PRECONDITION: Key creation is not allowed`.

**Causa:** La restricción viene del nivel organización, no del proyecto. Desactivarla a nivel proyecto no tiene efecto.

**Solución:**
1. Ir a **IAM → Organization Policies** en la consola web
2. Buscar `iam.disableServiceAccountKeyCreation`
3. Desactivar el toggle (Override → Off)

**Verificar:**
```bash
gcloud resource-manager org-policies describe iam.disableServiceAccountKeyCreation --project=<PROJECT_ID>
```
Debe mostrar sin `booleanPolicy.enforced: true`.

### Rol TTS no existe a nivel proyecto

**Problema:** `roles/cloudtexttospeech.user` y `roles/texttospeech.user` no son roles válidos a nivel de proyecto.

**Solución:** No se necesita rol IAM a nivel proyecto para TTS. La SA se autentica directamente via key JSON (GOOGLE_APPLICATION_CREDENTIALS), no via roles del proyecto. Solo habilitar la API `texttospeech.googleapis.com`.

## Verificación

1. **Deploy:** Verificar que el workflow pase en GitHub Actions tras push a `master`
2. **Cloud Run:** `gcloud run services list --project=<PROJECT_ID>` → el servicio debe existir
3. **TTS:** Abrir la app → consola → enviar imagen con mensaje → verificar que el TTS lea el mensaje
4. **URL:** Acceder a la URL de Cloud Run para verificar que la app funciona
