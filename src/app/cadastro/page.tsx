import Link from "next/link";
import { FormCadastro } from "../auth/form";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Criar conta</h1>
      <FormCadastro />
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        Já tem conta?{" "}
        <Link href="/entrar" className="underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
