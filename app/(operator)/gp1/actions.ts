'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentOperator } from '@/lib/application/operators/current-operator'
import { startSeedingRun } from '@/lib/application/candidates/start-seeding-run'

// GP-1 seeding action (Decision 9 — operator-initiated only; this explicit
// gesture is the ONLY trigger for a seeding run). Thin, authorized, validated
// (Decision 16a); the use case owns template validation, quota-bounded
// execution, per-attempt accounting, and the fail-closed no-key path.

export interface SeedingFormState {
  error?: string
  summary?: string
}

export async function runSeedingAction(
  _prev: SeedingFormState,
  formData: FormData,
): Promise<SeedingFormState> {
  const operator = await getCurrentOperator()
  if (!operator) redirect('/login')

  const result = await startSeedingRun(String(formData.get('templateId') ?? ''), operator.userId)

  switch (result.status) {
    case 'invalid_template':
      return { error: 'Unknown query template.' }
    case 'unavailable':
      return {
        error:
          'Seeding is unavailable: the server Places key is not configured in this environment.',
      }
    case 'failed':
      return {
        error: `Seeding run failed (recorded; ${result.attempts} attempt(s) accounted). It was not retried — check the run history and Google Cloud console before running again.`,
      }
  }

  revalidatePath('/gp1')
  return {
    summary: `Run complete: ${result.placeIdsReturned} Place ID(s) returned, ${result.candidatesInserted} new candidate(s) queued (${result.attempts} attempt(s) accounted).`,
  }
}
