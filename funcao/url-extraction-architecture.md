# URL → Product Extraction: Technical Architecture (current implementation)

Stack: TanStack Start v1 (React 19, Vite 7) deployed to a Cloudflare-Workers-style edge runtime, with Supabase (via Lovable Cloud) as the database. Extraction is **server-side scraping of HTML metadata**, not an external product API.

## 1. Files / functions responsible

| File | Role |
|---|---|
| `src/components/shopping/ItemDialog.tsx` | UI. On paste/blur of the Link field (and via a manual "magic wand" button) calls the server fn, shows loading state, highlights auto-filled fields, pre-selects suggested category. Uses `useServerFn(fetchProductMeta)` (line ~77). |
| `src/lib/scrape.functions.ts` | RPC boundary: `fetchProductMeta = createServerFn({ method: "POST" })` + Zod validator `{ url: string().url().max(2000) }`. Dynamically imports `./scrape.server` inside the handler and returns `{ ok, data }` (never throws to the client). |
| `src/lib/scrape.server.ts` | All extraction logic (421 lines). Exported entry: `scrapeProduct(url): Promise<ScrapedProduct>`. |
| `src/lib/shopping.ts` | Client-side helpers: `cleanUrl()` (tracking-param stripping), `mapsUrl(address, store)` (Google Maps deep link), `formatEUR()`, `itemTotal()`. |
| `src/lib/list.functions.ts` | Persistence server fns (`getList`, `saveItem`, …) writing to Supabase with the service-role client. |
| `src/components/shopping/ItemRow.tsx` | Renders photo, name, `formatEUR(itemTotal(item))`, quantity badge, product link, and the Maps pill using `mapsUrl()`. |

### Internal functions in `scrape.server.ts`
`cleanUrl(URL)`, `parseHtml(html, target)`, `fromJsonLd(html)`, `matchMeta(html, keys)`, `microdata(html, prop)`, `parsePrice(raw)`, `decodeEntities()`, `suggestCategory(text)`, `nameFromSlug(target)`, `scrapeViaReader(target)`, `isLikelyProductImage(src)`, `BROWSER_HEADERS`, `CATEGORY_KEYWORDS`.

## 2. Where extraction happens
Server-side, inside the app's own backend (TanStack `createServerFn` RPC executed in the edge worker). **No Supabase Edge Function, no browser fetch** (browser fetch would be blocked by CORS), **no paid product API**. One external helper is used only as a fallback: `https://r.jina.ai/<url>` (public reader proxy, no key).

## 3. Metadata sources used, in priority order
1. **JSON-LD / schema.org `Product`** — all `<script type="application/ld+json">` blocks parsed, `@graph` flattened, first node whose `@type` is `product`; reads `name`, `offers.price` / `offers.lowPrice` / `price`, `image` (array → first).
2. **Open Graph / Twitter / product meta tags** — `og:title`, `twitter:title`, `product:title`; `product:price:amount`, `og:price:amount`, `twitter:data1`, `price`, `product:price`; `og:image:secure_url`, `og:image`, `twitter:image`.
3. **Microdata (`itemprop=`)** — `name`, `price`, `lowPrice`, `image` (from `content=`, `src=`, or inner text).
4. **Raw HTML** — `<title>`, `<link rel="image_src">`, `itemprop="breadcrumb"` block (category hints), out-of-stock phrase regex.
5. **Reader fallback** (`r.jina.ai` markdown): `Title:` line cleaned of store suffixes (`" | Store"`, `" – Store"`, `": Amazon.es: …"`), first plausible price line, first plausible image URL filtered by `isLikelyProductImage()`.
6. **URL slug** (`nameFromSlug`) — last path segment, splits on `-`/`_`, drops ids/skus/`p|product|dp` segments, requires ≥2 words.

No per-store CSS selectors; only store-shaped text cleanups (Amazon title suffix, "no featured offers", captcha/"Just a moment" detection).

