import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  AdminInitResponse,
  AdminSettingsPayload,
  AdminViewName,
  BookingRecord,
} from "./types";

export type AdminDesktopContext = {
  bookings: BookingRecord[];
  settings: AdminSettingsPayload;
  setBookings: Dispatch<SetStateAction<BookingRecord[]>>;
  setSettings: Dispatch<SetStateAction<AdminSettingsPayload>>;
  applyServerData: (data: AdminInitResponse, options?: { silent?: boolean }) => void;
  silentSync: () => Promise<void>;
  switchView: (view: AdminViewName) => void;
  setGuestFilter: (filter: { name: string; phone: string } | null) => void;
  openBookingByRow: (event: React.MouseEvent | null, row: number | string) => void;
  editingRowRef: MutableRefObject<number | string | null>;
};
