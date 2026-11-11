import { connection, type NextRequest } from "next/server";
import { createCategory, errorResponse, getCategories, parseNewCategory, readJson } from "@/lib/turso";

export async function GET() {
  await connection();
  try {
    return Response.json(await getCategories(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const category = await createCategory(parseNewCategory(await readJson(request)));
    return Response.json(category, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
