// [POST] /api/actions
export async function POST(request: Request) {
  const action = await request.json();

  // Here we will handle any actions from the bot
  // For now, just log the action and return success
  console.log("Bot action received:", action);

  return Response.json({ success: true });
} 