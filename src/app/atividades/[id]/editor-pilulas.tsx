"use client";

import { useActionState, useState } from "react";
import {
  normalizarPesosPara100,
  simularCenariosRubrica,
  somaPesosPositivos,
  type CriterioPositivo,
  type ExemploCalibracao,
  type ModoPenalidade,
  type RegraPenalidade,
  type RegrasGlobaisProva,
  type RubricaV2,
} from "@/lib/nota-rubrica";
import {
  gerarCalibracaoQuestao,
  salvarCalibracaoQuestao,
  type EstadoCalibracao,
  type EstadoQuestao,
} from "../actions";
import { IconeCheck, IconeFaisca, IconeX } from "../../icones";

const PESOS_POSITIVOS = [10, 20, 25, 30, 40, 50];
const PRESETS_PENALIDADE: { rotulo: string; modo: ModoPenalidade; valor: number }[] = [
  { rotulo: "-10%", modo: "desconto", valor: 10 },
  { rotulo: "-25%", modo: "desconto", valor: 25 },
  { rotulo: "-50%", modo: "desconto", valor: 50 },
  { rotulo: "Teto 50%", modo: "teto", valor: 50 },
  { rotulo: "Teto 0%", modo: "teto", valor: 0 },
];

const SUGESTOES_CRITERIOS = [
  "Chegou ao resultado final correto",
  "Montou corretamente a fórmula ou equação",
  "Justificou o raciocínio com base no conceito",
  "Apresentou tese clara e coerente",
  "Usou evidência ou exemplo pertinente",
  "Converteu corretamente as unidades de medida",
];

const SUGESTOES_PENALIDADES = [
  "Usou método avançado não dado em aula",
  "Esqueceu a unidade de medida no resultado",
  "Fuga parcial do tema proposto",
  "Errou sinal na manipulação algébrica",
  "Apenas respondeu sim/não sem justificar",
];

