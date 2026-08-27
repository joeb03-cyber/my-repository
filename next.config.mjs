/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Only apply rewrites if NEXT_PUBLIC_MESSAGES_URL is defined
    if (process.env.NEXT_PUBLIC_MESSAGES_URL) {
      return [
        {
          source: '/messages',
          destination: `${process.env.NEXT_PUBLIC_MESSAGES_URL}/messages`,
        },
        {
          source: '/messages/:path*',
          destination: `${process.env.NEXT_PUBLIC_MESSAGES_URL}/messages/:path*`,
        },
      ];
    }
    return [];
  },
  async redirects() {
    // The prototype owns the root and canonical application routes.
    // The existing implementation remains available at /notes.
    return [];
  },
};

export default nextConfig;
