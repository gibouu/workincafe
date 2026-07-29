import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentOperator } from '@/lib/application/operators/current-operator'
import { CreateCafeForm } from './create-cafe-form'

export const dynamic = 'force-dynamic'

export default async function NewCafePage() {
  const operator = await getCurrentOperator()
  if (!operator) redirect('/login')

  return (
    <main>
      <div className="op-header">
        <h1>New café</h1>
        <Link href="/admin">← Back to console</Link>
      </div>
      <p className="empty-state">
        Creates a draft record. Publish it from the console once curated.
      </p>
      <CreateCafeForm />
    </main>
  )
}
