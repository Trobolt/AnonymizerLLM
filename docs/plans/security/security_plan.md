# Feature: Security — Encrypted Database and Encrypted Connection

Two threats are in scope:
1. **Files on disk** — the SQLite database is readable as plain text by anyone with filesystem access.
2. **Network traffic** — the connection between the browser and the Python backend is unencrypted plain HTTP.

The local machine itself is considered trusted. This feature is split into 2 sub-features that are independent of each other and can be implemented in any order.

---

## Sub-feature 1: Database Encryption at Rest

**Why:**
The SQLite file (`chats.db`) is stored on disk unencrypted. Anyone who can read the file — backup software, another user account, or someone who gets hold of the machine — can open it and read the full chat history. Encrypting the file with SQLCipher means the data is unreadable without the key, even if the file is copied.

**What:**

**Driver swap:** Replace `aiosqlite` with `sqlcipher3` (SQLCipher 4 bindings for Python). SQLCipher is a drop-in replacement for SQLite that transparently encrypts the entire database file with AES-256. The SQL API is identical; the only addition is a `PRAGMA key` call immediately after opening the connection.

**Key management:** The encryption key is stored in the OS keychain via the `keyring` library — not hardcoded, not written to a file, not in an environment variable.

| OS | Keychain backend |
|----|-----------------|
| Windows | Windows Credential Manager (DPAPI-protected) |
| macOS | Keychain |
| Linux | libsecret / KWallet |

Key lifecycle:
```
connect() called →
  key = keyring.get_password("BewerbungsBot", "db_key")
  if key is None:
      key = secrets.token_hex(32)   # 256-bit, generated once on first launch
      keyring.set_password("BewerbungsBot", "db_key", key)
  run PRAGMA key = '<key>' on the open connection
```

**`backend/db/sqlite.py` changes** (builds on the adapter from the database plan):
```python
import keyring, secrets

class SQLiteAdapter(DatabaseAdapter):
    async def connect(self):
        key = keyring.get_password("BewerbungsBot", "db_key")
        if key is None:
            key = secrets.token_hex(32)
            keyring.set_password("BewerbungsBot", "db_key", key)
        self._conn = await sqlcipher3.connect(self._path)
        await self._conn.execute(f"PRAGMA key = '{key}'")
        # ... rest of connect logic unchanged
```

**Migration path:** If a plain (unencrypted) database already exists on disk, it must be converted on first launch. SQLCipher provides a built-in export command for this:
```sql
-- run while the plain database is open
ATTACH DATABASE 'chats_encrypted.db' AS encrypted KEY '<key>';
SELECT sqlcipher_export('encrypted');
DETACH DATABASE encrypted;
-- then replace chats.db with chats_encrypted.db
```
On startup: try to open the existing file with the key. If SQLCipher raises an error (file is not yet encrypted), run the export migration and replace the original. If no file exists yet, SQLCipher creates a new encrypted file immediately.

**Key files:**
- `backend/db/sqlite.py` — swap driver, add key retrieval, add `PRAGMA key`, add first-run migration
- `backend/requirements.txt` — add `sqlcipher3`, `keyring`
- `backend/pyinstaller.spec` — add `sqlcipher3`, `keyring` and platform backends as hidden imports; bundle the SQLCipher DLL on Windows

**Missing / open questions:**
- **`sqlcipher3` wheel on Windows**: Requires a SQLCipher-enabled `sqlite3.dll`. The PyPI wheel bundles it, but verify a pre-built wheel exists for the exact Python version in use (`python --version`). If not, building from source requires OpenSSL headers.
- **Linux keyring on a headless server**: `keyring` fails silently or errors without a secret-service provider (no GUI session). For the server deployment using PostgreSQL, database encryption is handled at the infrastructure level — keyring is only needed for the SQLite path. Gate the keyring call behind a check for `SQLiteAdapter`.
- **Key loss = data loss**: If the OS keychain is wiped (OS reinstall, account deletion), the encrypted database is permanently unrecoverable. This should be documented prominently. A user-facing key export/backup belongs in a later sub-feature.
- **In-memory databases for tests**: `sqlcipher3` supports `:memory:` — run `PRAGMA key` immediately after connect in test setup, before any queries.

**Acceptance criteria:**
- [ ] `chats.db` on disk contains no readable text (verify with a hex editor)
- [ ] Encryption key is stored in the OS keychain — not in any file or environment variable
- [ ] Key is generated once on first launch and reused on all subsequent launches
- [ ] An existing plain database is migrated automatically on first launch
- [ ] In-memory SQLite (`:memory:`) still works in tests with the key applied
- [ ] PostgreSQL adapter is untouched — no keyring calls in `postgresql.py`

**Out of scope:**
- PostgreSQL encryption (handled at infrastructure level)
- User-facing key backup / export
- Per-chat encryption (full-file encryption is sufficient)
- Encrypting the FTS search index (planned separately)

**How to test:**
1. Create a plain SQLite database, populate it with a chat, run the migration → open the resulting file in a hex editor and confirm no readable text.
2. Call `connect()` twice with the same keychain entry → data is accessible both times (key round-trips through the keychain correctly).
3. Call `connect()` with a wrong key → SQLCipher raises an error (confirms the file is genuinely encrypted).
4. Delete the keychain entry, call `connect()` → a new key is generated and a fresh database is created.

