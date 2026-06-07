import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API, headers: { "Content-Type": "application/json" } });

export const api = {
  health: () => client.get("/").then(r => r.data),
  getConfig: () => client.get("/config").then(r => r.data),
  updateConfig: (data) => client.post("/config", data).then(r => r.data),

  chat: (payload) => client.post("/chat", payload).then(r => r.data),
  transcribe: (file) => {
    const fd = new FormData();
    fd.append("audio", file);
    return axios.post(`${API}/transcribe`, fd, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data);
  },

  listConversations: () => client.get("/conversations").then(r => r.data),
  listMessages: (id) => client.get(`/conversations/${id}/messages`).then(r => r.data),
  deleteConversation: (id) => client.delete(`/conversations/${id}`).then(r => r.data),

  stats: () => client.get("/stats").then(r => r.data),

  logs: () => client.get("/logs").then(r => r.data),
  clearLogs: () => client.delete("/logs").then(r => r.data),
  simulateLogs: () => client.post("/logs/simulate").then(r => r.data),

  connectWA: () => client.post("/whatsapp/connect").then(r => r.data),
  disconnectWA: () => client.post("/whatsapp/disconnect").then(r => r.data),
};
