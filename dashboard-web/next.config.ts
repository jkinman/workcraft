/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse / pdfjs-dist use dynamic imports for web workers
  // which break when bundled into chunks. Mark them as external.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
}

export default nextConfig