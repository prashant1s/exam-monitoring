export async function register() {
  // Only in the Node.js server runtime — not Edge (middleware) or the browser.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}
