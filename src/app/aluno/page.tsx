import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSessao } from "@/lib/supabase/server";
import { LIMIAR_LACUNA, MIN_QUESTOES } from "@/lib/diagnostico";
import { sair } from "../auth/actions";
import { Bolinhas } from "../bolinhas";
import { IconeSair } from "../icones";

const pct = (d: number) => `${Math.round(d * 100)}%`;

export const metadata = { title: "Minhas atividades — s.ai" };

export default function AlunoPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
        <Conteudo />
      </Suspense>
    </main>
  );
}

async function Conteudo() {
  await connection();
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");
  if (sessao.profile.papel !== "aluno") redirect("/");
  const { supabase, profile } = sessao;

  const [{ data: turma }, { data: atividades }, { data: entregas }, { data: respostas }] = await Promise.all([
    supabase.from("turmas").select("nome").eq("id", profile.turma_id!).maybeSingle(),
    supabase.from("atividades").select("id, titulo, prazo, publicada_em").eq("status", "publicada")
      .order("publicada_em", { ascending: false }),
    supabase.from("entregas").select("atividade_id, enviada_em"),
    // O RLS já limita às respostas deste aluno.
    supabase.from("respostas").select("nota_ia, nota_ajustada, questao:questoes(topico:topicos(id, nome))"),
  ]);
  const entregues = new Set(entregas?.map((e) => e.atividade_id));

  // Domínio do próprio aluno por tópico (mesma regra do Diagnóstico da professora).
  const porTopico = new Map<string, { nome: string; notas: number[] }>();
  for (const r of respostas ?? []) {
    const t = r.questao?.topico;
    const nota = r.nota_ajustada ?? r.nota_ia;
    if (!t || nota === null) continue;
    (porTopico.get(t.id) ?? porTopico.set(t.id, { nome: t.nome, notas: [] }).get(t.id)!).notas.push(Number(nota));
  }
  const dominio = [...porTopico.entries()]
    .map(([id, t]) => {
      const dom = t.notas.reduce((a, b) => a + b, 0) / t.notas.length;
      return { id, nome: t.nome, dominio: dom, respondidas: t.notas.length, acertos: t.notas.filter((n) => n >= 1).length, lacuna: t.notas.length >= MIN_QUESTOES && dom < LIMIAR_LACUNA };
    })
    .sort((a, b) => a.dominio - b.dominio);

  return (
    <>
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Olá, {profile.nome}</h1>
          <p className="text-sm text-muted">Turma {turma?.nome}</p>
        </div>
        <form action={sair}>
          <button className="btn btn-secondary btn-sm">Sair <IconeSair /></button>
        </form>
      </header>

      <h2 className="mb-3 font-display text-xl font-bold">Atividades</h2>
      <ul className="space-y-2">
        {atividades?.map((a) => {
          const feita = entregues.has(a.id);
          const encerrada = !feita && a.prazo && new Date(a.prazo) < new Date();
          return (
            <li key={a.id}>
              <Link
                href={`/aluno/atividades/${a.id}`}
                className="card flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-sunken"
              >
                <span>
                  <span className="font-medium">{a.titulo}</span>
                  {a.prazo && (
                    <span className="ml-2 text-sm text-muted">prazo {new Date(a.prazo).toLocaleDateString("pt-BR")}</span>
                  )}
                </span>
                <span className={`badge ${feita ? "badge-ok" : encerrada ? "badge-neutral" : "badge-warn"}`}>
                  {feita ? "entregue" : encerrada ? "encerrada" : "a fazer"}
                </span>
              </Link>
            </li>
          );
        })}
        {atividades?.length === 0 && (
          <li className="text-sm text-muted">Nenhuma atividade publicada para sua turma ainda.</li>
        )}
      </ul>

      {dominio.length > 0 && (
        <section aria-labelledby="h-dominio" className="mt-12">
          <h2 id="h-dominio" className="mb-1 font-display text-xl font-bold">Seu domínio por tópico</h2>
          <p className="mb-4 text-sm text-muted">
            Onde você já vai bem e o que vale revisar. Abaixo de {pct(LIMIAR_LACUNA)} é o sinal para revisar.
          </p>
          <ul className="space-y-2">
            {dominio.map((t) => (
              <li key={t.id} className="card flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{t.lacuna ? <span className="grifo">{t.nome}</span> : t.nome}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {t.acertos} de {t.respondidas} {t.respondidas === 1 ? "certa" : "certas"}
                    {t.lacuna && " · vale revisar"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-display text-xl font-bold tabular-nums ${t.lacuna ? "text-danger" : ""}`}>{pct(t.dominio)}</p>
                  <Bolinhas valor={t.dominio} className={`mt-1 ${t.lacuna ? "text-danger" : "text-ok"}`} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
