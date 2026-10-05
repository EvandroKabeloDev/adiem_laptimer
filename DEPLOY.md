# GitHub + EasyPanel

1. Create an empty GitHub repository named `lapwiz-live-timing`.
2. Push this project to `main`.
3. In Supabase SQL Editor, enable Realtime for `public.rt004_laps`:
```sql
alter publication supabase_realtime add table public.rt004_laps;
```
4. In EasyPanel create an App from the GitHub repository.
5. Builder: Dockerfile. Build path: `/`. Dockerfile: `Dockerfile`.
6. Container port: `3000`.
7. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not commit `.env.local` and never expose a service-role key in the browser.

Current laboratory tables have RLS disabled. Before public production, enable RLS and create appropriate policies.

The RT004 acquisition process remains separate from this web container. During MVP it continues to run on the notebook:
RT004 → BLE → Python → Supabase → Next.js.

Future production:
RT004 → ESP32 → MQTT → VPS/backend → Supabase → Next.js.
