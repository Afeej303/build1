# Reuse the NestJS starter

Copy the repository source and lockfile into the new project. Create a fresh Supabase project for each app. Start with `.env.example` and use `AUTH_MODE=supabase`. An existing deployment without `AUTH_MODE` continues using the legacy Nest-managed login. The Supabase mode uses a bearer token for NestJS and registers no legacy `/auth/*` or `/sessions/*` routes. Manage passwords in Supabase.

## Configure and run

1. Set `SUPABASE_URL` to the project origin, `SUPABASE_PUBLISHABLE_KEY` to its publishable key, and `ALLOWED_ORIGINS` to the frontend origins. Set `DATABASE_URL` for Prisma runtime and `DIRECT_URL` to a direct PostgreSQL or session pooler connection for migrations. Use the project's TLS settings.
2. Enable email/password and email confirmation in Supabase Auth. Configure SMTP for confirmation and password recovery delivery to your demo users. Enable Google in Supabase and configure Google Cloud with the callback URL displayed by Supabase. Allowlist your frontend's `/auth/callback` and `/auth/recovery` URLs. [Email setup](https://supabase.com/docs/guides/auth/passwords) · [Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
3. Run these commands from the copied folder.

   ```sh
   npm ci
   npm run prisma:generate
   npm run prisma:migrate:deploy
   npm run prisma:seed
   npm run start:dev
   ```

4. Send [the frontend guide](frontend-auth.md) to your teammate. The browser sends app data requests to NestJS. If you only use Prisma for app data, disable the Supabase Data API or exclude the app schema from it. If you use the Data API for feature tables, explicitly grant and enforce access with RLS. The existing hardening script revokes grants across the entire public schema.

NestJS validates the token using the configured project's Auth user endpoint. Each protected request depends on that endpoint. The project origin and verified Supabase user ID identify a local profile. An email collision is rejected. If you migrate existing accounts, design and verify an explicit ID mapping before switching auth modes.

## Bootstrap the first admin

1. Seed the database, confirm the intended account in Supabase, sign in as that account, and call `GET /users/me` once.
2. Copy its **Supabase Auth user ID** from the dashboard. Run `npm run bootstrap:admin` and enter that ID, or supply it in `BOOTSTRAP_SUPABASE_USER_ID`.
3. Call `GET /users/me` again and confirm it lists `super_admin`. Keep bootstrap access with the backend operator. The script blocks further grants by default once a super admin exists.

New profiles start with zero role assignments. Public signup input and user metadata never grant permissions. Treat a signed-in user as the baseline customer or patient where appropriate. Use an authorized admin or an organization invitation for elevated access.

## Define roles after seeing the brief

- Decide which actions are global (platform administration) and which belong to an organization (restaurant or clinic). Use feature permissions such as `order:accept` or `queue:call`.
- For a global role, create the permission with `POST /permissions` using `{"key":"order:accept","scope":"GLOBAL"}`. Create the role with `POST /roles` using `{"name":"Restaurant staff","slug":"restaurant_staff","scope":"GLOBAL"}` only if access really is global. Attach permissions with `POST /roles/:id/permissions` using `{"permissionKeys":["order:accept"]}`. Assign it with `POST /users/:id/roles` using `{"roleId":"<role UUID>"}`. Use a super admin for initial setup. For repeatable setup add the project defaults to `prisma/seed.ts`.
- For tenant-scoped staff use `ORGANIZATION` roles and permissions, assign those roles through organization membership, and protect routes with `@UseOrganization()` and `@RequirePermissions(...)`. Check the resource's stored organization ID against the resolved membership. Keep role and permission management privileges with trusted operators.

## Protect a feature endpoint

Use `@CurrentUser()` for app identity. Use `@RequirePermissions('resource:action')` for the action where applicable and check ownership or assignment in the feature service. [The example policy](../src/examples/resource-authorization-example.ts) checks organization, permission, ownership, and draft state for updates. Its unit test covers allowed and denied cases.

For a hospital queue, a clinic role might grant `queue:call`, but the service must still verify the caller's queue assignment and the ticket's waiting state. For delivery, check the assigned driver and picked-up state. Put identity, tenant and expected state in a conditional write, or enforce them in a transaction, so concurrent requests cannot perform the same transition twice. Take actor IDs from the verified request context.

Run `npm run typecheck` and `npm test -- --pool=threads`, then run the [frontend smoke test](frontend-auth.md#smoke-test) against your project. The existing database end-to-end suite exercises the legacy mode. Use a dedicated test database for that suite.
