const path = require("path");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const port = Number(process.env.PORT || 3000);
const apiTarget = (process.env.API_TARGET || "http://localhost:5122").trim();
const buildDir = path.join(__dirname, "build");

// Certificado da API e sempre validado. API_TLS_INSEGURO=1 existe so para o certificado local do IIS Express.
const validarCertificado = process.env.API_TLS_INSEGURO !== "1";

app.disable("x-powered-by");

// Cabecalhos de seguranca em todas as respostas do front.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: https:; script-src 'self'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; " +
      "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  );
  next();
});

app.use(
  "/api",
  createProxyMiddleware({
    target: apiTarget,
    changeOrigin: true,
    pathRewrite: (path) => `/api${path}`,
    secure: validarCertificado,
    // Informa a API o IP real do cliente (limite de tentativas de login e auditoria).
    xfwd: true,
    logLevel: "warn",
    on: {
      proxyReq: (proxyReq, req) => {
        // O cliente nao escolhe o proprio IP: vale somente o endereco da conexao recebida aqui.
        proxyReq.setHeader("X-Forwarded-For", req.socket.remoteAddress || "");
      },
      error: (err, req, res) => {
        console.error(`[proxy] Erro ao encaminhar ${req.method} ${req.url}:`, err.code || err.message);
        if (res.headersSent) return;
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          message: "API indisponível. Verifique se o servidor está rodando.",
          code: "PROXY_ERROR"
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
