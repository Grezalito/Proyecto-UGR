import { connection, type NextRequest } from "next/server";
import {
  deleteChatMessage,
  errorResponse,
  getChatMessages,
  parseId,
  parseNewChatMessage,
  readJson,
  sendChatMessage,
} from "@/lib/turso";

const LIMIT = 30;

export async function GET() {
  await connection();
  try {
    return Response.json(await getChatMessages(LIMIT), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const msg = await sendChatMessage(parseNewChatMessage(await readJson(request)));
    return Response.json(msg, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = parseId(request.nextUrl.searchParams.get("id"));
    return (await deleteChatMessage(id))
      ? new Response(null, { status: 204 })
      : Response.json({ error: "Mensaje no encontrado." }, { status: 404 });
  } catch (err) {
    return errorResponse(err);
  }
}
