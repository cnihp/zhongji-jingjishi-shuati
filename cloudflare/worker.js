const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

function corsHeaders(env) {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
}

function json(data, status = 200, env = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...jsonHeaders, ...corsHeaders(env) },
  });
}

function validateUser(user) {
  if (typeof user !== "string") return "";
  return user.trim().slice(0, 64);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true }, 200, env);
    }

    if (url.pathname !== "/state") {
      return json({ ok: false, error: "Not found" }, 404, env);
    }

    if (request.method === "GET") {
      const user = validateUser(url.searchParams.get("user"));
      if (!user) return json({ ok: false, error: "Missing user" }, 400, env);

      const row = await env.DB.prepare(
        "SELECT state_json, updated_at FROM quiz_states WHERE user_key = ?"
      ).bind(user).first();

      if (!row) return json({ ok: true, state: null, updatedAt: null }, 200, env);

      return json({
        ok: true,
        state: JSON.parse(row.state_json),
        updatedAt: row.updated_at,
      }, 200, env);
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const user = validateUser(body && body.user);
      const state = body && body.state;

      if (!user) return json({ ok: false, error: "Missing user" }, 400, env);
      if (!state || typeof state !== "object") {
        return json({ ok: false, error: "Missing state" }, 400, env);
      }

      const stateJson = JSON.stringify(state);
      if (stateJson.length > 1024 * 1024) {
        return json({ ok: false, error: "State too large" }, 413, env);
      }

      await env.DB.prepare(
        `INSERT INTO quiz_states (user_key, state_json, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(user_key) DO UPDATE SET
           state_json = excluded.state_json,
           updated_at = excluded.updated_at`
      ).bind(user, stateJson).run();

      return json({ ok: true }, 200, env);
    }

    return json({ ok: false, error: "Method not allowed" }, 405, env);
  },
};
