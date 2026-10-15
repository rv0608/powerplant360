# PowerPlant360 V1.0 Backup & Recovery

## What is backed up

PowerPlant360 has three independent layers:

1. **Application code** — stored in GitHub with full commit history.
2. **Supabase database** — document metadata, extracted/indexed text, roles, and API usage.
3. **Private document storage** — original PDF, Word, Excel, CSV, TXT and image files in the private `plant-documents` bucket.

The browser publishable Supabase key is not a secret. Service-role and OpenAI keys must remain only in Supabase server-side secrets and must never be copied into GitHub or backup files.

## Recommended backup schedule

- After any major document upload/indexing session: export a database JSON backup.
- Monthly: export a database JSON backup plus department ZIP backups.
- Before a major application change: preserve a stable GitHub release/snapshot branch.
- Keep at least two copies of downloaded backups on separate storage locations.

## Admin backup procedure

1. Sign in as Admin.
2. Open **Admin → Backup & Recovery**.
3. Click **Export Database Backup**.
4. Save the JSON file securely.
5. Select each department and click **Download Department ZIP**.
6. Verify that the ZIP contains `manifest.json` and the expected private files.

Backups do not contain user passwords.

## Recovery order

### 1. Restore application code
Deploy the stable PowerPlant360 V1.0 snapshot or a known-good GitHub commit to GitHub Pages.

### 2. Restore Supabase structure and security
Recreate/verify:
- `documents`
- `user_roles`
- `api_usage`
- private `plant-documents` bucket
- RLS policies
- Edge Functions
- server-side secrets

Never disable RLS to make recovery easier.

### 3. Restore private files
Upload the files from each department ZIP back into the private `plant-documents` bucket. Preserve department/category information from each ZIP's `manifest.json`.

### 4. Restore document metadata/indexed text
Use the exported JSON's `documents` data to reconstruct metadata and extracted/indexed text. Match records to restored storage paths carefully. Do not overwrite a newer production record without checking it first.

### 5. Restore users and roles
Recreate user accounts through PowerPlant360 Admin or Supabase Auth. Assign the roles from the backup user inventory. Passwords are never backed up; users must receive/reset passwords separately.

### 6. Validate
Test:
- Admin login and Admin-only controls
- Engineer login
- Viewer login
- Plant Data search
- supporting document access
- Online Search only as Admin
- upload/index/delete only as Admin
- password recovery
- logout → login gate

## Free-plan limitation

Supabase Free does not provide the same recovery features as higher paid plans. The downloadable PowerPlant360 backups are therefore important for application-level recovery.
