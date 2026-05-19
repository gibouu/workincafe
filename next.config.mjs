/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ['ts', 'tsx'],
  // Note: the `eslint` block was removed in Next.js 16 (#153). Linting is
  // now driven by `npm run lint` → `eslint .` via the flat config in
  // eslint.config.mjs. `next build` no longer runs lint internally.
  typescript: {
    ignoreBuildErrors: false,
  },
  typedRoutes: false,
  images: {
    // Review photos live on Cloudinary; configure remotePatterns so we can
    // render them via next/image instead of bare <img>. See #15.
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
    ],
  },
};

export default nextConfig;
