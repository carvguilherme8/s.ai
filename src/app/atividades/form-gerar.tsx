"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { gerarAtividade, type EstadoForm } from "./actions";

const campo = "field";

type Material = {
  id: string;
  titulo: string;
  turma_id: string;
  topicos: { id: string; nome: string }[];
};

export function FormGerar({
  materiais,
  turmas,
  topicosExistentes,
}: {
  materiais: Material[];
  turmas: { id: string; nome: string }[];
  topicosExistentes: string[];
}) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(gerarAtividade, undefined);
  const prontos = materiais.filter((m) => m.topicos.length > 0);

  const [modo, setModo] = useState<"material" | "tema">(() => (prontos.length > 0 ? "material" : "tema"));
  const [materialId, setMaterialId] = useState(prontos[0]?.id ?? "");
  const materialAtual = prontos.find((m) => m.id === materialId) ?? prontos[0];
  const [selecionados, setSelecionados] = useState<string[]>(() => materialAtual?.topicos.map((t) => t.id) ?? []);

  if (!turmas.length) {
    return (
      <p className="rounded-xl border border-dashed border-line-strong p-4 text-sm text-muted">
        Antes de gerar uma atividade, crie pelo menos uma turma em{" "}
        <Link href="/turmas" className="underline">Turmas</Link>.
      </p>
    );
  }

  const idsAtuais = new Set(materialAtual?.topicos.map((t) => t.id) ?? []);
  const ativos = selecionados.filter((id) => idsAtuais.has(id));
  const todosMarcados = !!materialAtual && ativos.length === materialAtual.topicos.length;

  function trocarMaterial(novoId: string) {
    setMaterialId(novoId);
    const mat = prontos.find((m) => m.id === novoId);
    setSelecionados(mat ? mat.topicos.map((t) => t.id) : []);
  }

  function alternarTopico(id: string) {
    setSelecionados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  const semMaterialPronto = modo === "material" && (!prontos.length || !materialAtual);

  return (
    <form action={acao} className="card space-y-4 p-4">
      <input type="hidden" name="modo" value={modo} />

      <div role="group" aria-label="Origem das questões" className="flex flex-wrap gap-2">
        {(
          [
            { id: "material", rotulo: "A partir de um material" },
            { id: "tema", rotulo: "Por tema digitado" },
          ] as const
        ).map((op) => {
          const ativo = modo === op.id;
          return (
            <button
              key={op.id}
              type="button"
              aria-pressed={ativo}
              onClick={() => setModo(op.id)}
              className={`inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3.5 text-sm transition-colors ${
                ativo
                  ? "border-ink bg-hl font-semibold text-hl-ink"
                  : "border-line-strong bg-surface text-ink hover:bg-sunken"
              }`}
            >
              {op.rotulo}
            </button>
          );
        })}
      </div>

      {semMaterialPronto ? (
        <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-muted">
          Nenhum material com tópico confirmado ainda. Envie um material em{" "}
          <Link href="/materiais" className="underline">Materiais</Link> ou troque para{" "}
          <button type="button" onClick={() => setModo("tema")} className="font-medium text-link hover:underline">
            Por tema digitado
          </button>
          .
        </p>
      ) : (
        <>
          <input
            name="titulo"
            placeholder={
              modo === "tema"
                ? "Título da atividade (ex.: Lista — Revolução Industrial)"
                : "Título da atividade (ex.: Lista 1 — Leis de Newton)"
            }
            maxLength={120}
            required
            className={campo}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {modo === "material" && materialAtual ? (
              <label className="text-sm text-muted">
                Material
                <select
                  name="material_id"
                  value={materialAtual.id}
                  onChange={(e) => trocarMaterial(e.target.value)}
                  required
                  className={`${campo} mt-1`}
                >
                  {prontos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.titulo} ({m.topicos.length} {m.topicos.length === 1 ? "tópico" : "tópicos"})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="text-sm text-muted">
                Tema (tópico no Diagnóstico)
                <input
                  name="tema"
                  list={topicosExistentes.length ? "topicos-existentes" : undefined}
                  placeholder="Ex.: Função do 2º grau — vértice"
                  minLength={3}
                  maxLength={100}
                  required
                  className={`${campo} mt-1`}
                />
                {topicosExistentes.length > 0 && (
                  <datalist id="topicos-existentes">
                    {topicosExistentes.map((nome) => (
                      <option key={nome} value={nome} />
                    ))}
                  </datalist>
                )}
              </label>
            )}

            <label className="text-sm text-muted">
              Turma
              <select name="turma_id" required className={`${campo} mt-1`}>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </label>

            <label className="text-sm text-muted">
              {modo === "material" ? "Múltipla escolha por tópico" : "Questões de múltipla escolha"}
              <input type="number" name="mc_por_topico" min={0} max={5} defaultValue={3} className={`${campo} mt-1`} />
            </label>
            <label className="text-sm text-muted">
              Dissertativas (no total)
              <input type="number" name="dissertativas" min={0} max={3} defaultValue={1} className={`${campo} mt-1`} />
            </label>
          </div>

          {modo === "material" && materialAtual ? (
            <fieldset className="space-y-2 rounded-lg bg-sunken p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <legend className="text-xs font-semibold text-muted">
                  Tópicos incluídos ({ativos.length} de {materialAtual.topicos.length})
                </legend>
                {materialAtual.topicos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelecionados(todosMarcados ? [] : materialAtual.topicos.map((t) => t.id))}
                    className="text-xs font-medium text-link hover:underline"
                  >
                    {todosMarcados ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                )}
              </div>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {materialAtual.topicos.map((t) => {
                  const marcado = ativos.includes(t.id);
                  return (
                    <li key={t.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface">
                        <input
                          type="checkbox"
                          name="topico_ids"
                          value={t.id}
                          checked={marcado}
                          onChange={() => alternarTopico(t.id)}
                          className="h-4 w-4 shrink-0"
                        />
                        <span className="min-w-0 truncate">{t.nome}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm text-muted">
                Orientações para a IA (opcional)
                <textarea
                  name="orientacoes"
                  rows={2}
                  maxLength={500}
                  placeholder="Ex.: focar em interpretação de gráficos, situações do cotidiano ou nível introdutório."
                  className={`${campo} mt-1`}
                />
              </label>
              <p className="text-xs text-muted">
                O tema digitado vira um Tópico no Diagnóstico (ou reaproveita um tópico já existente com o mesmo nome).
              </p>
            </div>
          )}

          <button
            disabled={pendente || (modo === "material" && ativos.length === 0)}
            className="btn btn-primary"
          >
            {pendente ? "Gerando questões…" : "Gerar questões com IA"}
          </button>
          {pendente && <p className="text-sm text-muted">A IA está elaborando as questões; pode levar um ou dois minutos.</p>}
          {estado?.erro && <p role="alert" className="text-sm text-danger">{estado.erro}</p>}
        </>
      )}
    </form>
  );
}
