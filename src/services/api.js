import axios from "axios";

const base = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: base,
  headers: {
    "Content-Type": "application/json"
  }
});

// interceptor → envia token automaticamente
api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = "Bearer " + token;
  }

  // debug: log payloads de login
  if (config.url && config.url.toLowerCase().includes("/auth/login")) {
    console.debug("[API] Request LOGIN ->", {
      url: config.baseURL + config.url,
      headers: config.headers,
      data: config.data
    });
  }

  return config;
}, err => {
  return Promise.reject(err);
});

api.interceptors.response.use(resp => {
  // debug para login
  if (resp.config && resp.config.url && resp.config.url.toLowerCase().includes("/auth/login")) {
    console.debug("[API] Response LOGIN <-", {
      status: resp.status,
      data: resp.data
    });
  }
  return resp;
}, err => {
  // debug de erro
  if (err.config && err.config.url && err.config.url.toLowerCase().includes("/auth/login")) {
    console.error("[API] Response LOGIN ERROR <-", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });
  }
  return Promise.reject(err);
});

export default api;