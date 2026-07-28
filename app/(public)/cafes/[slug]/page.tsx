import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CafeDetail } from '@/components/place/cafe-detail'
import { getPublishedCafeBySlug } from '@/lib/application/places/get-published-cafe'

export const dynamic = 'force-dynamic'

export default async function CafePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const cafe = await getPublishedCafeBySlug(slug)
  if (!cafe) notFound()
  return (
    <main>
      <p>
        <Link href="/">← All cafés</Link>
      </p>
      <CafeDetail cafe={cafe} />
    </main>
  )
}
