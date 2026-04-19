import axios from "axios";

const base = process.env.REACT_APP_API_URL || "/api";

const api = axios.create({
  baseURL: base,
  headers: {
    "Content-Type": "application/json"
  }
});

// sempre garante e loga o Authorization antes de enviar
api.interceptors.request.use(config => {
  try {
    const token = localStorage.getItem("token");
    config.headers = config.headers || {};
    if (token) {
      config.headers.Authorization = "Bearer " + token;
    } else {
      delete config.headers.Authorization;
    }

    // debug: mostra as principais infos no console
    console.debug("[api] request:", {
      method: config.method?.toUpperCase(),
      url: (config.baseURL || "") + (config.url || ""),
      hasToken: !!token,
      headersPreview: {
        Authorization: !!config.headers.Authorization,
        "Content-Type": config.headers["Content-Type"]
      },
      data: config.data
    });
  } catch (e) {
    console.error("[api] intercept error", e);
  }
  return config;
}, err => Promise.reject(err));

api.interceptors.response.use(resp => resp, err => {
  console.error("[api] response error:", {
    status: err?.response?.status,
    data: err?.response?.data,
    message: err?.message,
    url: err?.config?.url
  });
  return Promise.reject(err);
});

export default api;