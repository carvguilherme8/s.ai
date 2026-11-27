"use client";

import { useActionState, useState } from "react";
import {
  calcularNotaDeterministica,
  penalidadesEfetivas,
  type CorrecaoDissertativaV2,
  type OverridesProfessor,
  type RegrasGlobaisProva,
  type RubricaV2,
  type StatusCriterio,
} from "@/lib/nota-rubrica";
import type { TelemetriaResumo } from "@/lib/revisao-dissertativas";
import {
  alternarDesconsiderarEntrega,
  alternarPilulaResposta,
  liberarEntregasAtividade,
  type EstadoNota,
  type EstadoResumo,
} from "./actions";
import { IconeCheck, IconeX } from "../icones";

const PROXIMO_STATUS: Record<StatusCriterio, StatusCriterio> = {
  atendido: "parcial",
  parcial: "nao_atendido",
  nao_atendido: "atendido",
};

const fmt10 = (pct: number) =>
  (Math.round(pct) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function PilulasRevisao({
  respostaId,
  entregaId,
  rubrica,
  regrasGlobais,
  correcaoV2,
  telemetria,
  revisadaEm,
  aguardandoLiberacao,
  desconsiderada,
}: {
  respostaId: string;
  entregaId: string;
  rubrica: RubricaV2;
  regrasGlobais: RegrasGlobaisProva;
  correcaoV2: CorrecaoDissertativaV2;
  telemetria: TelemetriaResumo | null;
  revisadaEm: string | null;
  aguardandoLiberacao?: boolean;
  desconsiderada?: boolean;
}) {
  const [overrides, setOverrides] = useState<OverridesProfessor>(() => correcaoV2.overrides_professor ?? {});
  const [comentario, setComentario] = useState(correcaoV2.overrides_professor?.comentario_professor ?? "");
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const [estadoSalvar, acaoSalvar, salvando] = useActionState<EstadoNota, FormData>(alternarPilulaResposta, undefined);
  const [estadoDesc, acaoDesc, salvandoDesc] = useActionState<EstadoResumo, FormData>(
    alternarDesconsiderarEntrega,
    undefined,
  );
  const [estadoLib, acaoLib, liberando] = useActionState<EstadoResumo, FormData>(liberarEntregasAtividade, undefined);

  const overridesComComent: OverridesProfessor = {
    ...overrides,
    comentario_professor: comentario.trim() || null,
  };

  // Cálculo instantâneo no cliente (<1ms) idêntico ao do servidor!
  const preview = calcularNotaDeterministica(rubrica, correcaoV2.avaliacao_ia, regrasGlobais, overridesComComent);
  const penAtivas = penalidadesEfetivas(rubrica, regrasGlobais);
  const avCritPorId = new Map(correcaoV2.avaliacao_ia.criterios.map((c) => [c.criterio_id, c]));
  const avPenPorId = new Map(correcaoV2.avaliacao_ia.penalidades.map((p) => [p.penalidade_id, p]));

  function salvarAgora(proxOverrides: OverridesProfessor) {
    setOverrides(proxOverrides);
    const fd = new FormData();
    fd.set("resposta_id", respostaId);
    fd.set("overrides_json", JSON.stringify({ ...proxOverrides, comentario_professor: comentario.trim() || null }));
    acaoSalvar(fd);
  }

  function clicarPositivo(critId: string) {
    const atual: StatusCriterio =
      overrides.criterios?.[critId] ?? avCritPorId.get(critId)?.status ?? "nao_atendido";
    const proximo = PROXIMO_STATUS[atual];
    salvarAgora({
      ...overrides,
      criterios: { ...overrides.criterios, [critId]: proximo },
    });
  }

  function clicarPenalidade(penId: string) {
    const atual = overrides.penalidades?.[penId] ?? avPenPorId.get(penId)?.acionada ?? false;
    salvarAgora({
      ...overrides,
      penalidades: { ...overrides.penalidades, [penId]: !atual },
    });
  }

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3 text-xs">
      {/* Alertas de integridade cognitiva, confiança ou ECF */}
      {(telemetria?.sinal_cola || preview.precisa_revisao || desconsiderada) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {desconsiderada && <span className="badge badge-danger">Desconsiderada no Diagnóstico</span>}
          {telemetria?.sinal_cola && (
            <span
              className="badge badge-warn"
              title={`Colou ${telemetria.paste_chars ?? 0} de ${telemetria.total_chars ?? 0} caracteres em ${telemetria.tempo_segundos ?? 0}s`}
            >
              Texto colado externamente ({telemetria.paste_chars ?? 0} chars / {telemetria.tempo_segundos ?? 0}s) — vale conferir
            </span>
          )}
          {preview.motivos_revisao.slice(0, 2).map((m) => (
            <span key={m} className="rounded bg-hl/70 px-2 py-0.5 font-medium text-hl-ink">
              {m}
            </span>
          ))}
        </div>
      )}

      {/* Cabeçalho com nota calculada ao vivo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          Nota:{" "}
          <strong className="font-display text-lg font-bold tabular-nums text-ink">
            {fmt10(preview.percentual)}/10
          </strong>{" "}
          <span className="text-xs text-muted">({Math.round(preview.percentual)}%)</span>
          {preview.teto_aplicado !== null && (
            <span className="ml-2 badge badge-danger">Teto {preview.teto_aplicado}% aplicado</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-muted">
          <span>Clique em uma pílula para alternar e recalcular sem IA</span>
          {revisadaEm && <span className="badge badge-ok">Revisada</span>}
        </div>
      </div>

      {/* Pílulas clicáveis */}
      <div className="flex flex-wrap gap-2">
        {rubrica.positivos.map((c) => {
          const av = avCritPorId.get(c.id);
          const status: StatusCriterio = overrides.criterios?.[c.id] ?? av?.status ?? "nao_atendido";
          const ecf = !overrides.criterios?.[c.id] && Boolean(av?.erro_em_cascata);
          const incerto = !overrides.criterios?.[c.id] && av?.confianca === "baixa";

          const estilo =
            status === "atendido"
              ? "border-ok/50 bg-ok-soft text-ok-ink"
              : status === "parcial"
                ? "border-warn-ink/40 bg-warn-soft text-warn-ink"
                : ecf && regrasGlobais.aceitar_erro_em_cascata
                  ? "border-link/40 bg-sunken text-ink"
                  : "border-line-strong bg-surface text-muted line-through";

          return (
            <div key={c.id} className="inline-flex items-center gap-1">
              <button
                type="button"
                disabled={salvando}
                onClick={() => clicarPositivo(c.id)}
                className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors hover:opacity-90 ${estilo}`}
                title="Clique para alternar: atendido → parcial → não atendido"
              >
                {status === "atendido" ? <IconeCheck /> : status === "parcial" ? <span>~</span> : <IconeX />}
                <span className="font-mono font-bold tabular-nums">+{c.peso}%</span>
                <span>{c.texto}</span>
                {ecf && <span className="rounded bg-hl px-1 text-[10px] font-semibold text-hl-ink no-underline">ECF</span>}
                {incerto && (
                  <span className="rounded bg-hl px-1 text-[10px] font-semibold text-hl-ink no-underline">
                    conferir
                  </span>
                )}
              </button>
              {(av?.evidencia_literal || av?.justificativa) && (
                <button
                  type="button"
                  onClick={() => setDetalheId(detalheId === c.id ? null : c.id)}
                  className="cursor-pointer rounded px-1.5 py-1 text-[11px] text-link hover:underline"
                >
                  {detalheId === c.id ? "ocultar" : "evidência"}
                </button>
              )}
            </div>
          );
        })}

        {penAtivas.map((p) => {
          const av = avPenPorId.get(p.id);
          const acionada = overrides.penalidades?.[p.id] ?? av?.acionada ?? false;
          const rotulo = p.modo === "teto" ? `Teto ${p.valor}%` : `-${p.valor}%`;
          return (
            <div key={p.id} className="inline-flex items-center gap-1">
              <button
                type="button"
                disabled={salvando}
                onClick={() => clicarPenalidade(p.id)}
                className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors ${
                  acionada
                    ? "border-danger bg-danger-soft text-danger"
                    : "border-dashed border-line-strong bg-surface text-muted hover:bg-sunken"
                }`}
                title="Clique para ligar ou desligar esta penalidade"
              >
                <span className="font-mono font-bold tabular-nums">{rotulo}</span>
                <span>{p.texto}</span>
              </button>
              {(av?.evidencia_literal || av?.justificativa) && (
                <button
                  type="button"
                  onClick={() => setDetalheId(detalheId === p.id ? null : p.id)}
                  className="cursor-pointer rounded px-1.5 py-1 text-[11px] text-link hover:underline"
                >
                  {detalheId === p.id ? "ocultar" : "evidência"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Detalhe da evidência literal citada pela IA */}
      {detalheId && (() => {
        const avC = avCritPorId.get(detalheId);
        const avP = avPenPorId.get(detalheId);
        const item = avC ?? avP;
        if (!item) return null;
        return (
          <div className="rounded-lg bg-sunken p-2.5 text-xs">
            {item.evidencia_literal ? (
              <p>
                <strong className="text-ink">Trecho citado pela IA:</strong>{" "}
                <span className="grifo">&ldquo;{item.evidencia_literal}&rdquo;</span>
                {item.evidencia_verificada === false && (
                  <span className="ml-2 badge badge-danger">não encontrado literalmente na resposta</span>
                )}
              </p>
            ) : (
              <p className="text-muted">Nenhum trecho literal citado pela IA.</p>
            )}
            {item.justificativa && <p className="mt-1 text-muted">{item.justificativa}</p>}
            {avC?.valor_carregado && (
              <p className="mt-1 text-muted">
                <strong>Valor herdado (ECF):</strong> {avC.valor_carregado}
              </p>
            )}
          </div>
        );
      })()}

      {/* Comentário docente (sincronizado com o feedback do aluno) + ações */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <input
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Comentário da professora para o aluno (substitui explicação anterior, opcional)"
          className="field min-w-52 flex-1 py-1.5 text-xs"
        />
        <button
          type="button"
          disabled={salvando}
          onClick={() => salvarAgora(overrides)}
          className="btn btn-primary btn-sm text-xs"
        >
          {salvando ? "Salvando…" : "Confirmar revisão"}
        </button>

        {aguardandoLiberacao && (
          <form action={acaoLib}>
            <input type="hidden" name="entrega_id" value={entregaId} />
            <button disabled={liberando} className="btn btn-secondary btn-sm text-xs">
              {liberando ? "Liberando…" : "Liberar p/ aluno"}
            </button>
          </form>
        )}

        <form action={acaoDesc}>
          <input type="hidden" name="entrega_id" value={entregaId} />
          <input type="hidden" name="desconsiderar" value={String(!desconsiderada)} />
          <button
            disabled={salvandoDesc}
            className="btn btn-secondary btn-sm text-xs"
            title="Exclui ou reinclui esta entrega no mapa de calor da turma"
          >
            {desconsiderada ? "Reincluir no Diagnóstico" : "Desconsiderar no Diagnóstico"}
          </button>
        </form>
      </div>

      {estadoSalvar?.erro && <p role="alert" className="text-danger">{estadoSalvar.erro}</p>}
      {estadoSalvar?.ok && <p role="status" className="text-ok">{estadoSalvar.ok}</p>}
      {estadoDesc?.ok && <p role="status" className="text-ok">{estadoDesc.ok}</p>}
      {estadoLib?.ok && <p role="status" className="text-ok">{estadoLib.ok}</p>}
    </div>
  );
}
