/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/admin',
  // Required to allow Namecheap's passenger to pass the correct host/port
  experimental: {
    // any needed experimental features
  }
};

export default nextConfig;
