import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { IconeVoltar } from "../../icones";

export const metadata = { title: "Material — s.ai" };

const SEM_MARCADOR = /^\s*\[página \d+\]\s*/;

export default function MaterialDetalhePage({ params }: PageProps<"/materiais/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
        <Conteudo params={params} />
      </Suspense>
    </main>
  );
}

async function Conteudo({ params }: { params: PageProps<"/materiais/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const { supabase, professor } = await getProfessorAtual();

  const { data: material } = await supabase
    .from("materiais")
    .select(
      `id, titulo, tipo, disciplina, storage_path, conteudo_texto,
       turma:turmas(nome),
       topicos(id, nome, confirmado)`,
    )
    .eq("id", id)
    .eq("professor_id", professor.id)
    .maybeSingle();
  if (!material) notFound();

  const { data: trechos } = await supabase
    .from("material_trechos")
    .select("ordem, pagina, conteudo")
    .eq("material_id", id)
    .order("ordem");

  let urlPdf: string | null = null;
  if (material.tipo === "pdf" && material.storage_path) {
    const { data } = await supabase.storage.from("materiais").createSignedUrl(material.storage_path, 3600);
    urlPdf = data?.signedUrl ?? null;
  }

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
      <Link href="/materiais" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <IconeVoltar /> Materiais
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">{material.titulo}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        {material.disciplina && <span className="badge badge-neutral">{material.disciplina}</span>}
        <span>{material.tipo === "pdf" ? "PDF" : "Texto"}</span>
        {material.turma?.nome && <span>· {material.turma.nome}</span>}
      </p>

      {material.topicos.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Tópicos do material">
          {material.topicos.map((t) => (
            <li key={t.id} className={`badge ${t.confirmado ? "badge-neutral" : "badge-warn"}`}>
              {t.nome}
            </li>
          ))}
        </ul>
      )}

      {urlPdf && (
        <a href={urlPdf} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm mt-5">
          Abrir / baixar PDF original
        </a>
      )}

      <div className="mt-8 space-y-8">
        {blocos.length === 0 && <p className="text-sm text-muted">Este material não tem texto para exibir.</p>}
        {blocos.map((b, i) => (
          <section key={`${b.pagina}-${i}`} id={b.pagina !== null ? `p${b.pagina}` : undefined}>
            {b.pagina !== null && (
              <h2 className="mb-2 text-xs font-medium text-muted">Página {b.pagina}</h2>
            )}
            <div className="max-w-prose space-y-3 text-[0.9375rem] leading-relaxed">
              {b.paragrafos.map((par, j) => (
                <p key={j} className="whitespace-pre-wrap">{par}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
