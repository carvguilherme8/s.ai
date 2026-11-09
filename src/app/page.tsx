import { Suspense } from "react";
import { StatusSupabase, StatusSupabaseCarregando } from "./status-supabase";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">s.ai</h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Descubra em segundos onde sua turma está travando — e o que revisar.
      </p>
      <div className="mt-12">
        <Suspense fallback={<StatusSupabaseCarregando />}>
          <StatusSupabase />
        </Suspense>
      </div>
    </main>
  );
}
