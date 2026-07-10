/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['avatars.githubusercontent.com'],
  },
  env: {
    AUTHORIZED_EMAILS: process.env.NEXT_PUBLIC_AUTHORIZED_EMAILS || '',
  },
}

module.exports = nextConfig
