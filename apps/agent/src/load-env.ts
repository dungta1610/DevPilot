/**
 * Side-effect module: load `.env` into process.env before any config is read.
 * Imported first in index.ts so the (eagerly-evaluated) config picks it up.
 * Uses Node's built-in loader — no dotenv dependency.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env file present — fall back to the ambient environment.
}
