import {
  apiBookingToDb,
  dbBookingToApi,
  getDb,
  type ApiBooking,
  type DbBookingRow,
} from "@/lib/db/mappers";

export async function listBookings(): Promise<ApiBooking[]> {
  const sb = getDb();
  const { data, error } = await sb.from("bookings").select("*").order("check_in", {
    ascending: true,
  });
  if (error) throw new Error(`listBookings: ${error.message}`);
  return (data as DbBookingRow[]).map((row, i) => dbBookingToApi(row, i));
}

export async function listBookingsPublic(): Promise<ApiBooking[]> {
  const all = await listBookings();
  return all
    .filter((b) => b.assignmentState !== "holding")
    .map((b) => ({
      id: b.id,
      row: b.row,
      roomId: b.roomId,
      cottage: b.cottage,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      status: b.status,
      comment: b.comment,
      assignmentState: b.assignmentState,
    }));
}

export async function getBookingById(id: string): Promise<ApiBooking | null> {
  const sb = getDb();
  const { data, error } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getBookingById: ${error.message}`);
  if (!data) return null;
  return dbBookingToApi(data as DbBookingRow);
}

export async function upsertBooking(api: ApiBooking): Promise<ApiBooking> {
  const row = apiBookingToDb(api);
  if (!row) throw new Error("upsertBooking: missing id");
  const sb = getDb();

  // Preserve change_history / created_at if not provided
  if (!row.created_at || !(row.change_history as unknown[])?.length) {
    const existing = await getBookingById(row.id);
    if (existing) {
      if (!row.created_at) row.created_at = String(existing.createdAt || "") || null;
      if (!(row.change_history as unknown[])?.length) {
        const { data: raw } = await sb
          .from("bookings")
          .select("change_history")
          .eq("id", row.id)
          .maybeSingle();
        if (raw?.change_history) row.change_history = raw.change_history;
      }
    }
  }

  const { error } = await sb.from("bookings").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`upsertBooking: ${error.message}`);
  const out = await getBookingById(row.id);
  if (!out) throw new Error("upsertBooking: missing after write");
  return out;
}

export async function deleteBookingById(id: string): Promise<boolean> {
  const sb = getDb();
  const { error, count } = await sb
    .from("bookings")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw new Error(`deleteBooking: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function patchBookingMeta(
  id: string,
  patch: Record<string, unknown>,
  columnPatch?: Partial<DbBookingRow>
): Promise<ApiBooking | null> {
  const sb = getDb();
  const { data, error } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`patchBookingMeta: ${error.message}`);
  if (!data) return null;
  const row = data as DbBookingRow;
  const meta = { ...(row.meta || {}), ...patch };
  const next = { ...row, ...columnPatch, meta };
  const { error: upErr } = await sb.from("bookings").upsert(next, { onConflict: "id" });
  if (upErr) throw new Error(`patchBookingMeta upsert: ${upErr.message}`);
  return getBookingById(id);
}

export async function appendChangeHistory(
  id: string,
  entry: Record<string, unknown>
): Promise<void> {
  const sb = getDb();
  const { data, error } = await sb
    .from("bookings")
    .select("change_history")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`appendChangeHistory: ${error.message}`);
  const prev = Array.isArray(data?.change_history) ? data!.change_history : [];
  const next = [...prev, { id: `h-${Date.now()}`, at: new Date().toISOString(), ...entry }];
  const { error: upErr } = await sb
    .from("bookings")
    .update({ change_history: next })
    .eq("id", id);
  if (upErr) throw new Error(`appendChangeHistory update: ${upErr.message}`);
}

/** Overlap: same room, ranges [checkIn, checkOut) intersect, excluding cancelled/holding/self. */
export async function findOverlappingBookings(params: {
  roomId: string;
  checkIn: string;
  checkOut: string;
  excludeId?: string;
}): Promise<ApiBooking[]> {
  const all = await listBookings();
  const checkIn = params.checkIn;
  const checkOut = params.checkOut;
  return all.filter((b) => {
    if (params.excludeId && String(b.id) === params.excludeId) return false;
    const status = String(b.status || "");
    if (/скасов|cancel|reject/i.test(status)) return false;
    if (b.assignmentState === "holding") return false;
    const roomMatch =
      String(b.roomId ?? "") === String(params.roomId) ||
      (!b.roomId && String(b.cottage || "") === String(params.roomId));
    if (!roomMatch && String(b.roomId ?? "") !== String(params.roomId)) {
      // also match by cottage name vs room id handled by caller usually
      if (String(b.roomId ?? "") !== String(params.roomId)) return false;
    }
    const bi = String(b.checkIn || "");
    const bo = String(b.checkOut || "");
    if (!bi || !bo) return false;
    return bi < checkOut && bo > checkIn;
  });
}

export async function bookingsChecksum(): Promise<{
  count: number;
  totalPriceSum: number;
  paidSum: number;
  ids: string[];
}> {
  const all = await listBookings();
  let totalPriceSum = 0;
  let paidSum = 0;
  const ids: string[] = [];
  for (const b of all) {
    ids.push(String(b.id));
    totalPriceSum += Number(b.totalPrice) || 0;
    paidSum += Number(b.paidAmount) || 0;
  }
  ids.sort();
  return { count: all.length, totalPriceSum, paidSum, ids };
}
