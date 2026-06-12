/** Перші дві літери назви комплексу (напр. «Бербен Хаус» → «БХ»). */
export function getTenantInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "—";

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toLocaleUpperCase("uk-UA");
  }

  const word = words[0];
  if (word.length >= 2) {
    return word.slice(0, 2).toLocaleUpperCase("uk-UA");
  }
  return word.charAt(0).toLocaleUpperCase("uk-UA");
}
