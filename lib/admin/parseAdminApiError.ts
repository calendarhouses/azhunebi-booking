export function formatAdminApiError(code: string, message?: string): string {
  const raw = message || code || "";
  const lower = raw.toLowerCase();

  if (
    lower.includes("gas_bad_response") ||
    lower.includes("не json") ||
    lower.includes("http 502") ||
    lower.includes("http 504")
  ) {
    return "Google зараз перевантажений. Зачекайте кілька секунд і натисніть «Спробувати знову».";
  }
  if (lower.includes("gas_timeout") || lower.includes("не відповів вчасно")) {
    return "Google не встиг відповісти. Натисніть «Спробувати знову».";
  }
  if (lower.includes("gas_rate_limited") || lower.includes("too many")) {
    return "Забагато запитів до Google. Зачекайте 10–15 секунд і повторіть.";
  }
  if (lower.includes("gas_unreachable") || lower.includes("немає зв")) {
    return "Немає звʼязку з Google. Перевірте інтернет і повторіть.";
  }

  switch (code) {
    case "SERVER_MISCONFIGURED":
      return (
        "На сервері не налаштовано NEXT_PUBLIC_GAS_URL. " +
        "Додайте URL Google Apps Script у .env.local і перезапустіть npm run dev."
      );
    case "UNAUTHORIZED":
      return "Сесія закінчилась. Увійдіть знову.";
    case "MISSING_TENANT":
      return "Не визначено комплекс. Перезавантажте сторінку або увійдіть знову.";
    case "DB_ERROR":
      return message || "Помилка бази даних.";
    default:
      return message || code || "Невідома помилка";
  }
}

export function parseAdminFetchError(err: unknown): string {
  if (!(err instanceof Error)) return "Помилка завантаження";
  return formatAdminApiError(err.message, err.message);
}
