/**
 * Browser-side helper for fetch calls to /api/admin/*.
 *
 * The browser is now authenticated via the httpOnly admin_session
 * cookie set by /api/admin/auth/verify-otp. We just need to make
 * sure the cookie is sent with each request. `credentials: 'include'`
 * on a same-origin request is enough (the cookie isn't cross-site).
 *
 * If a 401 comes back, the caller can dispatch a redirect to
 * /admin/login. We don't do it here so the calling component can
 * decide UX (e.g. show a modal vs hard redirect).
 */
export function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, credentials: 'include' })
}
