import Link from "next/link";
import { FormEntrar } from "../auth/form";

export const metadata = { title: "Entrar — s.ai" };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="mb-1 text-2xl font-semibold">Entrar</h1>
      <p className="mb-6 text-sm text-muted">Professores e alunos entram por aqui.</p>
      <FormEntrar />
      <p className="mt-4 text-sm text-muted">
        Primeiro acesso?{" "}
        <Link href="/cadastro" className="underline">Cadastre-se com o código da turma</Link>
      </p>
    </main>
  );
}
