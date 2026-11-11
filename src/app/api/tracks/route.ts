import { connection, type NextRequest } from "next/server";
import { createTrack, deleteTrack, errorResponse, getTracks, parseId, parseNewTrack, readJson } from "@/lib/turso";

export async function GET() {
  await connection();
  try {
    return Response.json(await getTracks(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const track = await createTrack(parseNewTrack(await readJson(request)));
    return Response.json(track, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = parseId(request.nextUrl.searchParams.get("id"));
    return (await deleteTrack(id))
      ? new Response(null, { status: 204 })
      : Response.json({ error: "Pista no encontrada." }, { status: 404 });
  } catch (err) {
    return errorResponse(err);
  }
}
