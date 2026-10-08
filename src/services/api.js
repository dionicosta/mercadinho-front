import axios from "axios";

function resolverBaseUrl() {
  const apiUrl = (process.env.REACT_APP_API_URL || "").trim();
  if (apiUrl) return apiUrl;

  return "/api";
}

const base = resolverBaseUrl();

const api = axios.create({
  baseURL: base,
  headers: {
    "Content-Type": "application/json"
  }
});

// Evento disparado quando o servidor recusa a sessao (token expirado, senha trocada, loja suspensa...).
export const EVENTO_SESSAO_ENCERRADA = "mercadinho:sessao-encerrada";

api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  config.headers = config.headers || {};
  if (token) {
    config.headers.Authorization = "Bearer " + token;
  } else {
    delete config.headers.Authorization;
  }
  return config;
}, err => Promise.reject(err));

api.interceptors.response.use(resp => resp, err => {
  const status = err?.response?.status;
  const url = err?.config?.url || "";

  // Nunca registra token, senha ou corpo da requisicao no console.
  console.error("[api] erro:", { status, url, message: err?.message });

  if (status === 401 && !url.includes("/auth/login") && localStorage.getItem("token")) {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.dispatchEvent(new Event(EVENTO_SESSAO_ENCERRADA));
  }

  return Promise.reject(err);
});

// Mensagem de erro amigavel a partir da resposta da API ({ message }, texto puro ou erros de validacao).
export function extrairErro(err, fallback = "Erro inesperado.") {
  const status = err?.response?.status;
  const data = err?.response?.data;

  if (!err?.response) return "Não foi possível falar com o servidor. Verifique a conexão.";
  if (status === 401) return "Sessão expirada. Faça login novamente.";
  if (status === 429) return "Muitas tentativas. Aguarde um minuto e tente de novo.";

  if (typeof data === "string" && data.trim() && !/^\s*</.test(data)) return data;
  if (data?.message) return data.message;
  if (data?.errors) {
    const primeira = Object.values(data.errors).flat().find(Boolean);
    if (primeira) return primeira;
  }
  if (status === 403) return "Você não tem permissão para esta ação.";
  if (data?.title) return data.title;

  return fallback;
}

export default api;
