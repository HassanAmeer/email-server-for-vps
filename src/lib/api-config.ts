/**
 * Resolves the appropriate API base URL depending on runtime environment:
 * - Production VPS (port 80/443, standard domains/IPs): relative "" (proxied via frontend-server.js)
 * - Development (port 3000, 3001, 8080, etc.): direct backend at "http://<hostname>:8081"
 */
export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:8081";

  const port = window.location.port;
  // If on standard HTTP(S) ports (e.g. live VPS on port 80/443)
  if (port === "" || port === "80" || port === "443") {
    return "";
  }

  // If already on port 8081
  if (port === "8081") {
    return "";
  }

  // Development dev servers (3000, 8080, etc.)
  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol || "http:";
  return `${protocol}//${host}:8081`;
}
