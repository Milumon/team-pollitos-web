import {
  COMBINATIONS,
  buildPayload,
  combinationFromUrl,
  completeSets,
  normalizeResponse,
  parseRankingResponseText,
} from "./collector.mjs";

const state = new Map();
const pendingResponses = new Map();
const CONFIG_KEYS = ["portalUrl", "importToken"];
const storageKey = (tabId) => `ranking-import:${tabId}`;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "start-import") startImport(message.tabId).then(sendResponse);
  if (message.type === "get-state") getImportState(message.tabId).then((importState) => sendResponse(publicState(importState)));
  return true;
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (typeof source.tabId !== "number") return;
  const key = `${source.tabId}:${params.requestId}`;

  if (method === "Network.responseReceived") {
    const combination = combinationFromUrl(params.response?.url);
    if (combination) pendingResponses.set(key, combination);
    return;
  }

  if (method === "Network.loadingFailed") {
    pendingResponses.delete(key);
    return;
  }

  if (method !== "Network.loadingFinished") return;
  const combination = pendingResponses.get(key);
  if (!combination) return;
  pendingResponses.delete(key);

  chrome.debugger.sendCommand(source, "Network.getResponseBody", { requestId: params.requestId })
    .then((response) => {
      const text = response.base64Encoded
        ? new TextDecoder().decode(Uint8Array.from(atob(response.body), (character) => character.charCodeAt(0)))
        : response.body;
      return handleCapture(source.tabId, { ...combination, body: parseRankingResponseText(text) });
    })
    .catch((error) => recordCaptureFailure(source.tabId, combination, error));
});

chrome.debugger.onDetach.addListener((source, reason) => {
  if (typeof source.tabId !== "number") return;
  void getImportState(source.tabId).then(async (importState) => {
    if (!importState || importState.status !== "capturing") return;
    importState.status = "error";
    importState.error = `Chrome detuvo la captura de red (${reason}). Presiona Importar ahora para continuar.`;
    await persist(source.tabId, importState);
    notify(source.tabId, importState);
  });
});

function serialize(importState) {
  return {
    ...importState,
    sets: [...importState.sets.entries()],
    failures: [...importState.failures.entries()],
  };
}

function revive(value) {
  return value ? { ...value, sets: new Map(value.sets ?? []), failures: new Map(value.failures ?? []) } : null;
}

function isPublishResult(result) {
  return result && ["published", "replayed"].includes(result.status) && typeof result.batch_id === "string";
}

async function persist(tabId, importState) {
  state.set(tabId, importState);
  await chrome.storage.session.set({ [storageKey(tabId)]: serialize(importState) });
}

async function getImportState(tabId) {
  if (state.has(tabId)) return state.get(tabId);
  const stored = await chrome.storage.session.get(storageKey(tabId));
  const importState = revive(stored[storageKey(tabId)]);
  if (importState?.status === "publishing" || (importState?.status === "published" && !isPublishResult(importState.result))) {
    importState.status = "error";
    importState.error = "La publicacion no fue confirmada por Team Pollito. Revisa la URL del portal y presiona Importar ahora para reintentar el mismo batch.";
    await persist(tabId, importState);
  } else if (importState) {
    state.set(tabId, importState);
  }
  return importState;
}

async function enableNetworkCapture(tabId) {
  const target = { tabId };
  try {
    await chrome.debugger.attach(target, "1.3");
  } catch {
    try {
      await chrome.debugger.sendCommand(target, "Network.enable");
      return;
    } catch {
      throw new Error("Cierra DevTools en la pestaña de TikTok y vuelve a presionar Importar ahora.");
    }
  }
  await chrome.debugger.sendCommand(target, "Network.enable");
}

async function recordCaptureFailure(tabId, combination, cause) {
  const importState = await getImportState(tabId);
  if (!importState || importState.status !== "capturing") return;
  const message = cause instanceof Error ? cause.message : "No se pudo leer la respuesta de TikTok";
  importState.failures.set(`${combination.metric}/${combination.period}`, message);
  importState.error = message;
  await persist(tabId, importState);
  notify(tabId, importState);
}

