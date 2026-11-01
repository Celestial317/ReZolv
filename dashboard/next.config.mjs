const API_URL = process.env.API_URL || "http://localhost:8000";

/** @type {import('next').NextConfig} */
export default {
  // NEXT_DIST_DIR lets a second build run next to a running dev server without sharing its cache.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
};
