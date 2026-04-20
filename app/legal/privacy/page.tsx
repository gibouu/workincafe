export const metadata = { title: 'Privacy Policy · Work in Cafe' };

export default function PrivacyPage() {
  return (
    <article className="prose max-w-none">
      <h1 className="text-[28px] font-bold">Privacy Policy</h1>
      <p className="text-[13px] text-[var(--text-secondary)]">
        Last updated — {new Date().toISOString().slice(0, 10)}
      </p>

      <h2 className="mt-6 text-[20px] font-semibold">What we collect</h2>
      <ul className="mt-2 list-disc pl-5">
        <li>Account: email, display name, avatar URL from your Google or Apple sign-in.</li>
        <li>Location: only when you grant permission, for nearby-place search and geo-verified reviews / check-ins. We do not track you in the background.</li>
        <li>Reviews, ratings, check-ins, Wi-Fi speed tests, and ambient decibel samples you voluntarily submit.</li>
        <li>Aggregate map usage (zoom, pan, tile requests) via PostHog.</li>
        <li>Error reports via Sentry.</li>
      </ul>

      <h2 className="mt-6 text-[20px] font-semibold">What we never collect</h2>
      <ul className="mt-2 list-disc pl-5">
        <li>Raw audio — decibel tests are processed in your browser and only the aggregate dB number is sent.</li>
        <li>Background location.</li>
        <li>Contacts, photos, or anything else your OS would prompt for separately.</li>
      </ul>

      <h2 className="mt-6 text-[20px] font-semibold">Where it lives</h2>
      <p className="mt-2">
        Supabase (EU region) for user data, reviews, and place submissions. Apple MapKit JS handles
        map tiles. OpenStreetMap contributors provide baseline place data. Vercel hosts the app.
      </p>

      <h2 className="mt-6 text-[20px] font-semibold">Your rights (GDPR)</h2>
      <p className="mt-2">
        Export or delete your data from your profile page. We respond to data requests within 30 days.
      </p>

      <h2 className="mt-6 text-[20px] font-semibold">Contact</h2>
      <p className="mt-2">
        Questions? Email{' '}
        <a className="text-accent underline" href="mailto:privacy@workin.cafe">
          privacy@workin.cafe
        </a>
        .
      </p>
    </article>
  );
}
