import http from "http";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 8080;
const DIST = path.join(__dirname, "dist");

const MIME_TYPES = {
  ".html":  "text/html; charset=utf-8",
  ".js":    "text/javascript",
  ".mjs":   "text/javascript",
  ".css":   "text/css",
  ".json":  "application/json",
  ".png":   "image/png",
  ".jpg":   "image/jpeg",
  ".svg":   "image/svg+xml",
  ".ico":   "image/x-icon",
  ".woff":  "font/woff",
  ".woff2": "font/woff2",
  ".ttf":   "font/ttf",
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  // Library sub-app: any /library/* path without a file extension -> its index.html
  if (urlPath.startsWith("/library") && !path.extname(urlPath)) {
    urlPath = "/library/index.html";
  }

  const filePath = path.join(DIST, urlPath);

  // Prevent path traversal
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(DIST, "index.html"), (err2, fallback) => {
        if (err2) { res.writeHead(404); res.end("Not found"); return; }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fallback);
      });
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${PORT}`;
  console.log("+-----------------------------------------+");
  console.log("|  AVFlow is running                      |");
  console.log(`|  Canvas  ->  ${url}          |`);
  console.log(`|  Library ->  ${url}/library/ |`);
  console.log("|                                         |");
  console.log("|  Close this window to stop the server.  |");
  console.log("+-----------------------------------------+");

  // Open both apps
  const urlLibrary = `${url}/library/`;
  if (process.platform === "win32") {
    exec(`start "" "${url}"`);
    setTimeout(() => exec(`start "" "${urlLibrary}"`), 800);
  } else if (process.platform === "darwin") {
    exec(`open "${url}"`);
    setTimeout(() => exec(`open "${urlLibrary}"`), 800);
  } else {
    exec(`xdg-open "${url}"`);
    setTimeout(() => exec(`xdg-open "${urlLibrary}"`), 800);
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Close the other AVFlow window and try again.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
