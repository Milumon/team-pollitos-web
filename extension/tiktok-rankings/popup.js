const importButton = document.querySelector("#import");
const progress = document.querySelector("#progress");
const message = document.querySelector("#message");

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const render = (state) => {
  progress.replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = `${state.count}/${state.total} combinaciones capturadas${state.status === "publishing" ? " - publicando" : ""}`;
  progress.append(heading);
  for (const combination of state.combinations || []) {
    const row = document.createElement("div");
    row.className = "combination-row";

    const label = document.createElement("span");
    label.textContent = `${combination.captured ? "[x]" : combination.error ? "[!]" : "[ ]"} ${combination.metric}/${combination.period}${combination.error ? ` - ${combination.error}` : ""}`;
    row.append(label);

    if (combination.captured) {
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "copy-btn";
      copyBtn.title = "Copiar datos condensados de este top al portapapeles";
      copyBtn.textContent = "Copiar";
      copyBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          let dataToCopy = combination.data;
          if (!dataToCopy) {
            const freshState = await chrome.runtime.sendMessage({ type: "get-state", tabId: tab?.id });
            const found = freshState?.combinations?.find(c => c.metric === combination.metric && c.period === combination.period);
            dataToCopy = found?.data;
          }
          if (!dataToCopy) throw new Error("No se encontraron los datos del top");

          const jsonText = JSON.stringify(dataToCopy, null, 2);
          await navigator.clipboard.writeText(jsonText);
          const originalText = copyBtn.textContent;
          copyBtn.textContent = "¡Copiado!";
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.classList.remove("copied");
          }, 1500);
        } catch (err) {
          console.error("Error al copiar al portapapeles:", err);
        }
      });
      row.append(copyBtn);
    }

    progress.append(row);
  }
  message.textContent = state.error || (state.status === "published" ? "Batch publicado correctamente." : "Cierra DevTools y selecciona cada periodo y metrica en LIVE Center; la extension capturara sus respuestas.");
  importButton.disabled = ["capturing", "publishing"].includes(state.status);
};

chrome.runtime.onMessage.addListener((message) => { if (message.type === "progress" && message.tabId === tab?.id) render(message.state); });
const current = await chrome.runtime.sendMessage({ type: "get-state", tabId: tab?.id });
render(current || { count: 0, total: 8, combinations: [], status: "idle" });

importButton.addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "start-import", tabId: tab?.id });
  if (!result.ok) message.textContent = result.error;
  else render(result.state);
});
document.querySelector("#options").addEventListener("click", () => chrome.runtime.openOptionsPage());
