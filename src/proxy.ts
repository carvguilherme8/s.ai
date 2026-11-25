import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROTAS_PROFESSORA = ["/materiais", "/atividades", "/diagnostico"];

/**
 * Renova a sessão do Supabase e exige login nas áreas da professora e do aluno.
 * A autorização por papel fica nas páginas e nas server actions (getProfessorAtual, getSessao);
 * aqui é só a barreira de entrada. /api/saude e as páginas de entrada continuam públicas.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Não coloque código entre createServerClient e getUser.
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const areaAluno = pathname.startsWith("/aluno");
  const areaProfessora = pathname === "/" || ROTAS_PROFESSORA.some((r) => pathname.startsWith(r));

  if (!user && (areaAluno || areaProfessora)) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    return NextResponse.redirect(url);
  }
  if (user && (pathname === "/entrar" || pathname === "/cadastro")) {
    const url = request.nextUrl.clone();
    url.pathname = user.user_metadata?.papel === "professor" ? "/" : "/aluno";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/", "/materiais/:path*", "/atividades/:path*", "/diagnostico/:path*", "/aluno/:path*", "/entrar", "/cadastro"],
};
