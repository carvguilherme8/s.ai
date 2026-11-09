import { Suspense } from "react";
import { PainelProfessor } from "./painel-professor";
import { StatusSupabase, StatusSupabaseCarregando } from "./status-supabase";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">s.ai</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Descubra em segundos onde sua turma está travando — e o que revisar.
      </p>

      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-zinc-500">Carregando painel…</p>}>
          <PainelProfessor />
        </Suspense>
      </div>

      <div className="mt-10">
        <Suspense fallback={<StatusSupabaseCarregando />}>
          <StatusSupabase />
        </Suspense>
      </div>
    </main>
  );
}