const fmtNota = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function EditorPilulas({
  atividadeId,
  questaoId,
  enunciadoAtual,
  rubricaInicial,
  regrasGlobais,
  onDirty,
}: {
  atividadeId: string;
  questaoId: string;
  enunciadoAtual: string;
  rubricaInicial: RubricaV2;
  regrasGlobais: RegrasGlobaisProva;
  onDirty?: () => void;
}) {
  const [rubrica, setRubrica] = useState<RubricaV2>(rubricaInicial);
  const [editandoPosId, setEditandoPosId] = useState<string | null>(null);
  const [editandoPenId, setEditandoPenId] = useState<string | null>(null);
  const [modoAdd, setModoAdd] = useState<"positivo" | "penalidade">("positivo");
  const [novoTexto, setNovoTexto] = useState("");
  const [novoPeso, setNovoPeso] = useState(25);
  const [novoModoPen, setNovoModoPen] = useState<ModoPenalidade>("teto");

  const [estadoCal, acaoGerarCal, gerandoCal] = useActionState<EstadoCalibracao, FormData>(
    gerarCalibracaoQuestao,
    {},
  );
  const [estadoSalvarCal, acaoSalvarCal, salvandoCal] = useActionState<EstadoQuestao, FormData>(
    salvarCalibracaoQuestao,
    undefined,
  );
  const [notasCal, setNotasCal] = useState<Record<string, number>>({});
  const [obsCal, setObsCal] = useState<Record<string, string>>({});

  function atualizar(proxima: RubricaV2) {
    setRubrica(proxima);
    onDirty?.();
  }

  const soma = somaPesosPositivos(rubrica.positivos);
  const somaOk = Math.round(soma) === 100;
  const simulacao = simularCenariosRubrica(rubrica, regrasGlobais);

  const penAtivas = rubrica.penalidades.filter((p) => p.ativa !== false);
  const penSugestoes = rubrica.penalidades.filter((p) => p.ativa === false);

  function atualizarPositivo(id: string, patch: Partial<CriterioPositivo>) {
    atualizar({
      ...rubrica,
      positivos: rubrica.positivos.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }

  function removerPositivo(id: string) {
    if (rubrica.positivos.length <= 1) return;
    if (editandoPosId === id) setEditandoPosId(null);
    atualizar({ ...rubrica, positivos: rubrica.positivos.filter((c) => c.id !== id) });
  }

  function atualizarPenalidade(id: string, patch: Partial<RegraPenalidade>) {
    atualizar({
      ...rubrica,
      penalidades: rubrica.penalidades.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  function removerPenalidade(id: string) {
    if (editandoPenId === id) setEditandoPenId(null);
    atualizar({ ...rubrica, penalidades: rubrica.penalidades.filter((p) => p.id !== id) });
  }

  function adicionarRegra() {
    const txt = novoTexto.trim();
    if (!txt) return;
    if (modoAdd === "positivo") {
      const novo: CriterioPositivo = {
        id: `c_${Date.now().toString(36)}`,
        texto: txt,
        rotulo_falha: `Não atingiu: ${txt}`,
        peso: Math.max(5, Math.min(100, novoPeso)),
        grupo_id: null,
        aceita_parcial: true,
      };
      atualizar({ ...rubrica, positivos: [...rubrica.positivos, novo] });
    } else {
      const novaPen: RegraPenalidade = {
        id: `p_${Date.now().toString(36)}`,
        texto: txt,
        equivoco: txt,
        modo: novoModoPen,
        valor: Math.max(0, Math.min(100, novoPeso)),
        ignora_etapas_intermediarias: novoModoPen === "teto",
        ativa: true,
      };
      atualizar({ ...rubrica, penalidades: [...rubrica.penalidades, novaPen] });
    }
    setNovoTexto("");
  }

  const exemplosParaSalvar: ExemploCalibracao[] = (estadoCal.simuladas ?? []).map((s) => ({
    id: s.id,
    nivel: s.nivel,
    resposta: s.resposta,
    nota_esperada: notasCal[s.id] ?? Math.round(s.correcao.percentual) / 10,
    comentario_professor: obsCal[s.id]?.trim() || undefined,
  }));

  return (
    <div className="space-y-3 rounded-lg bg-sunken/70 p-3">
      <input type="hidden" name="rubrica_json" value={JSON.stringify(rubrica)} />

      {/* Cabeçalho e indicador de fechamento de 100% */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink">Critérios de avaliação em blocos</span>
        <div className="flex flex-wrap items-center gap-2">
          {somaOk ? (
            <span className="badge badge-ok gap-1">
              <IconeCheck /> Soma 100%
            </span>
          ) : (
            <>
              <span className="text-xs font-semibold">
                <span className="grifo">Soma {Math.round(soma)}%</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  atualizar({ ...rubrica, positivos: normalizarPesosPara100(rubrica.positivos) })
                }
                className="btn btn-secondary btn-sm text-xs"
              >
                Ajustar para 100%
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pílulas positivas (+X%) */}
      <div className="flex flex-wrap gap-2">
        {rubrica.positivos.map((c) => {
          const aberto = editandoPosId === c.id;
          return (
            <div key={c.id} className={aberto ? "w-full space-y-2 rounded-lg border border-ok/40 bg-surface p-3" : ""}>
              <div className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-ok/40 bg-ok-soft px-3 py-1 text-xs text-ok-ink">
                <button
                  type="button"
                  onClick={() => setEditandoPosId(aberto ? null : c.id)}
                  className="cursor-pointer font-mono font-bold tabular-nums hover:underline"
                  title="Clique para editar peso e detalhes"
                >
                  +{c.peso}%
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoPosId(aberto ? null : c.id)}
                  className="cursor-pointer text-left font-medium hover:underline"
                >
                  {c.texto}
                </button>
                {c.grupo_id && (
                  <span className="rounded bg-surface/80 px-1.5 py-0.5 text-[10px] text-muted">
                    grupo: {c.grupo_id}
                  </span>
                )}
                {rubrica.positivos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removerPositivo(c.id)}
                    aria-label={`Remover critério ${c.texto}`}
                    className="ml-0.5 cursor-pointer rounded-full p-0.5 text-ok-ink/70 hover:bg-surface/60 hover:text-danger"
                  >
                    <IconeX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {aberto && (
                <div className="space-y-2.5 pt-1 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted">Peso:</span>
                    {PESOS_POSITIVOS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => atualizarPositivo(c.id, { peso: p })}
                        className={`cursor-pointer rounded-full border px-2 py-0.5 font-mono tabular-nums ${
                          c.peso === p
                            ? "border-ink bg-hl font-semibold text-hl-ink"
                            : "border-line-strong bg-surface text-ink hover:bg-sunken"
                        }`}
                      >
                        +{p}%
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={c.peso}
                      onChange={(e) => atualizarPositivo(c.id, { peso: Math.max(1, Number(e.target.value) || 0) })}
                      aria-label="Peso personalizado (%)"
                      className="field w-16 py-1 text-xs"
                    />
                  </div>
                  <label className="block text-muted">
                    Critério esperado
                    <input
                      value={c.texto}
                      onChange={(e) => atualizarPositivo(c.id, { texto: e.target.value })}
                      className="field mt-1 text-xs"
                    />
                  </label>
                  <label className="block text-muted">
                    Rótulo de falha no Diagnóstico (quando o aluno não atinge)
                    <input
                      value={c.rotulo_falha}
                      onChange={(e) => atualizarPositivo(c.id, { rotulo_falha: e.target.value })}
                      className="field mt-1 text-xs"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-ink">
                      <input
                        type="checkbox"
                        checked={c.aceita_parcial !== false}
                        onChange={(e) => atualizarPositivo(c.id, { aceita_parcial: e.target.checked })}
                      />
                      Aceita acerto parcial (50% do peso)
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-muted">
                      Grupo exclusivo (opcional):
                      <input
                        value={c.grupo_id ?? ""}
                        onChange={(e) => atualizarPositivo(c.id, { grupo_id: e.target.value.trim() || null })}
                        placeholder="ex.: explicacao"
                        className="field w-28 py-0.5 text-xs"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Pílulas de penalidade ativas (-Y% ou Teto Z%) */}
        {penAtivas.map((p) => {
          const aberto = editandoPenId === p.id;
          const rotuloPeso = p.modo === "teto" ? `Teto ${p.valor}%` : `-${p.valor}%`;
          return (
            <div key={p.id} className={aberto ? "w-full space-y-2 rounded-lg border border-danger/40 bg-surface p-3" : ""}>
              <div className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-danger/40 bg-danger-soft px-3 py-1 text-xs text-danger">
                <button
                  type="button"
                  onClick={() => setEditandoPenId(aberto ? null : p.id)}
                  className="cursor-pointer font-mono font-bold tabular-nums hover:underline"
                  title="Clique para editar penalidade ou teto"
                >
                  {rotuloPeso}
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoPenId(aberto ? null : p.id)}
                  className="cursor-pointer text-left font-medium hover:underline"
                >
                  {p.texto}
                </button>
                <button
                  type="button"
                  onClick={() => removerPenalidade(p.id)}
                  aria-label={`Remover penalidade ${p.texto}`}
                  className="ml-0.5 cursor-pointer rounded-full p-0.5 text-danger/70 hover:bg-surface/60 hover:text-danger"
                >
                  <IconeX className="h-3.5 w-3.5" />
                </button>
              </div>

              {aberto && (
                <div className="space-y-2.5 pt-1 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted">Efeito:</span>
                    {PRESETS_PENALIDADE.map((pr) => {
                      const ativo = p.modo === pr.modo && p.valor === pr.valor;
                      return (
                        <button
                          key={pr.rotulo}
                          type="button"
                          onClick={() =>
                            atualizarPenalidade(p.id, {
                              modo: pr.modo,
                              valor: pr.valor,
                              ignora_etapas_intermediarias: pr.modo === "teto",
                            })
                          }
                          className={`cursor-pointer rounded-full border px-2 py-0.5 font-mono tabular-nums ${
                            ativo
                              ? "border-ink bg-hl font-semibold text-hl-ink"
                              : "border-line-strong bg-surface text-ink hover:bg-sunken"
                          }`}
                        >
                          {pr.rotulo}
                        </button>
                      );
                    })}
                    <select
                      value={p.modo}
                      onChange={(e) =>
                        atualizarPenalidade(p.id, {
                          modo: e.target.value === "teto" ? "teto" : "desconto",
                          ignora_etapas_intermediarias: e.target.value === "teto",
                        })
                      }
                      aria-label="Modo da penalidade"
                      className="field w-28 py-1 text-xs"
                    >
                      <option value="desconto">Desconto (-%)</option>
                      <option value="teto">Teto (Máx. %)</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={p.valor}
                      onChange={(e) => atualizarPenalidade(p.id, { valor: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                      aria-label="Percentual"
                      className="field w-16 py-1 text-xs"
                    />
                  </div>
                  <label className="block text-muted">
                    Condição da penalidade
                    <input
                      value={p.texto}
                      onChange={(e) => atualizarPenalidade(p.id, { texto: e.target.value })}
                      className="field mt-1 text-xs"
                    />
                  </label>
                  <label className="block text-muted">
                    Equívoco registrado no Diagnóstico
                    <input
                      value={p.equivoco}
                      onChange={(e) => atualizarPenalidade(p.id, { equivoco: e.target.value })}
                      className="field mt-1 text-xs"
                    />
                  </label>
                  {p.modo === "teto" && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-ink">
                      <input
                        type="checkbox"
                        checked={Boolean(p.ignora_etapas_intermediarias)}
                        onChange={(e) =>
                          atualizarPenalidade(p.id, { ignora_etapas_intermediarias: e.target.checked })
                        }
                      />
                      Evitar dupla penalização (se acertar por método proibido, aplica este teto sem zerar etapas)
                    </label>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sugestões tracejadas da IA (1 clique ativa!) */}
      {penSugestoes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
          <span className="text-muted">Sugestões (1 clique ativa):</span>
          {penSugestoes.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => atualizarPenalidade(p.id, { ativa: true })}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border border-dashed border-line-strong bg-surface px-2.5 py-0.5 text-muted transition-colors hover:border-danger hover:bg-danger-soft hover:text-danger"
              title="Clique para ativar esta regra na correção"
            >
              <span className="font-mono font-semibold">
                + {p.modo === "teto" ? `Teto ${p.valor}%` : `-${p.valor}%`}
              </span>
              <span>{p.texto}</span>
            </button>
          ))}
        </div>
      )}

      {/* Adicionar novo critério ou penalidade */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <div className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setModoAdd("positivo");
              setNovoPeso(25);
            }}
            className={`cursor-pointer rounded-md px-2 py-1 font-semibold ${
              modoAdd === "positivo" ? "bg-ok-soft text-ok-ink" : "text-muted hover:text-ink"
            }`}
          >
            + Critério
          </button>
          <button
            type="button"
            onClick={() => {
              setModoAdd("penalidade");
              setNovoPeso(50);
            }}
            className={`cursor-pointer rounded-md px-2 py-1 font-semibold ${
              modoAdd === "penalidade" ? "bg-danger-soft text-danger" : "text-muted hover:text-ink"
            }`}
          >
            − Penalidade
          </button>
        </div>

        {modoAdd === "penalidade" && (
          <select
            value={novoModoPen}
            onChange={(e) => setNovoModoPen(e.target.value === "desconto" ? "desconto" : "teto")}
            aria-label="Tipo de penalidade"
            className="field w-28 py-1.5 text-xs"
          >
            <option value="teto">Teto (Máx.)</option>
            <option value="desconto">Desconto (−)</option>
          </select>
        )}

        <input
          type="number"
          min={0}
          max={100}
          value={novoPeso}
          onChange={(e) => setNovoPeso(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
          aria-label="Percentual da nova regra"
          className="field w-16 py-1.5 text-xs font-mono tabular-nums"
        />

        <input
          value={novoTexto}
          onChange={(e) => setNovoTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionarRegra();
            }
          }}
          list={`sug-${modoAdd}-${questaoId}`}
          placeholder={
            modoAdd === "positivo"
              ? "Ex.: Fatorou o x em evidência…"
              : "Ex.: Usou Regra de L'Hôpital…"
          }
          className="field min-w-44 flex-1 py-1.5 text-xs"
        />
        <datalist id={`sug-${modoAdd}-${questaoId}`}>
          {(modoAdd === "positivo" ? SUGESTOES_CRITERIOS : SUGESTOES_PENALIDADES).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <button
          type="button"
          onClick={adicionarRegra}
          disabled={!novoTexto.trim()}
          className="btn btn-secondary btn-sm text-xs"
        >
          Adicionar
        </button>
      </div>

      {/* Simulador de 1 linha */}
      <p className="border-t border-line pt-2 text-xs text-muted">
        <strong className="text-ink">Simulação:</strong> acerto total ={" "}
        <span className="font-mono font-semibold text-ink">{fmtNota(simulacao.acertoTotal)}</span>
        {simulacao.cenariosPenalidade.map((c) => (
          <span key={c.id}>
            {" · "}se acionar &ldquo;{c.texto}&rdquo; ={" "}
            <span className="font-mono font-semibold text-danger">
              {c.modo === "teto" ? `máx. ${fmtNota(c.notaAcertandoTudo)}` : fmtNota(c.notaAcertandoTudo)}
            </span>
          </span>
        ))}
      </p>

      {/* Resolução-modelo retrátil + Calibração em 3 respostas simuladas */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-2 text-xs">
        <details className="w-full">
          <summary className="cursor-pointer font-medium text-muted hover:text-ink">
            Ver / editar resolução-modelo esperada
          </summary>
          <textarea
            value={rubrica.resolucao_modelo ?? ""}
            onChange={(e) => atualizar({ ...rubrica, resolucao_modelo: e.target.value || null })}
            rows={2}
            placeholder="Resposta esperada que ajuda a IA a aplicar seus critérios com fidelidade…"
            className="field mt-2 text-xs"
          />
        </details>

        <details className="w-full">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-link hover:underline">
            <IconeFaisca />
            Testar meu rigor em 3 respostas simuladas
            {(rubrica.exemplos_calibracao?.length ?? 0) > 0 && (
              <span className="badge badge-ok ml-1">
                {rubrica.exemplos_calibracao!.length} âncoras salvas
              </span>
            )}
          </summary>

          <div className="mt-2 space-y-3 rounded-lg border border-line bg-surface p-3">
            <p className="text-xs text-muted">
              A IA gera 3 respostas fictícias (forte, média e fraca) e aplica suas pílulas atuais. Ajuste a nota se
              achar que ela foi rígida ou branda demais — esses exemplos passam a guiar a correção real da turma.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={gerandoCal}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("atividade_id", atividadeId);
                  fd.set("questao_id", questaoId);
                  fd.set("enunciado", enunciadoAtual);
                  fd.set("rubrica_json", JSON.stringify(rubrica));
                  acaoGerarCal(fd);
                }}
                className="btn btn-secondary btn-sm text-xs"
              >
                <IconeFaisca />
                {gerandoCal ? "Gerando 3 respostas…" : "Gerar 3 respostas simuladas"}
              </button>
              {estadoCal.erro && <span role="alert" className="text-xs text-danger">{estadoCal.erro}</span>}
            </div>

            {estadoCal.simuladas && estadoCal.simuladas.length > 0 && (
              <div className="space-y-3 pt-1">
                {estadoCal.simuladas.map((s) => {
                  const notaIa10 = Math.round(s.correcao.percentual) / 10;
                  const notaAtual = notasCal[s.id] ?? notaIa10;
                  return (
                    <div key={s.id} className="space-y-1.5 rounded-lg bg-sunken p-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="badge badge-neutral uppercase">{s.nivel}</span>
                        <span className="text-muted">
                          Nota pelas pílulas: <strong className="font-mono text-ink">{fmtNota(notaIa10)}/10</strong>
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-ink">{s.resposta}</p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <label className="inline-flex items-center gap-1.5 text-muted">
                          Minha nota (0–10):
                          <input
                            type="number"
                            min={0}
                            max={10}
                            step={0.5}
                            value={notaAtual}
                            onChange={(e) =>
                              setNotasCal((prev) => ({
                                ...prev,
                                [s.id]: Math.min(10, Math.max(0, Number(e.target.value) || 0)),
                              }))
                            }
                            className="field w-16 py-0.5 text-xs font-mono"
                          />
                        </label>
                        <input
                          value={obsCal[s.id] ?? ""}
                          onChange={(e) => setObsCal((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          placeholder="Observação curta do seu rigor (opcional)"
                          className="field min-w-44 flex-1 py-0.5 text-xs"
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={salvandoCal}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("atividade_id", atividadeId);
                      fd.set("questao_id", questaoId);
                      fd.set("exemplos_json", JSON.stringify(exemplosParaSalvar));
                      acaoSalvarCal(fd);
                      atualizar({ ...rubrica, exemplos_calibracao: exemplosParaSalvar });
                    }}
                    className="btn btn-primary btn-sm text-xs"
                  >
                    {salvandoCal ? "Salvando calibração…" : "Salvar calibração nesta questão"}
                  </button>
                  {estadoSalvarCal?.erro && (
                    <span role="alert" className="text-xs text-danger">{estadoSalvarCal.erro}</span>
                  )}
                  {estadoSalvarCal?.ok && (
                    <span role="status" className="text-xs text-ok">{estadoSalvarCal.ok}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
