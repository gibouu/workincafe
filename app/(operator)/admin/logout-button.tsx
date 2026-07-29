'use client'

import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth/client'

export function LogoutButton() {
  const router = useRouter()
  async function signOut() {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }
  return (
    <button type="button" onClick={signOut}>
      Sign out
    </button>
  )
}
