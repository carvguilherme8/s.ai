import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSessao } from "@/lib/supabase/server";
import { IconeVoltar } from "../../../icones";

export const metadata = { title: "Material — s.ai" };

export default function LeitorPage({ params, searchParams }: PageProps<"/aluno/materiais/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
        <Conteudo params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const SEM_MARCADOR = /^\s*\[página \d+\]\s*/;

async function Conteudo({
  params,
  searchParams,
}: {
  params: PageProps<"/aluno/materiais/[id]">["params"];
  searchParams: PageProps<"/aluno/materiais/[id]">["searchParams"];
}) {
  await connection();
  const { id } = await params;
  const { p } = await searchParams;
  const destaque = typeof p === "string" && /^\d+$/.test(p) ? Number(p) : null;

  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");
  if (sessao.profile.papel !== "aluno") redirect("/");
  const { supabase } = sessao;

  // O RLS só devolve materiais e trechos da turma do aluno.
  const { data: material } = await supabase
    .from("materiais")
    .select("id, titulo, tipo, disciplina, storage_path, conteudo_texto")
    .eq("id", id)
    .maybeSingle();
  if (!material) notFound();

  const { data: trechos } = await supabase
    .from("material_trechos")
    .select("ordem, pagina, conteudo")
    .eq("material_id", id)
    .order("ordem");

  // PDF original: link temporário (1 hora) gerado com a sessão do próprio aluno.
  let urlPdf: string | null = null;
  if (material.tipo === "pdf" && material.storage_path) {
    const { data } = await supabase.storage.from("materiais").createSignedUrl(material.storage_path, 3600);
    urlPdf = data?.signedUrl ?? null;
  }

  // Junta trechos seguidos da mesma página; sem trechos, usa o texto inteiro.
  type Bloco = { pagina: number | null; paragrafos: string[] };
  const blocos: Bloco[] = [];
  const fontes = trechos?.length
    ? trechos.map((t) => ({ pagina: t.pagina, texto: t.conteudo }))
    : [{ pagina: null as number | null, texto: material.conteudo_texto ?? "" }];
  for (const f of fontes) {
    const paragrafos = f.texto.split(/\n{2,}/).map((x) => x.replace(SEM_MARCADOR, "").trim()).filter(Boolean);
    const ultimo = blocos.at(-1);
    if (ultimo && ultimo.pagina === f.pagina) ultimo.paragrafos.push(...paragrafos);
    else blocos.push({ pagina: f.pagina, paragrafos });
  }

  return (
    <>
      <Link href="/aluno/materiais" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <IconeVoltar /> Materiais
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{material.titulo}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        {material.disciplina && <span className="badge badge-neutral">{material.disciplina}</span>}
        {material.tipo === "pdf" ? "PDF" : "Texto"}
      </p>

      {urlPdf && (
        <a href={urlPdf} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm mt-4">
          Baixar o PDF original
        </a>
      )}

      <div className="mt-8 space-y-8">
        {blocos.length === 0 && <p className="text-sm text-muted">Este material não tem texto para exibir.</p>}
        {blocos.map((b, i) => {
          const marcada = destaque !== null && b.pagina === destaque;
          return (
            <section
              key={`${b.pagina}-${i}`}
              id={b.pagina !== null ? `p${b.pagina}` : undefined}
              className={`scroll-mt-24 rounded-xl ${marcada ? "bg-warn-soft p-5" : ""}`}
            >
              {b.pagina !== null && (
                <h2 className="mb-2 text-xs font-medium text-muted">
                  Página {b.pagina}
                  {marcada && <span className="grifo ml-2">trecho para revisar</span>}
                </h2>
              )}
              <div className="max-w-prose space-y-3 text-[0.9375rem] leading-relaxed">
                {b.paragrafos.map((par, j) => (
                  <p key={j} className="whitespace-pre-wrap">{par}</p>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