## 4. Handling different site structures
`scrapeProduct` runs a cascade:
1. `cleanUrl()` strips tracking params matching `/^(utm_|gclid|fbclid|msclkid|mc_cid|mc_eid|_ga|ref|referrer|source|igshid|srsltid|gad_|wt_|cmp|campaign)/i` and drops the hash.
2. Direct `fetch` with browser-mimicking headers (`user-agent` Chrome 126 on macOS, `accept`, `accept-language: pt-BR,pt,es,en,de`, `cache-control: no-cache`, `upgrade-insecure-requests`), `redirect: "follow"`, HTML truncated to 800 KB. Response is treated as **blocked** if body < 15 000 chars or matches `/(captcha|Enter the characters you see|Robot Check|verifica que eres|just a moment)/i`.
3. If not blocked → `parseHtml()` (layered JSON-LD → OG → microdata → raw HTML per field).
4. If blocked **or** any of name/price/image missing → `scrapeViaReader()` and field-by-field merge (direct wins, fallback fills gaps; `outOfStock` is OR'd).
5. If name still missing, or the name equals the bare hostname → `nameFromSlug()`.
6. If category still missing → `suggestCategory(name + pathname)`.
7. If name, price and image are all null → throw; the RPC catches and returns `ok: false` with empty fields so the user types manually.

## 5. Field-by-field derivation
- **name**: JSON-LD `name` → `og:title`/`twitter:title`/`product:title` → `itemprop=name` → `<title>` → reader `Title:` → URL slug. Truncated to 140 chars, HTML entities decoded.
- **price**: JSON-LD offer price → price meta tags → `itemprop=price`/`lowPrice` → reader markdown price line. `parsePrice()` strips non-`[0-9.,]`, then decides the decimal mark by the *last* separator, so `1.299,90` and `1,299.90` both yield `1299.9`. Must be finite and > 0.
- **currency**: **not extracted.** Everything is assumed EUR and formatted client-side with `Intl.NumberFormat("pt-PT", { currency: "EUR" })`.
- **image**: JSON-LD `image` → `og:image:secure_url`/`og:image`/`twitter:image` → `itemprop=image` → `<link rel="image_src">` → reader markdown image; resolved to absolute with `new URL(raw, target)`; reader candidates additionally filtered by extension and a logo/icon/sprite/banner denylist.
- **store**: **not scraped** — manual text field in `ItemDialog`.
- **address**: **not scraped** — manual text field.
- **Google Maps link**: pure client-side string build, `mapsUrl()` → `https://www.google.com/maps/search/?api=1&query=<encoded "store address">`; no Maps API, no key.
- **original URL**: the cleaned URL (client `cleanUrl` in `shopping.ts`, mirrored server-side) is stored in `link`.
- **category**: `suggestCategory()` regex keyword match over name + breadcrumbs + pathname; buckets `Beleza`, `Cuidado Pessoal`, `Casa/Limpeza`, `Alimentação`, `Eletrônicos`; null → user picks (defaults also include `Farmácia`, `Outros`).
- **outOfStock**: regex over page text (`out of stock`, `no disponible`, `indisponível`, `esgotado`, `nicht verfügbar`, `no featured offers`).

## 6. Fallbacks
Three layers as described in §4: direct HTML → `r.jina.ai` reader → URL-slug naming, with per-field merging and a final "manual entry" path. Failures never surface as exceptions to the UI.

## 7. Env vars / secrets / services required by extraction
**None.** `scrapeProduct` needs only outbound HTTP. No API keys, no Edge Functions.
Adjacent app features (not extraction) use: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, plus `SESSION_SECRET`, `SITE_USERNAME`, `SITE_PASSWORD` for the login gate (`src/lib/gate.functions.ts`, `src/lib/gate.server.ts`).

## 8. Database fields receiving the data
Table `public.shopping_items` (Postgres/Supabase): `id uuid`, `name text`, `price numeric`, `link text`, `photo text` (image URL), `category text`, `bought boolean`, `plan text` (`este_mes` | `proximo_mes`), `store text`, `address text`, `quantity integer NOT NULL DEFAULT 1`, `notes text`, `created_at`. Categories in `public.shopping_categories(name, created_at)`. Written through `saveItem` in `src/lib/list.functions.ts` using the service-role client (RLS bypassed; access is guarded by the site login gate, `assertUnlocked()`).

Note: `getList` currently selects `quantity, notes` but does not map them into the returned objects, so quantity/notes are persisted yet not re-read — worth fixing during any port.

## 9. Lovable dependence
The extraction logic is plain TypeScript with `fetch` + regex — fully portable, zero Lovable coupling. Lovable-specific pieces are only the hosting/DB provisioning: the generated `src/integrations/supabase/*` clients and the env vars injected by Lovable Cloud. After migrating, point those env vars at your own Supabase (or any Postgres) and everything keeps working. `r.jina.ai` is a third-party public service — replace with your own reader/headless-browser if you want no external dependency.

## 10. What to replicate elsewhere
1. Copy `src/lib/scrape.server.ts` verbatim (pure TS, only needs global `fetch`; Node 18+, Bun, Deno, Workers all fine).
2. Expose it over any HTTP boundary — `POST /api/scrape { url }` in Express/Fastify/Next route/Supabase Edge Function — validating the URL with Zod and returning `{ ok, data }` instead of throwing. Must be server-side: browsers cannot fetch cross-origin store HTML.
3. Copy `cleanUrl`, `mapsUrl`, `formatEUR`, `itemTotal` from `src/lib/shopping.ts`.
4. Port the dialog behaviour: debounce on paste/blur → call endpoint → loading state → fill only empty fields → highlight auto-filled ones → let the user override.
5. Recreate the `shopping_items` / `shopping_categories` schema from §8.
6. Dependencies: `zod` only (plus your framework). Optional improvement for hard anti-bot sites: a headless-browser or paid scraping API in place of `scrapeViaReader`.
7. Respect the safeguards: HTML size caps (800 KB direct / 400 KB reader), blocked-page heuristics, http(s)-only protocol check, absolute-URL resolution for images.
