'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentOperator } from '@/lib/application/operators/current-operator'
import { decideCandidate } from '@/lib/application/candidates/decide-candidate'

// GP-1 review decision action (Decision 16a — thin, validated, authorized;
// Decision 9 — human review; approval creates a draft, never a publication).
// Re-resolves the operator server-side; forwards raw form values to the single
// use case; maps expected outcomes to form errors.

export interface DecisionFormState {
  error?: string
}

export async function decideCandidateAction(
  _prev: DecisionFormState,
  formData: FormData,
): Promise<DecisionFormState> {
  const operator = await getCurrentOperator()
  if (!operator) redirect('/login')

  const result = await decideCandidate(
    {
      candidateId: formData.get('candidateId'),
      decision: formData.get('decision'),
      reasonCode: formData.get('reasonCode'),
      note: formData.get('note'),
      matchedGersId: formData.get('matchedGersId'),
      name: formData.get('name'),
      slug: formData.get('slug'),
      latitude: formData.get('latitude'),
      longitude: formData.get('longitude'),
    },
    operator.userId,
  )

  switch (result.status) {
    case 'invalid':
      return { error: result.message }
    case 'not_reviewable':
      return { error: 'This candidate is not reviewable (already decided or missing).' }
    case 'match_not_found':
      return { error: 'The selected Overture record no longer exists — search again.' }
    case 'slug_taken':
      return { error: 'That slug is already in use.' }
    case 'overture_already_linked':
      return {
        error:
          'That Overture record is already linked to an existing café — likely a duplicate; reject it as such.',
      }
  }

  revalidatePath('/gp1')
  if (result.createdPlaceId) {
    // Approved: continue straight into curating the new draft café.
    redirect(`/admin/cafes/${result.createdPlaceId}`)
  }
  redirect('/gp1')
}
