const path = require("path");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const port = Number(process.env.PORT || 3000);
const apiTarget = (process.env.API_TARGET || "http://localhost:5122").trim();
const buildDir = path.join(__dirname, "build");

app.use(
  "/api",
  createProxyMiddleware({
    target: apiTarget,
    changeOrigin: true,
    pathRewrite: (path) => `/api${path}`,
    secure: false,
    logLevel: "warn",
    on: {
      error: (err, req, res) => {
        console.error(`[proxy] Erro ao encaminhar ${req.method} ${req.url}:`, err.code || err.message);
        if (res.headersSent) return;
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          message: `API indisponível (${apiTarget}). Verifique se o servidor está rodando.`,
          code: err.code || "PROXY_ERROR"
        }));
      }
    }
  })
);

app.use(express.static(buildDir));

app.get("*", (_req, res) => {
  res.sendFile(path.join(buildDir, "index.html"));
});

app.listen(port, () => {
  console.log(`[front] Express ativo em http://localhost:${port}`);
  console.log(`[front] Proxy /api -> ${apiTarget}`);
});