// Narrow helpers for interpreting PostgreSQL driver errors. Drizzle wraps the
// underlying `pg` error, so the SQLSTATE code and constraint name may live on
// the error itself or on its `cause`. Application code uses these to turn an
// expected integrity violation into a typed result instead of a thrown 500.

interface PgErrorShape {
  code?: string
  constraint?: string
  cause?: { code?: string; constraint?: string }
}

/** True for a unique-violation (SQLSTATE 23505), optionally on a named constraint. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = error as PgErrorShape
  const code = e.code ?? e.cause?.code
  if (code !== '23505') return false
  if (constraint === undefined) return true
  return (e.constraint ?? e.cause?.constraint) === constraint
}
