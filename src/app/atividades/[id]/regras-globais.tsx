"use client";

import { useActionState, useState } from "react";
import {
  normalizarRegrasGlobais,
  type ModoPenalidade,
  type RegrasGlobaisProva,
} from "@/lib/nota-rubrica";
import {
  removerPresetRubrica,
  salvarPresetRubrica,
  salvarRegrasAtividade,
  type EstadoQuestao,
} from "../actions";
import { IconeCheck, IconeX } from "../../icones";

export type PresetProfessor = {
  id: string;
  nome: string;
  disciplina: string | null;
  regras_globais: RegrasGlobaisProva;
};

export function RegrasGlobaisBar({
  atividadeId,
  disciplina,
  regrasIniciais,
  revisarAntesInicial,
  presets,
  editavel,
}: {
  atividadeId: string;
  disciplina: string | null;
  regrasIniciais: RegrasGlobaisProva;
  revisarAntesInicial: boolean;
  presets: PresetProfessor[];
  editavel: boolean;
}) {
  const [regras, setRegras] = useState<RegrasGlobaisProva>(regrasIniciais);
  const [revisarAntes, setRevisarAntes] = useState(revisarAntesInicial);
  const [metodoAtivo, setMetodoAtivo] = useState(Boolean(regrasIniciais.metodo_proibido?.descricao));
  const [metodoDesc, setMetodoDesc] = useState(regrasIniciais.metodo_proibido?.descricao ?? "");
  const [metodoModo, setMetodoModo] = useState<ModoPenalidade>(regrasIniciais.metodo_proibido?.modo ?? "teto");
  const [metodoValor, setMetodoValor] = useState(regrasIniciais.metodo_proibido?.valor ?? 50);

  const [abrirSalvarPreset, setAbrirSalvarPreset] = useState(false);
  const [nomePreset, setNomePreset] = useState(disciplina ? `Meu padrão de ${disciplina}` : "Meu padrão de prova");

  const [estadoSalvar, acaoSalvar, salvando] = useActionState<EstadoQuestao, FormData>(
    salvarRegrasAtividade,
    undefined,
  );
  const [estadoPreset, acaoPreset, salvandoPreset] = useActionState<EstadoQuestao, FormData>(
    salvarPresetRubrica,
    undefined,
  );

  const regrasMontadas: RegrasGlobaisProva = {
    ...regras,
    metodo_proibido:
      metodoAtivo && metodoDesc.trim()
        ? { descricao: metodoDesc.trim(), modo: metodoModo, valor: metodoValor }
        : null,
  };

  function aplicarPreset(p: PresetProfessor) {
    const r = normalizarRegrasGlobais(p.regras_globais);
    setRegras(r);
    setMetodoAtivo(Boolean(r.metodo_proibido?.descricao));
    setMetodoDesc(r.metodo_proibido?.descricao ?? "");
    setMetodoModo(r.metodo_proibido?.modo ?? "teto");
    setMetodoValor(r.metodo_proibido?.valor ?? 50);
  }

  if (!editavel) {
    const ativos = [
      regrasIniciais.aceitar_erro_em_cascata && "Aceita erro em cascata (ECF)",
      regrasIniciais.aceitar_metodo_equivalente && "Aceita método equivalente",
      regrasIniciais.ignorar_ortografia && "Foca no conceito (ignora ortografia)",
      revisarAntesInicial && "Revisão docente antes de liberar dissertativas",
      regrasIniciais.metodo_proibido &&
        `Proibido: ${regrasIniciais.metodo_proibido.descricao} (${
          regrasIniciais.metodo_proibido.modo === "teto"
            ? `teto ${regrasIniciais.metodo_proibido.valor}%`
            : `-${regrasIniciais.metodo_proibido.valor}%`
        })`,
    ].filter(Boolean) as string[];
    if (!ativos.length) return null;
    return (
      <section className="card p-4 text-xs">
        <p className="mb-2 font-semibold text-ink">Regras globais desta atividade</p>
        <div className="flex flex-wrap gap-1.5">
          {ativos.map((a) => (
            <span key={a} className="badge badge-neutral">
              {a}
            </span>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="h-regras" className="card space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="h-regras" className="text-base font-bold">
            Regras desta prova
          </h2>
          <p className="text-xs text-muted">
            Aplicadas automaticamente a todas as questões dissertativas desta atividade.
          </p>
        </div>
        {disciplina && <span className="badge badge-neutral">{disciplina}</span>}
      </div>

      {/* Presets salvos do professor */}
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">Meus padrões:</span>
          {presets.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface px-2.5 py-1"
            >
              <button
                type="button"
                onClick={() => aplicarPreset(p)}
                className="cursor-pointer font-medium text-ink hover:text-link hover:underline"
              >
                {p.nome}
              </button>
              <form action={removerPresetRubrica} className="inline">
                <input type="hidden" name="preset_id" value={p.id} />
                <input type="hidden" name="atividade_id" value={atividadeId} />
                <button
                  type="submit"
                  aria-label={`Remover padrão ${p.nome}`}
                  className="cursor-pointer text-muted hover:text-danger"
                >
                  <IconeX className="h-3 w-3" />
                </button>
              </form>
            </span>
          ))}
        </div>
      )}

      {/* Toggles em chips de 1 clique */}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          aria-pressed={regras.aceitar_erro_em_cascata}
          onClick={() =>
            setRegras((r) => ({ ...r, aceitar_erro_em_cascata: !r.aceitar_erro_em_cascata }))
          }
          className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors ${
            regras.aceitar_erro_em_cascata
              ? "border-ok/50 bg-ok-soft text-ok-ink"
              : "border-line-strong bg-surface text-muted hover:bg-sunken"
          }`}
        >
          {regras.aceitar_erro_em_cascata && <IconeCheck />}
          Aceitar erro em cascata (ECF)
        </button>

        <button
          type="button"
          aria-pressed={regras.aceitar_metodo_equivalente}
          onClick={() =>
            setRegras((r) => ({ ...r, aceitar_metodo_equivalente: !r.aceitar_metodo_equivalente }))
          }
          className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors ${
            regras.aceitar_metodo_equivalente
              ? "border-ok/50 bg-ok-soft text-ok-ink"
              : "border-line-strong bg-surface text-muted hover:bg-sunken"
          }`}
        >
          {regras.aceitar_metodo_equivalente && <IconeCheck />}
          Aceitar método equivalente
        </button>

        <button
          type="button"
          aria-pressed={Boolean(regras.ignorar_ortografia)}
          onClick={() => setRegras((r) => ({ ...r, ignorar_ortografia: !r.ignorar_ortografia }))}
          className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors ${
            regras.ignorar_ortografia
              ? "border-ok/50 bg-ok-soft text-ok-ink"
              : "border-line-strong bg-surface text-muted hover:bg-sunken"
          }`}
        >
          {regras.ignorar_ortografia && <IconeCheck />}
          Focar no conceito (ignorar ortografia)
        </button>

        <button
          type="button"
          aria-pressed={revisarAntes}
          onClick={() => setRevisarAntes((v) => !v)}
          className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors ${
            revisarAntes
              ? "border-ink bg-hl font-semibold text-hl-ink"
              : "border-line-strong bg-surface text-muted hover:bg-sunken"
          }`}
        >
          {revisarAntes && <IconeCheck />}
          Revisar dissertativas antes de liberar
        </button>

        <button
          type="button"
          aria-pressed={metodoAtivo}
          onClick={() => setMetodoAtivo((v) => !v)}
          className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors ${
            metodoAtivo
              ? "border-danger/50 bg-danger-soft text-danger"
              : "border-line-strong bg-surface text-muted hover:bg-sunken"
          }`}
        >
          Proibir método não ensinado
        </button>
      </div>

      {/* Configuração rápida de método proibido */}
      {metodoAtivo && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-danger-soft/50 p-2.5 text-xs">
          <input
            value={metodoDesc}
            onChange={(e) => setMetodoDesc(e.target.value)}
            placeholder="Qual método? (ex.: Regra de L'Hôpital, calculadora)"
            className="field min-w-48 flex-1 py-1.5 text-xs"
          />
          <select
            value={metodoModo}
            onChange={(e) => setMetodoModo(e.target.value === "desconto" ? "desconto" : "teto")}
            aria-label="Tipo de penalidade do método"
            className="field w-32 py-1.5 text-xs"
          >
            <option value="teto">Teto (Máx. %)</option>
            <option value="desconto">Desconto (−%)</option>
          </select>
          <input
            type="number"
            min={0}
            max={100}
            value={metodoValor}
            onChange={(e) => setMetodoValor(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            aria-label="Valor percentual do método proibido"
            className="field w-16 py-1.5 font-mono text-xs tabular-nums"
          />
        </div>
      )}

      {/* Ações: salvar na prova + salvar como padrão */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <form action={acaoSalvar} className="inline-flex items-center gap-2">
          <input type="hidden" name="atividade_id" value={atividadeId} />
          <input type="hidden" name="regras_json" value={JSON.stringify(regrasMontadas)} />
          <input type="hidden" name="revisar_antes_liberar" value={String(revisarAntes)} />
          <button disabled={salvando} className="btn btn-secondary btn-sm text-xs">
            {salvando ? "Salvando regras…" : "Salvar regras da prova"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setAbrirSalvarPreset((v) => !v)}
          className="text-xs font-medium text-link hover:underline"
        >
          {abrirSalvarPreset ? "Cancelar" : "Salvar como meu padrão"}
        </button>

        {estadoSalvar?.erro && <span role="alert" className="text-xs text-danger">{estadoSalvar.erro}</span>}
        {estadoSalvar?.ok && <span role="status" className="text-xs text-ok">{estadoSalvar.ok}</span>}
      </div>

      {abrirSalvarPreset && (
        <form action={acaoPreset} className="flex flex-wrap items-center gap-2 rounded-lg bg-sunken p-2.5 text-xs">
          <input type="hidden" name="atividade_id" value={atividadeId} />
          <input type="hidden" name="disciplina" value={disciplina ?? ""} />
          <input type="hidden" name="regras_json" value={JSON.stringify(regrasMontadas)} />
          <input type="hidden" name="pilulas_json" value="[]" />
          <input
            name="nome"
            value={nomePreset}
            onChange={(e) => setNomePreset(e.target.value)}
            maxLength={80}
            required
            className="field min-w-48 flex-1 py-1.5 text-xs"
            placeholder="Nome do padrão"
          />
          <button disabled={salvandoPreset} className="btn btn-primary btn-sm text-xs">
            {salvandoPreset ? "Salvando…" : "Guardar padrão"}
          </button>
          {estadoPreset?.erro && <span role="alert" className="text-xs text-danger">{estadoPreset.erro}</span>}
          {estadoPreset?.ok && <span role="status" className="text-xs text-ok">{estadoPreset.ok}</span>}
        </form>
      )}
    </section>
  );
}
