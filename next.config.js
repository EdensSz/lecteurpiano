/** @type {import('next').NextConfig} */
const nextConfig = {
  // Désactive les warnings ESLint en développement si nécessaire
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
};

module.exports = nextConfig;
