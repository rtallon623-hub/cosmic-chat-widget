const DEFAULT_CHAT_API_URL = "/api/chat";
const DEFAULT_ERROR_MESSAGE = "The chat service is unavailable right now.";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getChatApiUrl(env = process.env) {
  return normalizeString(env?.NEXT_PUBLIC_CHAT_API_URL) || DEFAULT_CHAT_API_URL;
}

export function createChatRequestBody(messages) {
  return { messages };
}

export function getAssistantMessage(payload) {
  if (typeof payload === "string") {
    return normalizeString(payload);
  }

  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = [
    payload.content,
    payload.response,
    payload.message,
    payload.answer,
    payload.output,
    payload.text,
    payload.message?.content,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

export function getErrorMessage(payload, fallback = DEFAULT_ERROR_MESSAGE) {
  if (typeof payload === "string") {
    return normalizeString(payload) || fallback;
  }

  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const candidates = [payload.error, payload.detail, payload.message];

  for (const candidate of candidates) {
    const normalized = normalizeString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return fallback;
}

async function readResponsePayload(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { response: text };
  }
}

export async function sendChatMessage({
  messages,
  signal,
  apiUrl,
}) {
  const resolvedApiUrl = normalizeString(apiUrl) || getChatApiUrl();

  const response = await fetch(resolvedApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(createChatRequestBody(messages)),
    signal,
  });

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Chat request failed (${response.status})`));
  }

  const assistantMessage = getAssistantMessage(payload);

  if (!assistantMessage) {
    throw new Error("Chat response did not include an assistant message.");
  }

  return {
    assistantMessage,
    payload,
  };
}
