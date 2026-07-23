/**
 * Escapa qualquer valor antes de injetar no template HTML do DANFSe
 * (item 2.5 do MD: um XML malicioso poderia tentar injetar HTML/JS que
 * rodaria no processo de renderização do servidor — SSRF, leitura de
 * arquivo local etc. Nunca interpolar campo do XML sem sanitizar).
 */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCnpjOuCpf(digits: string | undefined): string {
  if (!digits) return "";
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return digits;
}

export function formatMoeda(value: number | undefined): string {
  return (value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDataHora(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return escapeHtml(iso);
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatDataHoraCompleta(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return escapeHtml(iso);
  // Formato DD/MM/AAAA hh:mm:ss (item 2.4.5), sem a vírgula que o
  // toLocaleString insere entre data e hora.
  return date
    .toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .replace(",", "");
}

export function formatData(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return escapeHtml(iso);
  return date.toLocaleDateString("pt-BR");
}

export function formatCep(cep: string | undefined): string {
  if (!cep) return "";
  return cep.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}
