# Frontend authentication

These examples are for a browser SPA using TypeScript. Ask the backend developer for the Supabase project URL, publishable key, and NestJS API base URL (including any API prefix). Configure the browser origin in NestJS's `ALLOWED_ORIGINS`. Install `@supabase/supabase-js` in the frontend.

## Set up the client

```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: true },
})
const callback = new URL('/auth/callback', window.location.origin).href
const recovery = new URL('/auth/recovery', window.location.origin).href
```

The publishable key is safe to expose. Keep database credentials, Google client secrets, and Supabase secret/service-role keys on the server or in the provider dashboard.

## Email signup, confirmation, and login

```ts
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { emailRedirectTo: callback },
  })
  if (error) throw error
  return data.session // null while email confirmation is required
}

export async function logIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return getMe()
}
```

After signup, show a check-your-email screen. With the browser PKCE example, open the confirmation link in the browser that started signup. On `/auth/callback`, initialize the same client and call `getSession()` to await URL session detection. Handle both the returned error and any callback error parameters. If confirmation succeeded without a session, offer the email login form.

## Google sign-in

```ts
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: callback },
  })
  if (error) throw error
}
```

Use `/auth/callback` to finish Google login and load the app profile. With automatic URL detection enabled, let the SDK exchange the code once. Allowlist the exact frontend callback and recovery URLs in Supabase for local and deployed environments. Google Cloud's authorized redirect URI is the **Supabase** callback shown in the Google provider settings. [Google provider setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)

## Password recovery

```ts
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: recovery,
  })
  if (error) throw error
}

export async function saveNewPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}
```

On `/auth/recovery`, subscribe to `onAuthStateChange` during initialization and show the password form after `PASSWORD_RECOVERY`. Handle expired or invalid links by offering to resend. Apply your project's Supabase password policy in the form.

## Call NestJS

```ts
export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error('Sign in required')

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${data.session.access_token}`)
  return fetch(`${API_BASE_URL.replace(/\/$/, '')}${path}`, {
    ...init, headers, credentials: 'omit',
  })
}

export async function getMe() {
  const response = await apiFetch('/users/me')
  if (!response.ok) throw new Error(`Profile request failed (${response.status})`)
  return response.json()
}
```

The first authenticated API request creates the local profile. Example response excerpt:

```json
{
  "id": "ad9830e6-bbe4-4034-88e1-21e8e7d13225",
  "email": "alex@example.com",
  "name": "alex",
  "status": "ACTIVE",
  "activeOrganizationId": null,
  "roles": [],
  "permissions": []
}
```

Use the app profile ID in NestJS requests. The global `roles` and `permissions` arrays can drive navigation and action visibility. Organization routes use membership permissions and may require an organization ID in the path or `X-Organization-Id`, as specified by the endpoint. NestJS enforces access on every protected request. Reload the profile after an operator changes roles.

- **401** means sign-in is missing or the token is invalid or expired. Let Supabase refresh its session. If refresh fails, return to login. Retry a read at most once after successful refresh.
- **403** means the request is authenticated but blocked, for example because the app account is inactive or lacks permission.
- **409** can mean a different app identity already owns the email address. Contact the backend operator.
- **503** means Supabase verification is temporarily unavailable. Allow the user to retry later.

Call `await supabase.auth.signOut()`, handle any error, and clear cached app profile and protected data on sign-out.

## Smoke test

1. Sign up with a fresh email, confirm it, and log in. Call `GET /users/me` and check that the new account has empty role and permission arrays.
2. Sign in with Google and verify that the same API request works. Sign out and confirm a request without a token returns 401.
3. Call an admin endpoint such as `GET /roles` as an ordinary user and expect 403. Have the backend operator assign a role with `role:read`, reload `/users/me`, and confirm the endpoint works.
4. Once the feature is implemented, verify that two accounts with the same action permission cannot modify each other's records, and that an invalid state transition is rejected.
