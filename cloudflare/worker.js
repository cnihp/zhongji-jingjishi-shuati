const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

const validTabs = new Set(["practice", "exam", "chapter", "wrong"]);
const validFilters = new Set(["all", "single", "multi"]);

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

function validateQuestionId(questionId) {
  if (typeof questionId !== "string" && typeof questionId !== "number") return "";
  return String(questionId).trim().slice(0, 128);
}

function validateText(value, fallback) {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, 200) || fallback;
}

function validateAnswer(answer) {
  if (!answer || typeof answer !== "object" || !Array.isArray(answer.selected)) return null;
  const selected = [...new Set(answer.selected)]
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 20)
    .slice(0, 20);
  return {
    selected,
    submitted: answer.submitted === true,
    isCorrect: answer.isCorrect === true,
  };
}

function validateProgress(progress) {
  const value = progress && typeof progress === "object" ? progress : {};
  const currentIndex = Number.isInteger(value.currentIndex) && value.currentIndex >= 0
    ? Math.min(value.currentIndex, 100000)
    : 0;
  return {
    currentIndex,
    currentQuestionId: validateQuestionId(value.currentQuestionId) || null,
    currentTab: validTabs.has(value.currentTab) ? value.currentTab : "practice",
    currentFilter: validFilters.has(value.currentFilter) ? value.currentFilter : "all",
    currentChapter: validateText(value.currentChapter, "all"),
    currentSection: validateText(value.currentSection, "all"),
  };
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1024 * 1024) return null;
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
}

function progressStatement(db, user, progress) {
  return db.prepare(
    `INSERT INTO quiz_progress (
       user_key, current_index, current_question_id, current_tab,
       current_filter, current_chapter, current_section, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_key) DO UPDATE SET
       current_index = excluded.current_index,
       current_question_id = excluded.current_question_id,
       current_tab = excluded.current_tab,
       current_filter = excluded.current_filter,
       current_chapter = excluded.current_chapter,
       current_section = excluded.current_section,
       updated_at = excluded.updated_at`
  ).bind(
    user,
    progress.currentIndex,
    progress.currentQuestionId,
    progress.currentTab,
    progress.currentFilter,
    progress.currentChapter,
    progress.currentSection
  );
}

function answerStatement(db, user, questionId, answer) {
  return db.prepare(
    `INSERT INTO quiz_answers (
       user_key, question_id, selected_json, submitted, is_correct, updated_at
     ) VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_key, question_id) DO UPDATE SET
       selected_json = excluded.selected_json,
       submitted = excluded.submitted,
       is_correct = excluded.is_correct,
       updated_at = excluded.updated_at`
  ).bind(
    user,
    questionId,
    JSON.stringify(answer.selected),
    answer.submitted ? 1 : 0,
    answer.isCorrect ? 1 : 0
  );
}

function decodeQuestionId(questionId) {
  return /^\d+$/.test(questionId) ? Number(questionId) : questionId;
}

async function readState(db, user) {
  const [progressResult, answersResult] = await db.batch([
    db.prepare(
      `SELECT current_index, current_question_id, current_tab, current_filter,
              current_chapter, current_section, updated_at
       FROM quiz_progress WHERE user_key = ?`
    ).bind(user),
    db.prepare(
      `SELECT question_id, selected_json, submitted, is_correct, updated_at
       FROM quiz_answers WHERE user_key = ?`
    ).bind(user),
  ]);

  const progress = progressResult.results[0] || null;
  const answers = answersResult.results || [];
  if (!progress && answers.length === 0) return null;

  const answeredState = {};
  const wrongSet = [];
  let latestUpdatedAt = progress ? progress.updated_at : null;

  for (const row of answers) {
    let selected = [];
    try {
      const parsed = JSON.parse(row.selected_json);
      if (Array.isArray(parsed)) selected = parsed;
    } catch (error) {
      selected = [];
    }
    answeredState[row.question_id] = {
      selected,
      submitted: row.submitted === 1,
      isCorrect: row.is_correct === 1,
    };
    if (row.submitted === 1 && row.is_correct !== 1) {
      wrongSet.push(decodeQuestionId(row.question_id));
    }
    if (!latestUpdatedAt || row.updated_at > latestUpdatedAt) latestUpdatedAt = row.updated_at;
  }

  return {
    state: {
      answeredState,
      wrongSet,
      currentIndex: progress ? progress.current_index : 0,
      currentQuestionId: progress && progress.current_question_id
        ? decodeQuestionId(progress.current_question_id)
        : null,
      currentTab: progress ? progress.current_tab : "practice",
      currentFilter: progress ? progress.current_filter : "all",
      currentChapter: progress ? progress.current_chapter : "all",
      currentSection: progress ? progress.current_section : "all",
    },
    updatedAt: latestUpdatedAt,
  };
}

