/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Disable Next.js built-in image optimization globally (Decision 26 / GHSA-f88m
    // sharp/libvips mitigation). WorkinCafe accepts no untrusted image bytes and
    // routes no Google photo media through the optimizer; disabling it means the
    // vulnerable sharp/libvips processing path is never exercised. Enforced by a
    // compliance test — do not remove without a Decision 26 re-review.
    unoptimized: true,
  },
}

export default nextConfig
