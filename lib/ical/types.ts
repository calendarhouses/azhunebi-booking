export type IcalEvent = {
  uid: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (exclusive for all-day DATE events)
  summary?: string;
};

export type IcalRoomSyncConfig = {
  roomId: number;
  /** Booking.com export URL — ми тягнемо їхні зайняті дати */
  importUrl?: string;
  lastSyncedAt?: string;
  lastError?: string | null;
};

export type IcalSyncSettings = {
  /** Секрет для публічного експорт-URL (query ?s=) */
  exportSecret: string;
  rooms: IcalRoomSyncConfig[];
};

export const ICAL_UID_SUFFIX = "@azhunebi.ical";
export const ICAL_UID_COMMENT_PREFIX = "icalUid:";
export const ICAL_SOURCE = "Booking";
export const ICAL_GUEST_NAME = "Booking.com";
