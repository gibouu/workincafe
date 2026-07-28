import 'server-only'

// Server-only entry point for the Better Auth instance. App code (route
// handlers, server actions, server components) imports the auth instance from
// here so the `server-only` guard applies; `lib/auth/config.ts` omits that
// import solely because the Better Auth CLI cannot parse it during schema
// generation. See config.ts.
export { auth } from './config'