async function handleRequest(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  const url = new URL(request.url);

  if (url.pathname === "/health") {
    return json({ ok: true }, 200, env);
  }

  if (url.pathname === "/ranking" && request.method === "GET") {
    const result = await env.DB.prepare(
      `SELECT p.user_key AS name,
              SUM(CASE WHEN a.submitted = 1 THEN 1 ELSE 0 END) AS done,
              SUM(CASE WHEN a.submitted = 1 AND a.is_correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM quiz_progress p
       LEFT JOIN quiz_answers a ON a.user_key = p.user_key
       GROUP BY p.user_key
       ORDER BY correct DESC, done DESC, p.updated_at DESC
       LIMIT 100`
    ).all();
    const users = (result.results || []).map((row) => {
      const done = Number(row.done || 0);
      const correct = Number(row.correct || 0);
      return {
        name: row.name,
        done,
        correct,
        rate: done > 0 ? Math.round((correct / done) * 100) : 0,
      };
    });
    return json({ ok: true, users }, 200, env);
  }

  if (url.pathname === "/state" && request.method === "GET") {
    const user = validateUser(url.searchParams.get("user"));
    if (!user) return json({ ok: false, error: "Missing user" }, 400, env);
    const result = await readState(env.DB, user);
    if (!result) return json({ ok: true, state: null, updatedAt: null }, 200, env);
    return json({ ok: true, ...result }, 200, env);
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405, env);
  }

  const body = await readJson(request);
  const user = validateUser(body && body.user);
  if (!body) return json({ ok: false, error: "Invalid JSON" }, 400, env);
  if (!user) return json({ ok: false, error: "Missing user" }, 400, env);

  if (url.pathname === "/answer") {
    const questionId = validateQuestionId(body.questionId);
    const answer = validateAnswer(body.answer);
    const progress = validateProgress(body.progress);
    if (!questionId) return json({ ok: false, error: "Missing question" }, 400, env);
    if (!answer) return json({ ok: false, error: "Invalid answer" }, 400, env);
    await env.DB.batch([
      answerStatement(env.DB, user, questionId, answer),
      progressStatement(env.DB, user, progress),
    ]);
    return json({ ok: true }, 200, env);
  }

  if (url.pathname === "/progress") {
    const progress = validateProgress(body.progress);
    await progressStatement(env.DB, user, progress).run();
    return json({ ok: true }, 200, env);
  }

  if (url.pathname === "/reset") {
    const progress = validateProgress({});
    await env.DB.batch([
      env.DB.prepare("DELETE FROM quiz_answers WHERE user_key = ?").bind(user),
      progressStatement(env.DB, user, progress),
    ]);
    return json({ ok: true }, 200, env);
  }

  if (url.pathname === "/state") {
    const state = body.state;
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

  return json({ ok: false, error: "Not found" }, 404, env);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error(JSON.stringify({
        message: "quiz sync request failed",
        path: new URL(request.url).pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return json({ ok: false, error: "Internal server error" }, 500, env);
    }
  },
};