async function startImport(tabId) {
  const config = await chrome.storage.local.get(CONFIG_KEYS);
  if (!config.portalUrl || !config.importToken) return { ok: false, error: "Configura URL del portal y token en Opciones." };

  const previous = await getImportState(tabId);
  if (previous?.status === "error" && completeSets([...previous.sets.values()])) {
    previous.status = "publishing";
    previous.error = null;
    await persist(tabId, previous);
    notify(tabId, previous);
    await publish(tabId, previous);
    return { ok: previous.status === "published", state: publicState(previous), error: previous.error };
  }

  const importState = previous?.status === "error"
    ? { ...previous, status: "capturing", error: null }
    : {
        sets: new Map(),
        failures: new Map(),
        startedAt: new Date().toISOString(),
        idempotencyKey: crypto.randomUUID(),
        status: "capturing",
        error: null,
      };
  await persist(tabId, importState);

  try {
    await enableNetworkCapture(tabId);
    notify(tabId, importState);
    return { ok: true, state: publicState(importState) };
  } catch (error) {
    importState.status = "error";
    importState.error = error instanceof Error ? error.message : "Abre TikTok LIVE Center en la pestaña activa antes de importar.";
    await persist(tabId, importState);
    notify(tabId, importState);
    return { ok: false, error: importState.error };
  }
}

async function handleCapture(tabId, message) {
  if (typeof tabId !== "number") return { ok: false };
  const importState = await getImportState(tabId);
  if (!importState || importState.status !== "capturing") return { ok: false };

  try {
    const expected = { metric: message.metric, period: message.period };
    const set = normalizeResponse(message.body, expected);
    importState.sets.set(`${set.metric}/${set.period}`, set);
    importState.failures.delete(`${set.metric}/${set.period}`);
    importState.error = null;
    await persist(tabId, importState);
    notify(tabId, importState);

    if (importState.sets.size === 8 && completeSets([...importState.sets.values()])) {
      importState.status = "publishing";
      await persist(tabId, importState);
      notify(tabId, importState);
      await publish(tabId, importState);
    }
    return { ok: true };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Respuesta descartada";
    const key = `${message.metric}/${message.period}`;
    importState.failures.set(key, messageText);
    importState.error = messageText;
    await persist(tabId, importState);
    notify(tabId, importState);
    return { ok: false, error: messageText };
  }
}

async function publish(tabId, importState) {
  const config = await chrome.storage.local.get(CONFIG_KEYS);
  const payload = buildPayload(
    [...importState.sets.values()],
    importState.startedAt,
    importState.idempotencyKey,
  );

  const endpoint = `${config.portalUrl.replace(/\/$/, "")}/api/tiktok/rankings/import`;
  console.log(`[TikTok Rankings] Publishing to ${endpoint}`);
  console.log(`[TikTok Rankings] Token length: ${config.importToken?.length ?? 0}, sets: ${importState.sets.size}`);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tiktok-import-token": config.importToken },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);
    console.log(`[TikTok Rankings] Response: ${response.status}`, result);
    if (!response.ok) {
      const detail = result && typeof result.detail === "string" ? result.detail
        : result && typeof result.error === "string" ? result.error : "";
      throw new Error(`El portal respondio HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    if (!isPublishResult(result)) {
      throw new Error("La URL configurada no corresponde al backend de Team Pollito.");
    }
    importState.status = "published";
    importState.error = null;
    importState.result = result;
  } catch (error) {
    importState.status = "error";
    importState.error = error instanceof Error ? error.message : "No se pudo publicar el batch";
    console.error("[TikTok Rankings] Publish failed:", importState.error);
  }

  await persist(tabId, importState);
  notify(tabId, importState);
  await chrome.debugger.detach({ tabId }).catch(() => {});
}

function publicState(importState) {
  const captured = new Set(importState?.sets ? [...importState.sets.keys()] : []);
  const failures = importState?.failures ?? new Map();
  return {
    status: importState?.status || "idle",
    count: captured.size,
    total: COMBINATIONS.length,
    combinations: COMBINATIONS.map(({ metric, period }) => ({
      metric,
      period,
      captured: captured.has(`${metric}/${period}`),
      error: failures.get(`${metric}/${period}`) || null,
      data: importState?.sets?.get(`${metric}/${period}`) || null,
    })),
    error: importState?.error || null,
    result: importState?.result || null,
  };
}

function notify(tabId, importState) {
  chrome.runtime.sendMessage({ type: "progress", tabId, state: publicState(importState) }).catch(() => {});
}
