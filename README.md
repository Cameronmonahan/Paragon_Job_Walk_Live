# Paragon Job Walk — setup

Two pieces: a static frontend on GitHub Pages, and a small Cloudflare Worker
that holds the Airtable token so it never reaches the browser.

**It runs on demo data out of the box.** Push `index.html` to a repo, turn on
Pages, and you have something to show. Wire up the Worker when you're ready.

---

## 1. Frontend (5 minutes)

New repo → add `index.html` → Settings → Pages → deploy from `main` branch, root.

Live at `https://<username>.github.io/<repo>/`. Open it on your phone and add it
to your home screen — it behaves like an app from there.

Demo mode shows a banner and four sample jobs. Everything is clickable.

---

## 2. Worker (10 minutes, when you want it live)

**Get an Airtable token.** airtable.com/create/tokens → create a personal access
token with scopes `data.records:read` and `data.records:write`, and access to the
Paragon base. Copy it — it's shown once.

**Deploy the Worker.** dash.cloudflare.com → Workers & Pages → Create → paste
`worker.js`. Then Settings → Variables, add three secrets:

| Name | Value |
|---|---|
| `AIRTABLE_TOKEN` | the token you just made |
| `AIRTABLE_BASE` | `appHEs5U2kwT3AKzH` |
| `ALLOWED_ORIGIN` | `https://<username>.github.io` |

**Point the frontend at it.** In `index.html`, set:

```js
const CONFIG = {
  apiBase: "https://paragon-walks.<you>.workers.dev",
  pm: "Seth"
};
```

Commit, and the demo banner disappears.

---

## 3. Per-PM builds

Each PM needs their own `pm` value so the job list filters to their jobs. Simplest
approach: three copies in the same repo — `/seth/`, `/carlos/`, `/brandon/` — each
with its `pm` set. Send each person their own link.

Slightly nicer later: read it from the URL (`?pm=Seth`) and skip the copies.

---

## Airtable changes this expects

Three field changes on the **Walks** table:

1. `Site Condition` renamed to **`Site Clean and Organized`** (Yes / No)
2. New field **`Surfaces Protected`** (Yes / No)
3. `Trades Asked` renamed to **`Talked to Trades Onsite`**

Plus `Flag Count` updated to reference the split fields — it counts sixteen
conditions now, not fourteen.

If you'd rather not change Airtable, edit the `F` map at the top of `index.html`
instead — every field name the app writes is defined in that one object.

---

## Logo

Put the vertical Paragon logo in the repo root as **`logo.png`** — exactly that
name, no double extension. It appears above the wordmark on the first two screens.
If the file isn't there, the image element removes itself and nothing breaks.

---

## What's not built yet

**Photo upload to Airtable.** Photos are captured and shown in the app, but the
Worker doesn't push them to Airtable yet — attachments need a publicly reachable
URL, so it needs an intermediate step (Cloudflare R2 or Drive). Everything else
saves.

**Closing out last week's issues.** The Worker has both halves ready — `GET /issues`
lists open issues for a job, `POST /issue` updates one's status. The screen that
shows them to the PM isn't built. This is the carry-forward loop and it's the most
important thing to add next.

**Brandon's dashboard.** Planned as a second page in this app rather than an
Airtable interface — which would mean nobody but you needs an Airtable seat.

**Client progress video.** Capture at the end of a walk, upload to object storage,
email or text the client a link. Needs R2 plus a transactional email service, and
background upload so a PM isn't stuck waiting on jobsite signal.

**Offline.** No service worker yet. A walk in a dead zone will fail on save,
though the answers stay on screen so you can retry with signal.
