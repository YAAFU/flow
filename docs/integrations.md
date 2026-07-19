# Flow integrations

Flow runs in Guest mode without external credentials. Guest data is stored under `flow_state_v2` in the current browser. AI, cloud sync and Google Calendar must never be presented as connected when their configuration is missing.

## Anthropic

Set `ANTHROPIC_API_KEY` on the server. Natural-language parsing and planning call only `app/api/*` routes; the key is never included in client bundles. Without the key, `/api/parse` returns `503 ai_not_configured` and the UI reports that AI is not connected.

## Supabase

1. Create a Supabase project and run `supabase/migrations/202607190001_flow.sql`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Enable the required email providers and configure redirect URLs in Supabase Auth.
4. Keep the service-role key off the client. RLS in the migration restricts every row to `auth.uid()`.

The checked-in application remains Guest/local-first until an account adapter is connected. The settings screen labels cloud sync as not configured rather than simulating it. When adding the adapter, preserve separate guest/account stores and ask whether to merge, keep separate, or discard local data on first login.

## Google Calendar

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` on the server, then implement the OAuth callback with server-side encrypted token storage. The current build intentionally offers ICS export first and reports Google Calendar as not configured; it never creates mock events or fake connection status.

Before enabling two-way sync, add external event IDs, per-event sync state, disconnect/revoke, import preview and conflict handling. OAuth tokens must never enter exported JSON/CSV/ICS.

## PWA and notifications

`/manifest.webmanifest` and `/sw.js` provide an installable local-first shell. The service worker does not cache `/api/*`. Local task editing continues offline; AI, geocoding, routing, cloud sync and calendar network actions do not. Browser notifications require a user click and permission. Delivery is best effort and generally depends on the browser or installed PWA being active; Web Push is not claimed.
