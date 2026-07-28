import { sql, type SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { ATTRIBUTE_KINDS, ATTRIBUTE_VALUES } from '@/lib/domain/attributes'

// Shared CHECK-constraint SQL builders. These derive the database constraints
// directly from the pure domain vocabularies so the enforced matrix cannot drift
// from the TypeScript source of truth (Step 3B ruling 1). Values are controlled
// identifiers ([a-z_]); they are quoted as SQL string literals.

function quoteList(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(', ')
}

/** `col IN ('a', 'b', …)` as raw DDL (safe for CHECK constraints). */
export function inList(col: AnyPgColumn, values: readonly string[]): SQL {
  return sql`${col} IN (${sql.raw(quoteList(values))})`
}

/** The kind/value matrix: each kind admits only its own value set. Rejects e.g.
 * (kind = 'wifi', value = 'abundant'). */
export function attributeKindValueMatrix(kindCol: AnyPgColumn, valueCol: AnyPgColumn): SQL {
  const clauses = ATTRIBUTE_KINDS.map(
    (k) => sql`(${kindCol} = ${sql.raw(`'${k}'`)} AND ${inList(valueCol, ATTRIBUTE_VALUES[k])})`,
  )
  return sql.join(clauses, sql` OR `)
}
