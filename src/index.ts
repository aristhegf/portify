interface Env {
  BROWSER: any;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

type CdpMessage = {
  id?: number;
  result?: Record<string, unknown>;
  error?: { message?: string };
  method?: string;
  params?: Record<string, unknown>;
};

let nextCommandId = 0;

function sendCdpCommand(
  socket: WebSocket,
  method: string,
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const id = ++nextCommandId;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for browser command: ${method}`));
    }, 15_000);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("close", onClose);
    };

    const onMessage = (event: MessageEvent<string>) => {
      let message: CdpMessage;
      try {
        message = JSON.parse(event.data) as CdpMessage;
      } catch {
        return;
      }
      if (message.id !== id) return;
      cleanup();
      if (message.error) reject(new Error(message.error.message || "Browser command failed"));
      else resolve(message.result || {});
    };

    const onClose = () => {
      cleanup();
      reject(new Error("Browser connection closed before the command completed"));
    };

    socket.addEventListener("message", onMessage);
    socket.addEventListener("close", onClose);

    try {
      socket.send(JSON.stringify({ id, method, params }));
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function normalizeUrl(input: unknown): URL | null {
  if (typeof input !== "string" || input.length > 2048) return null;

  let url: URL;
  try {
    url = new URL(input.includes("://") ? input : `https://${input}`);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "metadata.google.internal" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) return null;

  return url;
}

function allowedViewport(widthValue: unknown, heightValue: unknown): { width: number; height: number } | null {
  const width = Number(widthValue ?? 1366);
  const height = Number(heightValue ?? 768);

  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width < 1024 || width > 1920 || height < 600 || height > 1200) return null;
  return { width, height };
}

async function createSession(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ error: "Please provide a valid request body." }, 400);
  }

  const url = normalizeUrl(body.url);
  if (!url) {
    return json({ error: "Enter a valid public website URL using http or https." }, 400);
  }

  const viewport = allowedViewport(body.width, body.height);
  if (!viewport) {
    return json({ error: "Choose a supported desktop viewport." }, 400);
  }

  let sessionId: string | undefined;
  let socket: WebSocket | undefined;

  try {
    const session = await env.BROWSER.acquire({
      keepAlive: 600_000,
      targets: true,
    });
    sessionId = session.sessionId;

    const pageTarget = session.targets?.find((target: { type: string }) => target.type === "page");
    if (!pageTarget) throw new Error("The remote browser did not create a page.");

    const connection = await env.BROWSER.connectSession(sessionId, { targetId: pageTarget.id });
    const response = await connection.webSocket.fetch("https://browser-binding.invalid", {
      headers: { Upgrade: "websocket" },
    });

    if (!response.webSocket) throw new Error("Could not connect to the remote browser.");
    socket = response.webSocket;
    socket.accept();

    await sendCdpCommand(socket, "Page.enable");
    await sendCdpCommand(socket, "Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sendCdpCommand(socket, "Page.navigate", { url: url.toString() });

    const liveView = await env.BROWSER.getLiveView(sessionId, {
      targetId: pageTarget.id,
      mode: "tab",
      expiresInMs: 3_600_000,
    });

    return json({
      sessionId,
      liveViewUrl: liveView.devtoolsFrontendUrl,
      viewport,
      targetUrl: url.toString(),
    });
  } catch (error) {
    if (sessionId) {
      try { await env.BROWSER.closeSession(sessionId); } catch { /* best-effort cleanup */ }
    }
    const message = error instanceof Error ? error.message : "Unable to start the remote browser.";
    const errorDetails = error && typeof error === "object"
      ? {
          name: "name" in error ? String(error.name) : "UnknownError",
          status: "status" in error ? Number(error.status) || undefined : undefined,
          retryAfter: "retryAfter" in error ? String(error.retryAfter) : undefined,
          stack: error instanceof Error ? error.stack : undefined,
        }
      : {};
    console.error("[portify] Browser session creation failed", {
      message,
      ...errorDetails,
      sessionAcquired: Boolean(sessionId),
    });
    const upstreamRateLimited = /status\s*[=:]\s*429|too many requests|rate limit exceeded/i.test(message)
      || errorDetails.status === 429;
    return json(
      { error: message, retryAfter: errorDetails.retryAfter },
      upstreamRateLimited ? 429 : 502,
    );
  } finally {
    try { socket?.close(); } catch { /* best-effort cleanup */ }
  }
}

async function closeSession(sessionId: string, env: Env): Promise<Response> {
  if (!/^[0-9a-f-]{20,}$/i.test(sessionId)) {
    return json({ error: "Invalid browser session." }, 400);
  }

  try {
    const result = await env.BROWSER.closeSession(sessionId);
    return json({ ok: true, result });
  } catch {
    return json({ error: "Could not close the browser session." }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/session" && request.method === "POST") {
      return createSession(request, env);
    }

    const closeMatch = url.pathname.match(/^\/api\/session\/([^/]+)$/);
    if (closeMatch && request.method === "DELETE") {
      return closeSession(decodeURIComponent(closeMatch[1]), env);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found." }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
