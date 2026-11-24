import Link from "next/link";
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

      <Link href="/materiais" className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
        Enviar material de apoio →
      </Link>
      <Link href="/atividades" className="mt-6 ml-2 inline-block rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700">
        Atividades e questões →
      </Link>

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
