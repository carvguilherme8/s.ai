import Link from "next/link";
import { FormCadastro } from "../auth/form";

export const metadata = { title: "Criar conta — s.ai" };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="mb-1 text-2xl font-semibold">Criar conta de aluno</h1>
      <p className="mb-6 text-sm text-muted">Peça o código de convite ao seu professor.</p>
      <FormCadastro />
      <p className="mt-4 text-sm text-muted">
        Já tem conta? <Link href="/entrar" className="underline">Entrar</Link>
      </p>
    </main>
  );
}
