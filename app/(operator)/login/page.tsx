import { redirect } from 'next/navigation'
import { getCurrentOperator } from '@/lib/application/operators/current-operator'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const operator = await getCurrentOperator()
  if (operator) redirect('/admin')
  return (
    <main>
      <h1>Operator sign-in</h1>
      <p className="empty-state">WorkinCafe curation console — operators only.</p>
      <LoginForm />
    </main>
  )
}
