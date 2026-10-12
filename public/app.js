const form = document.querySelector("#open-form");
const urlInput = document.querySelector("#site-url");
const viewportSelect = document.querySelector("#viewport");
const openButton = document.querySelector("#open-button");
const message = document.querySelector("#message");
const activeSession = document.querySelector("#active-session");
const sessionDetail = document.querySelector("#session-detail");
const closeButton = document.querySelector("#close-session");
const previewSize = document.querySelector(".preview-size");

let currentSessionId = null;

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

function setBusy(busy) {
  openButton.disabled = busy;
  openButton.innerHTML = busy ? "Opening…" : 'Open <span aria-hidden="true">↗</span>';
}

viewportSelect.addEventListener("change", () => {
  previewSize.textContent = viewportSelect.value.replace("x", " × ");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  activeSession.hidden = true;

  const rawUrl = urlInput.value.trim();
  if (!rawUrl) return;

  // Open synchronously from the user gesture so mobile browsers are less likely to block the tab.
  const viewTab = window.open("about:blank", "_blank");
  if (viewTab) {
    viewTab.document.title = "Starting Portify…";
    viewTab.document.body.style.cssText = "margin:0;background:#f6f5f1;color:#273020;font:16px system-ui;display:grid;place-items:center;min-height:100vh";
    viewTab.document.body.textContent = "Starting your remote desktop browser…";
  }

  const [width, height] = viewportSelect.value.split("x").map(Number);
  setBusy(true);

  try {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: rawUrl, width, height }),
    });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Could not start the remote browser.");

    currentSessionId = data.sessionId;
    if (viewTab && !viewTab.closed) {
      viewTab.location.replace(data.liveViewUrl);
    } else {
      window.location.assign(data.liveViewUrl);
      return;
    }

    sessionDetail.textContent = `${data.viewport.width} × ${data.viewport.height} · Live View opened in a new tab.`;
    activeSession.hidden = false;
    showMessage("");
  } catch (error) {
    if (viewTab && !viewTab.closed) viewTab.close();
    showMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
  } finally {
    setBusy(false);
  }
});

closeButton.addEventListener("click", async () => {
  if (!currentSessionId) return;
  closeButton.disabled = true;
  closeButton.textContent = "Closing…";

  try {
    const response = await fetch(`/api/session/${encodeURIComponent(currentSessionId)}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not close the remote session.");

    currentSessionId = null;
    activeSession.hidden = true;
    showMessage("Remote browser session closed.");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Could not close the session.");
  } finally {
    closeButton.disabled = false;
    closeButton.textContent = "Close remote session";
  }
});
