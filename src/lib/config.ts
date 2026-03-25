// Worker URL is the only static config needed
// All other config (domains, site name, etc.) is loaded dynamically from Worker
export const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787";
