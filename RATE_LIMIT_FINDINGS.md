# Rule34 429 / rate-limit behavior – findings & low-risk optimizations

Date: 2026-01-08

## Goal
Reduce the frequency and “burstiness” of traffic that triggers Rule34 429s, while preserving existing UX and behavior (same features, same results; mainly pacing + coordination changes).

## What exists today (current behavior)

### 1) Background download queue rate-limit backoff
File: `extension/background.js`

- Downloads are initiated via `browser.downloads.download(...)`.
- Normal (non-429) failures use per-item exponential retry via `retryDownload()` (attempt-based exponential backoff using `initialRetryDelay`).
- “Rate limit” failures are detected heuristically in the download interrupt handler:
  - `errorMsg.includes('429')` OR `errorMsg` contains “rate” OR “too many requests”.
- When rate-limited, downloads are moved into a global paused list (`rateLimitState.pausedDownloads`).
- A global backoff is triggered with fixed delays: 10s, 20s, 30s (capped at 30s), escalating via `backoffLevel`.
- After backoff ends, the system runs **one “test download”**; if it succeeds, it resumes the paused downloads gradually with a fixed `STAGGER_DELAY = 300ms`.

Observations:
- This is already a decent “coordinated backoff” pattern: pause globally, test once, then resume gradually.
- The fixed 10/20/30s steps may be too aggressive or too short when Rule34’s limiter is “odd” (sometimes requiring longer cool-down). It also lacks jitter.
- Download API errors don’t provide HTTP headers, so there’s no easy way to respect `Retry-After` for media downloads.

### 2) Content-side HTML fetch coordinated backoff
File: `extension/modules/download-handler.js`

- HTML fetching for downloads (e.g., “download from thumbnail”) uses `fetchWithCoordinatedBackoff(postUrl)`.
- Similar global backoff exists for HTML fetches:
  - Fixed delays: 10s, 20s, 30s
  - Uses one “test fetch” after backoff, then resumes pending fetches with `STAGGER_DELAY = 300ms`.
- Unlike the download queue, this path can inspect the HTTP response and status.

Observations:
- This is good, but it currently **does not throttle concurrency** before a 429 happens. Many `fetch()` calls can be in-flight at once.
- `activeFetches` and `pendingDownloads` are used for stats, not to enforce concurrency.
- `Retry-After` is not used.

## Main sources of avoidable traffic / 429 risk

### A) Many `fetch(postUrl)` calls bypass coordinated backoff
Several modules do direct `fetch(postUrl)` without going through `fetchWithCoordinatedBackoff()`:

- `extension/modules/video-loader.js`
  - Fallback behavior: fetches the post page (`fetch(postUrl)`) to extract the video URL.
  - Video URL construction also performs many `HEAD` probes across domains/extensions.

- `extension/modules/image-quality.js`
  - `loadFullResInThumbnail()` fetches the post page directly.
  - `processMaxQualityUpgrade()` fetches post pages directly and is likely called in bulk.

Impact:
- When features like “force load max quality” or video embedding run across many thumbnails, they can create a burst of parallel post-page fetches that bypass the backoff queue.
- Even if the download-handler’s backoff is working well for downloads, these bypasses can still trip the limiter and make the overall experience feel inconsistent.

### B) Batch queue pacing is very tight
File: `extension/background.js`

- `processBatchQueue()` sends a `fetchAndDownload` message and then schedules the next item after 100ms.

Impact:
- This can trigger many content-side post fetches rapidly.
- If the content-side fetch wrapper does not enforce a concurrency limit, the initial burst can be large.

### C) Resume pacing is fixed and synchronized
Both backoff systems resume work using a fixed `STAGGER_DELAY = 300ms`.

Impact:
- Fixed intervals can “synchronize” retries/resumes across events/tabs.
- A little jitter often helps avoid synchronized bursts.

## Low-risk changes that preserve behavior
These focus on pacing and coordination, not changing which resources are fetched or how filenames/metadata are derived.

### 1) Route all post-page fetches through the same coordinated backoff
**Recommendation:** Introduce a shared fetch wrapper for Rule34 HTML post pages, and ensure all modules that fetch post pages use it.

Minimal approach:
- Export `fetchWithCoordinatedBackoff()` (or a new `fetchRule34Html()` wrapper) on `window.R34Tools` and reuse it in `video-loader.js` and `image-quality.js`.
- Keep the same parse/extract logic; only swap the raw `fetch(postUrl)` call.

Why it’s safe:
- It preserves the same URLs, same response parsing, same user-visible behavior.
- It only changes timing and adds backoff coordination.

### 2) Add a simple concurrency cap for post-page HTML fetches
**Recommendation:** In `download-handler.js`, enforce something like:

- `MAX_CONCURRENT_HTML_FETCHES = 2` (or 1 for maximum safety)
- If at capacity, queue the request and start it when an in-flight fetch completes.

Why it’s safe:
- Does not change results; only spreads the work out.
- Particularly effective for “download whole page” and bulk operations.

### 3) Deduplicate in-flight fetches by URL
**Recommendation:** Use a `Map<url, Promise<Response>>` (or Promise for `{text, doc}`) so multiple callers requesting the same `postUrl` share a single network request.

Why it’s safe:
- If the same post is requested multiple times (e.g., multiple features need the same HTML), this reduces duplicate traffic while keeping the same data.

