export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    // Async check so Next.js server boots immediately without waiting
    (async () => {
      let connected = false;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const res = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(2000) });
          if (res.ok) {
            console.log(`\x1b[32m✔ [next-app] Successfully connected to backend at ${backendUrl}/health\x1b[0m`);
            connected = true;
            break;
          }
        } catch {
          if (attempt < 4) {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      }
      if (!connected) {
        console.error(
          `\n\x1b[41m\x1b[37m [NEXT-APP STARTUP WARNING] \x1b[0m \x1b[31mBackend is NOT reachable at ${backendUrl}/health\x1b[0m\n` +
          `\x1b[33m👉 Reason: Port 4000 is not responding (ECONNREFUSED).\x1b[0m\n` +
          `\x1b[33m👉 Fix: Start the backend via 'npm run dev:backend' or run everything together with 'npm run dev:all'.\x1b[0m\n`
        );
      }
    })();
  }
}
