export function getVisitWord(count: number): string {
  const n = Math.abs(parseInt(String(count), 10)) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "заїздів";
  if (n1 > 1 && n1 < 5) return "заїзди";
  if (n1 === 1) return "заїзд";
  return "заїздів";
}

export function getGuestWord(count: number): string {
  const n = Math.abs(parseInt(String(count), 10)) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "гостей";
  if (n1 > 1 && n1 < 5) return "гості";
  if (n1 === 1) return "гість";
  return "гостей";
}

export function dateWord(n: number): string {
  const v = Math.abs(parseInt(String(n), 10)) % 100;
  const v1 = v % 10;
  if (v > 10 && v < 20) return "дат";
  if (v1 > 1 && v1 < 5) return "дати";
  if (v1 === 1) return "дата";
  return "дат";
}

/** «3 обраних дат» — родовий множина після «обраних» */
export function selectedDatesPhrase(count: number): string {
  const n = Math.abs(parseInt(String(count), 10)) || 0;
  if (n === 1) return "1 обраної дати";
  return `${n} обраних дат`;
}

export function dayWord(n: number): string {
  const v = Math.abs(parseInt(String(n), 10)) % 100;
  const v1 = v % 10;
  if (v > 10 && v < 20) return "днів";
  if (v1 > 1 && v1 < 5) return "дні";
  if (v1 === 1) return "день";
  return "днів";
}

export function nightWord(n: number): string {
  const v = Math.abs(n) % 100;
  const v1 = v % 10;
  if (v > 10 && v < 20) return "ночей";
  if (v1 > 1 && v1 < 5) return "ночі";
  if (v1 === 1) return "ніч";
  return "ночей";
}

/** 1 доба · 2 доби · 5 діб */
export function dobaWord(n: number): string {
  const v = Math.abs(n) % 100;
  const v1 = v % 10;
  if (v > 10 && v < 20) return "діб";
  if (v1 > 1 && v1 < 5) return "доби";
  if (v1 === 1) return "доба";
  return "діб";
}

/** «від 1 ночі», «від 3 ночей» — для умов довготривалого проживання */
export function nightsFromPhrase(count: number): string {
  const n = Math.max(1, Math.abs(parseInt(String(count), 10)) || 1);
  if (n === 1) return "від 1 ночі";
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 > 10 && mod100 < 20) return `від ${n} ночей`;
  if (mod10 >= 2 && mod10 <= 4) return `від ${n} ночей`;
  return `від ${n} ночей`;
}

/** «за 1 день», «за 60 днів» — для раннього бронювання */
export function daysBeforePhrase(count: number): string {
  const n = Math.max(1, Math.abs(parseInt(String(count), 10)) || 1);
  if (n === 1) return "за 1 день";
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 > 10 && mod100 < 20) return `за ${n} днів`;
  if (mod10 === 1) return `за ${n} день`;
  if (mod10 >= 2 && mod10 <= 4) return `за ${n} дні`;
  return `за ${n} днів`;
}

/** «до 1 дня», «до 3 днів» — для гарячої пропозиції */
export function daysUntilPhrase(count: number): string {
  const n = Math.max(1, Math.abs(parseInt(String(count), 10)) || 1);
  if (n === 1) return "до 1 дня";
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 > 10 && mod100 < 20) return `до ${n} днів`;
  if (mod10 >= 2 && mod10 <= 4) return `до ${n} днів`;
  return `до ${n} днів`;
}

/** «1 активне бронювання» / «2 активні бронювання» / «5 активних бронювань» */
export function activeBookingPhrase(count: number): string {
  const n = Math.abs(parseInt(String(count), 10)) || 0;
  const n100 = n % 100;
  const n1 = n % 10;
  if (n100 > 10 && n100 < 20) return `${n} активних бронювань`;
  if (n1 === 1) return `${n} активне бронювання`;
  if (n1 > 1 && n1 < 5) return `${n} активні бронювання`;
  return `${n} активних бронювань`;
}

export function otherCheckInDatePhrase(count: number): string {
  const n = Math.abs(parseInt(String(count), 10)) || 0;
  return n === 1 ? "з іншою датою заїзду" : "з іншими датами заїзду";
}
