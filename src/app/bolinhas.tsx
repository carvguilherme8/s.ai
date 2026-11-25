/** Cartão-resposta: fileira de bolinhas, cheias na proporção do domínio (cada uma vale 20%). */
export function Bolinhas({ valor, n = 5, className = "" }: { valor: number; n?: number; className?: string }) {
  const cheias = Math.round(valor * n);
  return (
    <span className={`inline-flex gap-1 ${className}`} role="img" aria-label={`Domínio ${Math.round(valor * 100)}%`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} aria-hidden className={`h-3 w-3 rounded-full border-[1.5px] border-current ${i < cheias ? "bg-current" : ""}`} />
      ))}
    </span>
  );
}
