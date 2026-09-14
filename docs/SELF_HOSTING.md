# OVEC Mapping on mapping.utc.ac.th

This deployment runs separately from Sites on `ems.utc.ac.th`. Public standards,
source snapshots, and the precomputed matching corpus are included. This new
installation starts with empty applications and private documents; it does not
copy private records from Sites. The original Sites deployment remains available.

## Isolation and runtime

- Project directory: `/home/ems/ovec-mapping`.
- Compose project/container: `ovec-mapping` / `ovec-mapping-app`.
- Node 24 image is pinned by digest. The image contains a locally validated
  standalone build; the server does not compile the application.
- The application publishes no host port. Nginx Proxy Manager reaches its unique
  Docker network alias. Existing containers, databases, and proxy hosts are not
  recreated or modified.
- Limit: 0.75 CPU, 1 GiB RAM, 128 processes; read-only root filesystem, no Linux
  capabilities, no privilege escalation, bounded temporary storage and logs.
- `shared/mapping.sqlite`, `shared/auth.sqlite`, and `shared/documents` are the
  application's own persistent files. SQLite uses WAL, full synchronization,
  foreign keys, and transactional batches. Object keys are hashed before storage.
- Versioned SQL migrations run transactionally at startup and verify checksums.
  The public bulk snapshot is imported once; private business rows are not reset.

## Authentication

The Node gateway strips caller-supplied identity/test headers and injects an
identity only after validating its own session. Its internal vinext listener is
loopback-only. Always start `deployment/server.mjs`, **not** the generated
standalone `server.js`, which bypasses the authentication gateway.

The initial administrator is `itp@utc.ac.th`. Run once:

```sh
docker exec ovec-mapping-app node deployment/manage-user.mjs bootstrap
```

Initial credentials are written with mode 0600 to
`shared/admin-initial-access.txt`; do not commit or publish that file. The first
sign-in requires changing the password. The `/auth/accounts` page lets the active
administrator create accounts; their initial passwords are displayed once.
Assign staff roles separately in `/settings`. Login does not send email.
Sessions expire after eight hours and are invalidated by password changes.
Passwords use scrypt; login attempts are rate-limited. Auth forms require the
configured same-origin URL. Never enable `LOCAL_DEV_EMAIL` or `LOCAL_TEST_KEY`.

For a reset, pipe a new password from a secure prompt to:

```sh
docker exec -i ovec-mapping-app node deployment/manage-user.mjs reset user@example.org
```

## Build and release

```sh
npm run check
npm run build:server
npm run test:server
node deployment/package-node.mjs /tmp/ovec-mapping-release-YYYYMMDDTHHMMSSZ
COPYFILE_DISABLE=1 tar --no-xattrs -czf /tmp/ovec-mapping-release.tar.gz -C /tmp/ovec-mapping-release-YYYYMMDDTHHMMSSZ .
```

Copy the packaged directory to `releases/<release>` on the server. Build its
Dockerfile with a unique `ovec-mapping:<release>` tag, verify it in an isolated
staging container/database, then update only this project's `MAPPING_IMAGE` in
`.env` and run `docker compose up -d --no-deps app`. Record the commit and image
digest. Keep the previous image and configuration for rollback.

The dedicated Nginx file is `/data/nginx/custom/mapping.conf`, included from
`/data/nginx/custom/http.conf`. It uses the existing wildcard certificate,
redirects HTTP to HTTPS, and limits request bodies to 25 MiB. Run
`docker exec nginx-proxy-manager nginx -t` before a graceful reload. Never replace
the main Nginx configuration or the other proxy-host files.

## Backup, rollback, and validation

`deployment/backup.sh` pauses **only Mapping** while archiving its entire shared
directory, including WAL files, then immediately resumes it. Run before upgrades
and retain archives off the server through an administrator-controlled channel.
It does not remove backups or prune Docker images from other applications.

To roll back code, restore the previous `MAPPING_IMAGE` value and recreate only
`app`. Restore a database backup only when a migration requires it, after stopping
Mapping and preserving the current shared directory. Never overwrite data while
the application is running.

Validate `/api/health`, anonymous identity, certificate search, source details,
login, ownership of attachments, and persistence after restarting Mapping.
Compare status codes for `ems.utc.ac.th`, `edu.utc.ac.th`, `std.utc.ac.th` and
`std.utc.ac.th/api/health`, existing container IDs/start times, and SHA-256 hashes
of their proxy files before and after deployment. Do not create production test
applications or test documents; use disposable local/staging databases.

References: [vinext Node deployment](https://github.com/cloudflare/vinext),
[Node SQLite](https://nodejs.org/api/sqlite.html),
[Nginx Proxy Manager custom configuration](https://nginxproxymanager.com/advanced-config/).
