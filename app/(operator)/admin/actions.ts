'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentOperator } from '@/lib/application/operators/current-operator'
import { createCafe } from '@/lib/application/places/create-cafe'
import { setCafePublication } from '@/lib/application/places/set-cafe-publication'
import type { PublicationTransition } from '@/lib/domain/cafe-input'

// Operator mutation surface (Decision 16a — Server Actions are the mutation
// mechanism: thin, validated, authorized). Every action re-resolves the active
// operator server-side; there is no client-trusted authorization. Domain
// validation and effects live in the application use cases — these actions only
// authorize, forward form values, and revalidate the console.

export interface CreateCafeFormState {
  error?: string
}

export async function createCafeAction(
  _prev: CreateCafeFormState,
  formData: FormData,
): Promise<CreateCafeFormState> {
  const operator = await getCurrentOperator()
  if (!operator) redirect('/login')

  const result = await createCafe(
    {
      name: formData.get('name'),
      slug: formData.get('slug'),
      latitude: formData.get('latitude'),
      longitude: formData.get('longitude'),
      address: formData.get('address'),
      neighborhood: formData.get('neighborhood'),
      website: formData.get('website'),
      phone: formData.get('phone'),
    },
    operator.userId,
  )

  if (result.status === 'invalid') return { error: result.message }
  if (result.status === 'slug_taken') return { error: 'That slug is already in use.' }

  revalidatePath('/admin')
  redirect('/admin')
}

async function transition(formData: FormData, target: PublicationTransition): Promise<void> {
  const operator = await getCurrentOperator()
  if (!operator) redirect('/login')
  const placeId = String(formData.get('placeId') ?? '')
  await setCafePublication(placeId, target, operator.userId)
  revalidatePath('/admin')
}

export async function publishCafeAction(formData: FormData): Promise<void> {
  await transition(formData, 'published')
}

export async function hideCafeAction(formData: FormData): Promise<void> {
  await transition(formData, 'hidden')
}
