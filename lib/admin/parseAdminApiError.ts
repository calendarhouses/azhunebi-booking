export function formatAdminApiError(code: string, message?: string): string {
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
