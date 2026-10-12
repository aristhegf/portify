const form = document.querySelector("#open-form");
const urlInput = document.querySelector("#site-url");
const viewportSelect = document.querySelector("#viewport");
const openButton = document.querySelector("#open-button");
const message = document.querySelector("#message");
const activeSession = document.querySelector("#active-session");
const sessionDetail = document.querySelector("#session-detail");
const closeButton = document.querySelector("#close-session");
const previewSize = document.querySelector(".preview-size");
const viewer = document.querySelector("#browser-viewer");
const browserFrame = document.querySelector("#browser-frame");
const viewerAddress = document.querySelector("#viewer-address");
const viewerStatus = document.querySelector("#viewer-status");
const landscapeToggle = document.querySelector("#landscape-toggle");
const viewerBack = document.querySelector("#viewer-back");
const viewerNewTab = document.querySelector("#viewer-new-tab");

let currentSessionId = null;
let currentLiveViewUrl = null;
let landscape = false;
let isOpening = false;

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

function setBusy(busy) {
  isOpening = busy;
  openButton.disabled = busy;
  openButton.innerHTML = busy ? "Opening…" : 'Open <span aria-hidden="true">↗</span>';
}

function setLandscape(enabled) {
  landscape = enabled;
  viewer.classList.toggle("is-landscape", enabled);
  landscapeToggle.setAttribute("aria-pressed", String(enabled));
  landscapeToggle.innerHTML = enabled
    ? '<span aria-hidden="true">↺</span> Portrait'
    : '<span aria-hidden="true">↻</span> Landscape';
}

function showViewer(data) {
  currentLiveViewUrl = data.liveViewUrl;
  browserFrame.src = data.liveViewUrl;
  viewerAddress.textContent = data.targetUrl || urlInput.value.trim();
  viewerStatus.textContent = "Remote browser started. If the view does not load here, use ↗ to open it separately.";
  viewer.hidden = false;
  document.body.classList.add("viewer-open");
  setLandscape(false);
}

function hideViewer() {
  viewer.hidden = true;
  document.body.classList.remove("viewer-open");
  setLandscape(false);
}

viewportSelect.addEventListener("change", () => {
  previewSize.textContent = viewportSelect.value.replace("x", " × ");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isOpening) return;
  showMessage("");

  const rawUrl = urlInput.value.trim();
  if (!rawUrl) return;

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
    sessionDetail.textContent = `${data.viewport.width} × ${data.viewport.height} · Remote browser ready.`;
    activeSession.hidden = false;
    showViewer(data);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
  } finally {
    setBusy(false);
  }
});

landscapeToggle.addEventListener("click", () => setLandscape(!landscape));

viewerBack.addEventListener("click", hideViewer);

viewerNewTab.addEventListener("click", () => {
  if (!currentLiveViewUrl) return;
  window.open(currentLiveViewUrl, "_blank", "noopener,noreferrer");
});

browserFrame.addEventListener("load", () => {
  viewerStatus.textContent = "Viewer frame loaded. If it looks blank, tap ↗ to open it separately."
});

async function closeRemoteSession() {
  if (!currentSessionId) {
    hideViewer();
    return;
  }

  closeButton.disabled = true;
  closeButton.textContent = "Closing…";
  viewerStatus.textContent = "Closing remote browser…";

  try {
    const response = await fetch(`/api/session/${encodeURIComponent(currentSessionId)}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not close the remote session.");

    currentSessionId = null;
    currentLiveViewUrl = null;
    browserFrame.removeAttribute("src");
    activeSession.hidden = true;
    hideViewer();
    showMessage("Remote browser session closed.");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Could not close the session.");
    viewerStatus.textContent = "Could not close the remote browser. Please try again.";
  } finally {
    closeButton.disabled = false;
    closeButton.textContent = "Close remote session";
  }
}

closeButton.addEventListener("click", closeRemoteSession);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !viewer.hidden) hideViewer();
});

window.addEventListener("pagehide", () => {
  // The server-side session has its own ten-minute keep-alive. Explicitly close
  // it with the in-viewer control when you are done.
});
