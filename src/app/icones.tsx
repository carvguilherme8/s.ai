import type { SVGProps } from "react";

/** Ícones desenhados, um só traço (1.75) e tamanho 1em, herdam a cor do texto. */
function Base({ children, className, ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
      aria-hidden={p["aria-label"] ? undefined : true}
      role={p["aria-label"] ? "img" : undefined}
      className={`shrink-0 ${className ?? ""}`}
    >
      {children}
    </svg>
  );
}

export const IconeSeta = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Base>
);
export const IconeVoltar = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Base>
);
export const IconeCheck = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Base>
);
export const IconeX = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M6 6l12 12M18 6L6 18" /></Base>
);
export const IconeCopiar = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Base>
);
export const IconeLivro = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15z" />
    <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" />
  </Base>
);
export const IconeLista = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></Base>
);
export const IconeGrade = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </Base>
);
export const IconeSair = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10" />
  </Base>
);
/** Marcador de lacuna: triângulo cheio apontando para baixo (queda de domínio). */
export const IconeLacuna = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p} fill="currentColor" stroke="none"><path d="M12 19L3.5 6h17z" /></Base>
);
export const IconeFaisca = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
    <path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
  </Base>
);

/** Mapa de calor: grade 3x3 de quadrados. */
export const IconeMapa = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="4.5" height="4.5" rx="1" />
    <rect x="9.75" y="3.5" width="4.5" height="4.5" rx="1" fill="currentColor" />
    <rect x="16" y="3.5" width="4.5" height="4.5" rx="1" />
    <rect x="3.5" y="9.75" width="4.5" height="4.5" rx="1" fill="currentColor" />
    <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1" />
    <rect x="16" y="9.75" width="4.5" height="4.5" rx="1" fill="currentColor" />
    <rect x="3.5" y="16" width="4.5" height="4.5" rx="1" />
    <rect x="9.75" y="16" width="4.5" height="4.5" rx="1" />
    <rect x="16" y="16" width="4.5" height="4.5" rx="1" fill="currentColor" />
  </Base>
);

export const IconeMenu = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Base>
);
