const BACKEND_URL = process.env.DEEPSEEK_BACKEND_URL || "https://api.cabozu0987.us/chat";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonHeaders(extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    ...extra,
  };
}

function sendJson(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders(),
  });
}

async function readJsonBody(request: Request) {
  const text = await request.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Build the messages array the FastAPI backend expects.
 * Accepts either { messages: [...] } or { prompt: "..." }.
 */
function buildMessages(data: Record<string, unknown>) {
  if (Array.isArray(data.messages) && data.messages.length > 0) {
    return data.messages
      .map((m: unknown) => {
        if (!m || typeof m !== "object") return null;
        const msg = m as { role?: unknown; content?: unknown };
        const role = normalizeString(msg.role);
        const content = normalizeString(msg.content);
        if (!content) return null;
        return { role: role || "user", content };
      })
      .filter(Boolean);
  }

  const prompt = normalizeString(data.prompt);
  if (!prompt) return null;

  return [{ role: "user", content: prompt }];
}

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: jsonHeaders() });
}

export async function GET() {
  return sendJson(200, { status: "ok" });
}

export async function POST(request: Request) {
  const data = await readJsonBody(request);

  if (!data || typeof data !== "object") {
    return sendJson(400, { error: "Invalid JSON" });
  }

  const messages = buildMessages(data);
  if (!messages) {
    return sendJson(400, { error: "Missing prompt or messages" });
  }

  try {
    const backendResponse = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    const payload = await backendResponse.json();

    if (!backendResponse.ok) {
      const errorText =
        normalizeString(payload?.error) ||
        normalizeString(payload?.detail) ||
        "Chat request failed";
      return sendJson(backendResponse.status, { error: errorText });
    }

    // Only return the assistant's text -- no model, tokens, or IDs
    const content = normalizeString(payload?.content);
    if (!content) {
      return sendJson(502, { error: "No response from assistant" });
    }

    return sendJson(200, { response: content });
  } catch {
    return sendJson(502, { error: "Chat service unavailable" });
  }
}
