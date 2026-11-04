# Suppression keys: storage, rotation, recovery and migration

Suppression and erasure tombstones (`AcquisitionSuppression`) store email and phone values only as **keyed hashes**: `hmac:<keyId>:<HMAC-SHA-256(key, "<kind>:<normalised value>")>`.

Before Phase 2B the hash was unsalted SHA-256. The space of Nigerian phone numbers is small enough to enumerate, so those hashes were reversible. Without the key, a keyed hash can't be reversed by enumeration. Domains are still stored in plain text as well, because the blocklist has to be shown and managed.

**This is engineering documentation, not legal advice.** Whether keyed hashes satisfy the relevant obligations is part of the LIA review.

## Configuration (server environment only; never in Git)

| Variable | Meaning |
|---|---|
| `IA_SUPPRESSION_KEY` | Current secret. **At least 32 characters**; generate with `openssl rand -base64 48` |
| `IA_SUPPRESSION_KEY_ID` | Short id for that key (`[a-z0-9]{1,16}`, default `k1`); recorded in each hash |
| `IA_SUPPRESSION_KEYS_PREVIOUS` | Comma-separated `id:secret` pairs for retired keys that must still match |
| `IA_SUPPRESSION_LEGACY_MATCH` | `true` **only during a migration window**: also matches pre-Phase-2B unsalted SHA-256 rows and upgrades each one to the current key when it is matched |

**Fails closed.** Without a valid key:
- `addSuppression` throws;
- every `/api/acquisition/*` route returns **503**;
- queue runs don't start (`blocked: 'suppression_key_missing'`).

Error messages never include key material (tested).

Tests use a fixed, test-only value set in `tests/setup.ts`. It isn't a secret and must never be used anywhere else.

## Storage

- Keep the key in the deployment's secret store (e.g. a Vercel encrypted environment variable, production scope only). Never put it in `.env*` files that are copied around, chat, tickets or logs.
- **Escrow a backup** in a separate secret store (e.g. the company password manager), with access limited to the account owner. Losing the key means suppression entries can no longer be matched (see Recovery).
- Use one key per environment. A key from local or staging must never be used in production.

## Rotation

1. Generate a new key and pick a new id (e.g. `k2`).
2. Move the old key into `IA_SUPPRESSION_KEYS_PREVIOUS` (`k1:<old secret>`), and set the new key and id as current.
3. Deploy. From then on:
   - **new** entries are written with `k2`;
   - existing `k1` entries still match, and adding a value already suppressed under `k1` doesn't create a duplicate (tested).
4. **Keep the old key in `IA_SUPPRESSION_KEYS_PREVIOUS` for as long as any entry hashed with it exists.** Email and phone values aren't stored in plain text, so `k1` rows can't be re-hashed in bulk. A row moves to `k2` only if the value is suppressed again.
5. Rotate on suspected exposure, on staff changes for people with secret access, and otherwise at a cadence you set (e.g. yearly).

## Recovery

| Situation | Effect | Response |
|---|---|---|
| Key unset / misconfigured | The module fails closed (503; queue blocked); nothing is written | Restore the variable from the secret store |
| Key **lost** (no backup) | Entries under that key can no longer be matched, so previously suppressed or erased contacts could be re-collected | Treat as an incident. Keep the module disabled; restore from escrow. If it's unrecoverable, consult counsel: affected domains (still stored in plain text) can be re-suppressed, but emails and phones cannot be reconstructed |
| Key **exposed** | Hashes become enumerable to whoever holds the key | Rotate immediately (old key moves to previous). Consider re-collecting objections through the documented channel. Record the incident |

## Migration from unsalted hashes (pre-Phase-2B)

- **Production holds no suppression rows.** The acquisition tables have never been deployed, so production starts with keyed hashes only, and `IA_SUPPRESSION_LEGACY_MATCH` must stay unset there.
- For local or rehearsal databases that hold old rows: set `IA_SUPPRESSION_LEGACY_MATCH=true` temporarily. Each legacy row is upgraded to the current key when its value is next looked up or suppressed. If an upgraded row would duplicate an existing current-key row, the legacy row is removed. Both cases are tested on real MySQL.
- Legacy rows whose values are never looked up again stay unsalted, so they should be deleted at the end of the window.
- **No schema change** is needed: `valueHash` is `VARCHAR(191)`, and `hmac:<id>:<64 hex>` is at most 89 characters.
