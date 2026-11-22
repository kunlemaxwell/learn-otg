import { clearComponents, deleteComponent, listComponents } from "@/lib/component-library";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ components: listComponents() });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (id) deleteComponent(id);
  else clearComponents();
  return Response.json({ ok: true });
}