Caveat:
- `Response` bodies are single-consume; dedupe should usually be at the `text()` level (cache `Promise<string>`), or clone the response when safe.

### 4) Respect `Retry-After` for HTML fetch backoff
When `response.status === 429`, check:

- `response.headers.get('Retry-After')`

If it’s present:
- If it’s a number of seconds, use `max(currentDelay, seconds*1000)`.
- If it’s a HTTP date, compute the delta.

Why it’s safe:
- Only affects timing when the server explicitly requests it.

### 5) Add jitter to backoff and resume pacing
Add small randomized jitter (e.g., ±15–25%) to:

- the 10/20/30s backoff delay
- the per-item resume stagger (300ms)

Why it’s safe:
- Keeps the overall pacing similar, but reduces “thundering herd” alignment.

### 6) Make rate-limit detection more strict in the download queue
Current download-side detection treats any error containing “rate” as a rate-limit.

Recommendation:
- Prefer checking for known error codes/strings, and only fall back to substring checks.
- Keep existing behavior as fallback, but reduce false positives.

Why it’s safe:
- False positives currently cause unnecessary pauses (slower than needed).
- Less false pausing tends to improve perceived speed without increasing traffic.

## Medium-risk / optional ideas (still likely worth it)
These may slightly change performance characteristics or internal behavior.

### C) Prefer Rule34 DAPI when an API key is configured (with safe fallback)
Rule34 provides a classic DAPI endpoint on `https://api.rule34.xxx/` that supports `user_id` and `api_key` parameters.

Why this can be more efficient:
- Many extension flows currently fetch the full HTML post page (`page=post&s=view&id=...`) and then parse it to extract a small amount of data.
- For those cases, fetching JSON from DAPI can reduce bandwidth and parsing cost, and may also behave better under rate limiting (especially if a user has a key).

Important constraints / unknowns:
- Rule34 does not publish a fixed numeric limit for keys; they explicitly state limits can change and that higher/unlimited keys may be granted for large public projects.
- A key should not be assumed to eliminate 429s; the same backoff/concurrency protections still matter.

Suggested approach (preserves current behavior):
- Add optional settings fields: `rule34UserId` and `rule34ApiKey`.
- Implement a single “post metadata fetch” function (e.g. `fetchPostMetadata(postId)` or `fetchPostById(postId)`):
  - If `rule34UserId` + `rule34ApiKey` are present, try DAPI JSON first.
  - If DAPI fails (network error, non-OK, 429, parse error, unexpected payload), fall back to the current HTML fetch+parse path.
  - Keep outputs identical to what downstream code expects (same media URL selection rules, same filename rules, etc.).

Concrete endpoints worth using:
- **Get a post by id** (JSON):
  - `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&id=<POST_ID>&json=1&user_id=<USER_ID>&api_key=<API_KEY>`
- **Search posts by tags** (JSON):
  - `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&tags=<TAGS>&pid=<PAGE>&limit=<N>&json=1&user_id=<USER_ID>&api_key=<API_KEY>`
    - Note: docs indicate a hard per-request limit of 1000.

Where this helps most in this codebase:
- Any logic that currently does `fetch(postUrl)` to obtain HTML and parse out media URLs/metadata:
  - `extension/modules/download-handler.js` (thumbnail download flow)
  - `extension/modules/video-loader.js` (fallback fetch of post page)
  - `extension/modules/image-quality.js` (bulk quality upgrade flows)

Settings UX notes:
- Add 2 inputs to the extension options page (`extension/options.html` + `extension/options.js`) to allow entering `user_id` and `api_key`.
- Store them in `browser.storage.local` alongside existing settings.
- Keep the key optional and default behavior unchanged when absent.

Rate-limit handling notes:
- DAPI should still use the same traffic shaping strategy as HTML: concurrency cap, in-flight dedupe, and backoff (including `Retry-After` if it appears on API responses).
- Avoid sending the key to content scripts unless necessary; prefer having whichever component makes the API request read the key directly from `browser.storage.local`.

### A) Unify a single “global rate limit” across HTML fetches + downloads
Today there are two independent backoff loops:

- background downloads (`background.js`)
- content-side post fetches (`download-handler.js`)

If Rule34 rate-limits are shared across resources, a 429 in either path could pause both.

Risk:
- Might make the extension “pause more broadly” than it does today.

### B) Reduce HEAD probing for video URL construction
`video-loader.js` may attempt multiple HEAD requests across many CDNs/extensions.

Possible improvements:
- Cache successful domain/extension combos per session.
- Stop probing after N attempts and fall back to post-page HTML (but that’s still a fetch).

Risk:
- This can change how quickly videos are found, depending on site behavior.

## Suggested implementation order (safest first)
1. Deduplicate in-flight post-page fetches by URL.
2. Add a concurrency cap for post-page fetches.
3. Ensure all modules’ post-page fetches go through the coordinated wrapper.
4. Add `Retry-After` handling for HTML fetch backoff.
5. Add jitter to resume/backoff.
6. (Optional) Prefer DAPI for metadata when key present, with HTML fallback.

## Notes / expectation management
- Rule34’s rate limiting can be inconsistent. Even with perfect backoff, occasional 429s can happen.
- The most effective strategy is usually to avoid big bursts (concurrency cap + dedupe), then respect server hints (`Retry-After`), and finally add jitter.
