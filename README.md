# PowerPlant360 V1.0

PowerPlant360 is a secure engineering knowledge assistant for authorized power-plant users.

## Production

Live site: https://rv0608.github.io/powerplant360/

The application is login-first. Supported roles are:

- **Admin** — Plant Data, Online Search, document upload/edit/delete, indexing, AI usage, backups and user management.
- **Engineer** — Plant Data and supporting-document access.
- **Viewer** — Plant Data and supporting-document access.

## Security

- Supabase Auth for login and password recovery.
- Session-only browser authentication persistence.
- Row Level Security on application data.
- Private Supabase Storage bucket for plant documents.
- Admin-only write/index/user-management operations.
- Edge Functions verify JWTs and re-check server-side roles.
- Service-role and OpenAI credentials remain server-side and are not stored in this repository.
- PWA service worker caches only the public application shell and never private Supabase/API/document responses.

## Document intelligence

- PDF page extraction.
- Office file indexing.
- Image/screenshot indexing.
- Vision indexing for weak/scanned PDF pages.
- Plant-specific scoped search.
- Supporting PDF page preview.
- Excel/CSV in-app preview.

## Backup & Recovery

Admin includes **Backup & Recovery** tools:

- Export database/index backup as JSON.
- Download private files department-by-department as ZIP archives with manifests.

See [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) for the recovery sequence.

## V1 Release Notes

See [RELEASE_NOTES_V1.0.md](RELEASE_NOTES_V1.0.md).

## Free-plan note

Supabase leaked-password screening requires a paid plan and is therefore documented as a current Free-plan limitation.
