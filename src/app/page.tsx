import { Suspense } from "react";
import { PainelProfessor } from "./painel-professor";
import { StatusSupabase, StatusSupabaseCarregando } from "./status-supabase";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted">Carregando painel…</p>}>
        <PainelProfessor />
      </Suspense>

      <footer className="mt-16 border-t border-line pt-4">
        <Suspense fallback={<StatusSupabaseCarregando />}>
          <StatusSupabase />
        </Suspense>
      </footer>
    </main>
  );
}
