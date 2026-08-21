import express, { type Express, type Request } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

const UNRESOLVED_MODULE_LOG_PATH = path.resolve(
  import.meta.dirname,
  "../..",
  ".manus-logs",
  "unresolvedModuleRequests.log"
);
const MODULE_REQUEST_PATH = /\.(?:[cm]?[jt]sx?|css|json|map|wasm)$/i;

/**
 * Only browser document navigations should receive the SPA document fallback.
 * JavaScript module requests typically use a wildcard Accept header; serving index.html to a
 * missed module causes the browser's `Unexpected token '<'` parse failure.
 */
export function isHtmlNavigationRequest(req: Pick<Request, "method" | "headers">) {
  return req.method === "GET" && (req.headers.accept ?? "").includes("text/html");
}

export function isModuleLikeRequest(req: Pick<Request, "method" | "headers" | "originalUrl">) {
  const pathname = req.originalUrl.split("?")[0];
  return req.method === "GET" && !isHtmlNavigationRequest(req) && (
    pathname.startsWith("/src/") ||
    pathname.startsWith("/@fs/") ||
    pathname.startsWith("/@vite/") ||
    pathname.includes("/node_modules/") ||
    MODULE_REQUEST_PATH.test(pathname)
  );
}

function recordUnresolvedModuleRequest(req: Pick<Request, "headers" | "originalUrl">) {
  try {
    fs.mkdirSync(path.dirname(UNRESOLVED_MODULE_LOG_PATH), { recursive: true });
    fs.appendFileSync(
      UNRESOLVED_MODULE_LOG_PATH,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        url: req.originalUrl,
        accept: req.headers.accept ?? "",
        status: 404,
        contentType: "text/plain; charset=utf-8",
      })}\n`,
      "utf-8"
    );
  } catch {
    // Diagnostic tracing must never interfere with module error delivery.
  }
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    if (!isHtmlNavigationRequest(req)) {
      if (isModuleLikeRequest(req)) recordUnresolvedModuleRequest(req);
      res.status(404).set({
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      }).end("Not found");
      return;
    }

    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "Content-Type": "text/html",
      }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // Fall through to index.html only for browser document navigation. A stale
  // module request must be a real 404, never an HTML document parsed as JS.
  app.use("*", (req, res) => {
    if (!isHtmlNavigationRequest(req)) {
      if (isModuleLikeRequest(req)) recordUnresolvedModuleRequest(req);
      res.status(404).set({
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      }).end("Not found");
      return;
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
