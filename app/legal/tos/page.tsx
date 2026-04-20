export const metadata = { title: 'Terms of Service · Work in Cafe' };

export default function TermsPage() {
  return (
    <article className="prose max-w-none">
      <h1 className="text-[28px] font-bold">Terms of Service</h1>
      <p className="text-[13px] text-[var(--text-secondary)]">
        Last updated — {new Date().toISOString().slice(0, 10)}
      </p>

      <h2 className="mt-6 text-[20px] font-semibold">The short version</h2>
      <ul className="mt-2 list-disc pl-5">
        <li>Be honest in reviews. Reviews outside 150 m of the place will be rejected.</li>
        <li>Don&apos;t spam, harass, or submit anything you don&apos;t have rights to post.</li>
        <li>Moderation is at our discretion. Hidden reviews and banned accounts happen.</li>
      </ul>

      <h2 className="mt-6 text-[20px] font-semibold">UGC license</h2>
      <p className="mt-2">
        You keep ownership of your reviews and ratings, and grant Work in Cafe a worldwide,
        royalty-free license to display them within the app and in aggregate analytics (for
        example, noise heat-maps, rating averages).
      </p>

      <h2 className="mt-6 text-[20px] font-semibold">Attribution</h2>
      <p className="mt-2">
        Maps © Apple. Place data © OpenStreetMap contributors under the{' '}
        <a
          className="text-accent underline"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Database License
        </a>
        .
      </p>

      <h2 className="mt-6 text-[20px] font-semibold">No warranty</h2>
      <p className="mt-2">
        Place info, hours, Wi-Fi speeds, and noise levels come from OSM and from other users. We
        do our best but offer no warranty that any given place is open, has seats, or welcomes a
        four-hour laptop siege. Call ahead.
      </p>

      <h2 className="mt-6 text-[20px] font-semibold">Changes</h2>
      <p className="mt-2">
        We&apos;ll post updates to these terms on this page. Material changes get a notice in the app.
      </p>
    </article>
  );
}
