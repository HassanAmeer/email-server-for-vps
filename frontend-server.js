import fs from "fs";
import path from "path";

const outDir = path.join(process.cwd(), "out");
const port = parseInt(process.env.PORT || "80", 10);

console.log(`🚀 Serving static export from: ${outDir} on port ${port}`);

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
  fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);

    // Clean leading/trailing slashes
    let filePath = path.join(outDir, pathname);

    // 1. Direct file match (e.g. /_next/static/...)
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";
      return new Response(Bun.file(filePath), {
        headers: { "Content-Type": contentType }
      });
    }

    // 2. Directory index match (e.g. /admin/ -> out/admin/index.html)
    let indexPath = path.join(filePath, "index.html");
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
      return new Response(Bun.file(indexPath), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // 3. Path + .html match (e.g. /admin -> out/admin.html)
    let htmlPath = filePath.replace(/\/$/, "") + ".html";
    if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
      return new Response(Bun.file(htmlPath), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // 4. If path has no slash, check directory index (e.g. /admin -> out/admin/index.html)
    let dirIndexPath = path.join(outDir, pathname, "index.html");
    if (fs.existsSync(dirIndexPath) && fs.statSync(dirIndexPath).isFile()) {
      return new Response(Bun.file(dirIndexPath), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // 5. 404 Fallback
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
