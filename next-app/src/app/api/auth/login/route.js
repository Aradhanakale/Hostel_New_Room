export async function POST(request) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: 'INVALID_JSON', message: 'Invalid JSON request body.' },
      },
      { status: 400 }
    );
  }

  try {
    const backendRes = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    const data = await backendRes.json().catch(() => null);
    if (!data) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'BACKEND_EMPTY_RESPONSE',
            message: 'Backend server returned an invalid or empty response.',
          },
        },
        { status: backendRes.status || 502 }
      );
    }

    return Response.json(data, { status: backendRes.status });
  } catch (err) {
    console.error(`\x1b[31m[next-app /api/auth/login] Connection refused to backend at ${backendUrl}\x1b[0m`);
    return Response.json(
      {
        success: false,
        error: {
          code: 'BACKEND_UNAVAILABLE',
          message:
            'Backend server is not running or unreachable on port 4000. Please start it using "npm run dev:backend" or "npm run dev:all".',
        },
      },
      { status: 503 }
    );
  }
}
