export function formatMoneyUa(n: number): string {
  return `${Math.round(Number(n) || 0).toLocaleString("uk-UA")} грн`;
}

export function formatCount(n: number): string {
  return Math.round(Number(n) || 0).toLocaleString("uk-UA");
}

export function formatMoneyReport(n: number): string {
  return `${(Math.round(Number(n) || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴`;
}
