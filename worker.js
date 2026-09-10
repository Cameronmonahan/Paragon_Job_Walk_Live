/**
 * Paragon Job Walk — Airtable proxy
 *
 * Sits between the GitHub Pages frontend and Airtable so the API token
 * never reaches the browser. Deploy on Cloudflare Workers (free tier
 * covers this volume many times over).
 *
 * Secrets to set in the Worker dashboard (Settings → Variables):
 *   AIRTABLE_TOKEN   your personal access token
 *   AIRTABLE_BASE    appHEs5U2kwT3AKzH
 *   ALLOWED_ORIGIN   https://<your-github-username>.github.io
 */

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const at = (path, init = {}) =>
      fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE}/${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
          ...(init.headers || {})
        }
      });

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...cors, "Content-Type": "application/json" }
      });

    try {
      /* ---- GET /jobs : active jobs only ---- */
      if (url.pathname === "/jobs" && request.method === "GET") {
        const filter = encodeURIComponent(
          `OR({Status}="Active",{Status}="Punch & Closeout")`
        );
        const r = await at(`Jobs?filterByFormula=${filter}`);
        return json(await r.json(), r.status);
      }

      /* ---- GET /issues?job=<Job Name> : open issues on a job ---- */
      if (url.pathname === "/issues" && request.method === "GET") {
        const jobName = url.searchParams.get("job") || "";
        // A link field resolves to its primary-field text inside a formula,
        // so match on the job name rather than the record id.
        const filter = encodeURIComponent(
          `AND({Job}="${jobName.replace(/"/g, '\\"')}",{Status}!="Verified closed")`
        );
        const r = await at(`Issues?filterByFormula=${filter}`);
        return json(await r.json(), r.status);
      }

      /* ---- PATCH /issue : update one issue's status ---- */
      if (url.pathname === "/issue" && request.method === "POST") {
        const { id, status } = await request.json();
        const r = await at(`Issues/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ fields: { Status: status }, typecast: true })
        });
        return json(await r.json(), r.status);
      }

      /* ---- POST /walk : create the walk, then its issues ---- */
      if (url.pathname === "/walk" && request.method === "POST") {
        const body = await request.json();

        const walkFields = {
          Job: [body.job],
          PM: body.pm,
          "Walk Date": new Date().toISOString().slice(0, 10),
          ...body.answers
        };
        // Airtable rejects unknown keys; strip anything empty.
        Object.keys(walkFields).forEach(k => {
          if (walkFields[k] === "" || walkFields[k] === undefined) delete walkFields[k];
        });

        const wr = await at("Walks", {
          method: "POST",
          body: JSON.stringify({ fields: walkFields, typecast: true })
        });
        const walk = await wr.json();
        if (!wr.ok) return json(walk, wr.status);

        // Issues, in batches of 10 (Airtable's create limit).
        const records = (body.issues || []).map(i => ({
          fields: {
            Issue: i.title,
            Job: [body.job],
            "Logged On Walk": [walk.id],
            Description: i.desc || "",
            "Responsible Party": i.party,
            Severity: i.severity,
            ...(i.due ? { "Promised Fix Date": i.due } : {}),
            Status: "Open"
          }
        }));

        for (let n = 0; n < records.length; n += 10) {
          await at("Issues", {
            method: "POST",
            body: JSON.stringify({ records: records.slice(n, n + 10), typecast: true })
          });
        }

        return json({ ok: true, walk: walk.id, issues: records.length });
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
};
