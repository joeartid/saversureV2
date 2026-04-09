export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("consumer_token");
}

const POST_LOGIN_REDIRECT_KEY = "consumer_post_login_redirect";

function isSafeInternalPath(path: string | null | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

export function setToken(token: string) {
  localStorage.setItem("consumer_token", token);
}

export function getUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload as { user_id: string; tenant_id: string; role: string; exp: number };
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  const user = getUser();
  if (!user) return false;
  return user.exp * 1000 > Date.now();
}

export function logout() {
  localStorage.removeItem("consumer_token");
  window.location.href = "/";
}

export function setPostLoginRedirect(path: string) {
  if (typeof window === "undefined") return;
  if (!isSafeInternalPath(path)) return;
  sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path);
}

export function getPostLoginRedirect(): string | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  return isSafeInternalPath(value) ? value : null;
}

export function clearPostLoginRedirect() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
}
