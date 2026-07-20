const API_BASE = import.meta.env.DEV
  ? ""
  : "https://workspaceapi-server-production-5bd0.up.railway.app";

export const apiUrl = (path: string) => `${API_BASE}${path}`;
