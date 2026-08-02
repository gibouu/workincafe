import { describe, expect, it, vi } from 'vitest'

// Enforces the Decision 8 authorization boundary at the mutation surface
// (obligations row "Unauthenticated / non-operator blocked from operator
// actions"): every exported operator Server Action re-resolves the operator
// server-side and, when there is no authenticated + authorized operator,
// redirects to /login WITHOUT invoking any use case. `getCurrentOperator`
// returning null covers both the unauthenticated and the non-operator
// (no active `operators` row) cases — the two are indistinguishable to actions
// by design. New operator action modules must be added to ACTION_MODULES.

const gate = vi.hoisted(() => ({
  getCurrentOperator: vi.fn(async () => null),
}))
const useCases = vi.hoisted(() => ({
  createCafe: vi.fn(),
  setCafePublication: vi.fn(),
  recordAttributeObservation: vi.fn(),
  setCafeHours: vi.fn(),
  decideCandidate: vi.fn(),
  startSeedingRun: vi.fn(),
  getAssistBrief: vi.fn(),
}))

class RedirectSentinel extends Error {
  constructor(readonly url: string) {
    super(`redirect:${url}`)
  }
}

vi.mock('@/lib/application/operators/current-operator', () => ({
  getCurrentOperator: gate.getCurrentOperator,
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new RedirectSentinel(url)
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/application/places/create-cafe', () => ({ createCafe: useCases.createCafe }))
vi.mock('@/lib/application/places/set-cafe-publication', () => ({
  setCafePublication: useCases.setCafePublication,
}))
vi.mock('@/lib/application/attributes/record-attribute-observation', () => ({
  recordAttributeObservation: useCases.recordAttributeObservation,
}))
vi.mock('@/lib/application/hours/set-cafe-hours', () => ({ setCafeHours: useCases.setCafeHours }))
vi.mock('@/lib/application/candidates/decide-candidate', () => ({
  decideCandidate: useCases.decideCandidate,
}))
vi.mock('@/lib/application/candidates/start-seeding-run', () => ({
  startSeedingRun: useCases.startSeedingRun,
}))
vi.mock('@/lib/application/candidates/get-assist-brief', () => ({
  getAssistBrief: useCases.getAssistBrief,
}))

const ACTION_MODULES = [
  '@/app/(operator)/admin/actions',
  '@/app/(operator)/admin/cafes/[id]/actions',
  '@/app/(operator)/gp1/actions',
  '@/app/(operator)/gp1/candidates/[id]/actions',
] as const

describe('operator Server Action authorization boundary', () => {
  for (const modulePath of ACTION_MODULES) {
    it(`${modulePath}: every action redirects to /login and calls no use case`, async () => {
      const mod: Record<string, unknown> = await import(modulePath)
      const actions = Object.entries(mod).filter(
        (entry): entry is [string, (...args: unknown[]) => Promise<unknown>] =>
          typeof entry[1] === 'function',
      )
      expect(actions.length).toBeGreaterThan(0)

      for (const [name, action] of actions) {
        const formData = new FormData()
        // useActionState actions take (prevState, formData); simple commands take
        // (formData). Distinguish by declared arity.
        const args = action.length >= 2 ? [{}, formData] : [formData]
        await expect(action(...args), `${name} must redirect when unauthorized`).rejects.toThrow(
          'redirect:/login',
        )
      }

      for (const [useCase, spy] of Object.entries(useCases)) {
        expect(spy, `${useCase} must not run for an unauthorized caller`).not.toHaveBeenCalled()
      }
    })
  }
})