Run all tests from the database plan against the encrypted adapter — they should pass unchanged.

---

## Sub-feature 2: HTTPS via Reverse Proxy (Caddy)

**Why:**
The browser communicates with the Python backend over plain HTTP. The full request and response — chat content, messages — travel as readable text. Whether the app is accessed via localhost today or a public server later, encrypting this channel with HTTPS protects the data in transit and is required for any production deployment.

Python itself is not responsible for TLS. A reverse proxy (Caddy) sits in front of Python, handles all certificate management, and forwards decrypted requests to the backend. Python stays unchanged.

**What:**

**Architecture:**
```
Firefox
  |  HTTPS (encrypted, port 443)
  ↓
Caddy  ← terminates TLS, holds the certificate, speaks HTTPS to the browser
  |  HTTP (plain text, port 8000, localhost only)
  ↓
Python / uvicorn  ← your FastAPI app, no TLS changes needed
```

**Why Caddy:** Caddy automatically obtains, installs, and renews Let's Encrypt certificates with zero manual steps. It also enables HTTP/3 (QUIC) automatically — QUIC merges the TCP and TLS handshakes into a single round trip, so the browser connects faster. Firefox supports HTTP/3 and will use it automatically when Caddy advertises it. No config is required for any of this.

**Production (`Caddyfile`):**
```
bewerbungsbot.example.com {
    reverse_proxy 127.0.0.1:8000
}
```
That single block gives you: HTTPS on port 443, automatic Let's Encrypt certificate, automatic renewal, HTTP → HTTPS redirect, HTTP/2, and HTTP/3 over QUIC.

**Local development (`Caddyfile` with `tls internal`):**
Let's Encrypt cannot issue certificates for `localhost` (it cannot reach your machine to verify ownership). Caddy handles this with `tls internal`: it runs a local CA, issues a cert from it, and installs that CA into your OS trust store automatically. Firefox then trusts it without any warnings.
```
localhost {
    tls internal
    reverse_proxy 127.0.0.1:8000
}
```
When moving to a real server, delete `tls internal` — Caddy switches to Let's Encrypt automatically.

**Python backend hardening:**
Bind uvicorn to `127.0.0.1` only so the backend is unreachable directly from outside the machine — all traffic must go through Caddy:
```python
uvicorn.run(app, host="127.0.0.1", port=8000)
```

**CORS:**
In production the browser origin is a real domain, not `localhost:3000`. Make the allowed origins configurable via an environment variable:
```python
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001"
).split(",")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, ...)
```

**Key files:**
- `deploy/Caddyfile` *(new)* — reverse-proxy config, two variants documented (localhost + production)
- `backend/main.py` — change `host` to `127.0.0.1`; read `ALLOWED_ORIGINS` from env
- `backend/requirements.txt` — no new Python dependencies
- `deploy/docker-compose.yml` *(new, optional)* — Caddy + Python services wired together for server deployment

**Missing / open questions:**
- **ACME challenge port**: Let's Encrypt needs port 80 reachable for the HTTP-01 challenge to issue a certificate. If a firewall or hosting provider blocks port 80, use the DNS-01 challenge instead (requires a Caddy DNS provider plugin for your DNS host). Note this in the deployment README.
- **`tls internal` and Firefox on Windows**: On Windows, Caddy's `tls internal` installs its CA into the Windows trust store. Firefox by default uses its own trust store, not Windows'. Go to `about:config` and set `security.enterprise_roots.enabled = true` to make Firefox trust the Windows store. Document this step.
- **CORS and the real domain**: `ALLOWED_ORIGINS` must be set at deploy time to the actual frontend domain. If left at the default `localhost` value in production, the browser will block all cross-origin requests.
- **Rate limiting**: On a public server, there is no rate limit on requests. Caddy has a rate-limit plugin; this is out of scope but worth noting for later.

**Acceptance criteria:**
- [ ] Firefox accesses the app via `https://` with no certificate warning (both on localhost with `tls internal` and on a real domain)
- [ ] Python backend is bound to `127.0.0.1` and not reachable directly from outside the machine
- [ ] `Caddyfile` documents both the localhost dev variant and the production variant
- [ ] `ALLOWED_ORIGINS` is read from an environment variable (not hardcoded)
- [ ] HTTP requests to port 443 are upgraded to HTTPS by Caddy automatically
- [ ] Firefox DevTools → Network tab shows `h3` (HTTP/3 over QUIC) for requests after the first load

**Out of scope:**
- mTLS (client certificates)
- OAuth / user login (separate feature)
- WAF / DDoS protection
- Multi-region or load-balanced deployments
- Rate limiting

**How to test:**
1. Start Python on `127.0.0.1:8000`. Run `caddy run` with the `tls internal` Caddyfile. Open Firefox at `https://localhost` → no cert warning, app loads over HTTPS.
2. Open Firefox DevTools → Network tab. After the first request, subsequent requests should show `h3` in the protocol column (HTTP/3 / QUIC).
3. Try to reach `http://127.0.0.1:8000` directly from a different machine on the network → connection refused (backend not exposed).
4. Set `ALLOWED_ORIGINS=https://otherdomain.com` and send a request with `Origin: https://wrong.com` → CORS header missing from response.
