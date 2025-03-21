// [POST] /api/connect
export async function POST(request: Request) {
  const { services, config, api_keys } = await request.json();

  if (!services || !config || !process.env.DAILY_API_KEY) {
    return Response.json("Services or config not found on request body", {
      status: 400,
    });
  }

  // Extract and process API keys
  const apiKeysToSend = {
    ...(api_keys || {}),
  };

  // Add Gemini API key if Gemini LLM is being used
  if (services.llm === 'gemini' && process.env.GEMINI_API_KEY) {
    apiKeysToSend.gemini = process.env.GEMINI_API_KEY;
  }

  const payload = {
    bot_profile: "voice_2024_10",
    max_duration: 600,
    services,
    api_keys: apiKeysToSend,
    config,
  };

  const req = await fetch(process.env.DAILY_BOTS_URL || "https://api.daily.co/v1/bots/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const res = await req.json();

  if (req.status !== 200) {
    return Response.json(res, { status: req.status });
  }

  return Response.json(res);
} 