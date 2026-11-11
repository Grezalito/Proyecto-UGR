import { connection, type NextRequest } from "next/server";
import {
  createProduct,
  deleteProduct,
  errorResponse,
  getProducts,
  parseId,
  parseNewProduct,
  parseProductPatch,
  readJson,
  updateProduct,
} from "@/lib/turso";

export async function GET() {
  await connection();
  try {
    return Response.json(await getProducts(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const product = await createProduct(parseNewProduct(await readJson(request)));
    return Response.json(product, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, patch } = parseProductPatch(await readJson(request));
    const product = await updateProduct(id, patch);
    return product
      ? Response.json(product)
      : Response.json({ error: "Producto no encontrado." }, { status: 404 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = parseId(request.nextUrl.searchParams.get("id"));
    return (await deleteProduct(id))
      ? new Response(null, { status: 204 })
      : Response.json({ error: "Producto no encontrado." }, { status: 404 });
  } catch (err) {
    return errorResponse(err);
  }
}
