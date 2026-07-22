import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSignedUrl } from "@/lib/storage/danfse-storage";

/**
 * Consulta o status de uma geração e, se concluída, uma nova signed URL
 * (a anterior pode ter expirado — TTL curto por design, item 2.3 do MD).
 * A query já é filtrada por escritorio_id via RLS (0002_rls.sql); mesmo
 * que o id de outro tenant seja passado, a linha simplesmente não retorna.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "nao_autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: generation, error } = await supabase
    .from("danfse_generation")
    .select("id, status, erro_detalhe, pdf_storage_ref, criado_em, concluido_em")
    .eq("id", id)
    .maybeSingle();

  if (error || !generation) {
    return NextResponse.json({ error: "geracao_nao_encontrada" }, { status: 404 });
  }

  if (generation.status !== "concluido" || !generation.pdf_storage_ref) {
    return NextResponse.json({
      id: generation.id,
      status: generation.status,
      erroDetalhe: generation.erro_detalhe,
    });
  }

  const signedUrl = await createSignedUrl(supabase, generation.pdf_storage_ref);

  return NextResponse.json({
    id: generation.id,
    status: generation.status,
    signedUrl,
  });
}
