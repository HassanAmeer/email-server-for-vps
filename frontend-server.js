import fs from "fs";
import path from "path";

const outDir = path.join(process.cwd(), "out");
const port = parseInt(process.env.PORT || "80", 10);
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || "8081", 10);

console.log(`🚀 Serving static export from: ${outDir} on port ${port}, proxying /api to port ${BACKEND_PORT}`);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

Bun.serve({
  port: port,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);

    // 1. Proxy API & Storage routes to backend (port 8081)
    if (pathname.startsWith("/api/") || pathname.startsWith("/storage/")) {
      const backendUrl = `http://127.0.0.1:${BACKEND_PORT}${pathname}${url.search}`;
      try {
        const headers = new Headers(req.headers);
        // Ensure host is passed accurately or forwarded
        headers.set("X-Forwarded-For", req.headers.get("x-forwarded-for") || "127.0.0.1");

        const body = (req.method === "GET" || req.method === "HEAD") ? undefined : await req.arrayBuffer();

        const backendResponse = await fetch(backendUrl, {
          method: req.method,
          headers: headers,
          body: body
        });

        const responseHeaders = new Headers(backendResponse.headers);
        // Allow CORS if needed
        responseHeaders.set("Access-Control-Allow-Origin", "*");

        return new Response(backendResponse.body, {
          status: backendResponse.status,
          statusText: backendResponse.statusText,
          headers: responseHeaders
        });
      } catch (proxyErr) {
        console.error(`Proxy error to backend ${backendUrl}:`, proxyErr);
        return new Response(JSON.stringify({ error: "Backend proxy unavailable" }), {
          status: 502,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Clean leading/trailing slashes for static file matching
    let filePath = path.join(outDir, pathname);

    // 2. Direct file match (e.g. /_next/static/...)
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";
      return new Response(Bun.file(filePath), {
        headers: { "Content-Type": contentType }
      });
    }

    // 3. Directory index match (e.g. /admin/ -> out/admin/index.html)
    let indexPath = path.join(filePath, "index.html");
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
      return new Response(Bun.file(indexPath), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // 4. Path + .html match (e.g. /admin -> out/admin.html)
    let htmlPath = filePath.replace(/\/$/, "") + ".html";
    if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
      return new Response(Bun.file(htmlPath), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // 5. If path has no slash, check directory index (e.g. /admin -> out/admin/index.html)
    let dirIndexPath = path.join(outDir, pathname, "index.html");
    if (fs.existsSync(dirIndexPath) && fs.statSync(dirIndexPath).isFile()) {
      return new Response(Bun.file(dirIndexPath), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // 6. 404 Fallback
    const notFoundPath = path.join(outDir, "404.html");
    if (fs.existsSync(notFoundPath)) {
      return new Response(Bun.file(notFoundPath), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
});
