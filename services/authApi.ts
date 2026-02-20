import type { User } from "../types";
import { parseApiError } from "./apiError";

const fetchApi = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, credentials: "include" });

const normalizeTeamDomain = (domain: string): string => {
  const trimmed = domain.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export const fetchCurrentUser = async (): Promise<User> => {
  const response = await fetchApi("/api/auth/me");
  if (!response.ok) {
    throw await parseApiError(response, "获取当前用户信息失败");
  }
  return response.json() as Promise<User>;
};

export const logout = () => {
  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string> })
    .env;
  const teamDomain = normalizeTeamDomain(viteEnv?.VITE_CF_ACCESS_TEAM_DOMAIN || "");
  if (teamDomain) {
    window.location.href = `${teamDomain}/cdn-cgi/access/logout`;
    return;
  }
  window.location.href = "/cdn-cgi/access/logout";
};
