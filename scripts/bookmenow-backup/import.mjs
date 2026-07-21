#!/usr/bin/env node
/**
 * Import BookMeNow backup → azhunebi GAS bookings.
 *
 * Usage:
 *   node scripts/bookmenow-backup/import.mjs              # dry-run
 *   node scripts/bookmenow-backup/import.mjs --apply      # write
 *   node scripts/bookmenow-backup/import.mjs --apply --limit=5
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env.bookmenow.local"));

const APPLY = process.argv.includes("--apply");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0) || 0;

const BACKUP =
  process.env.BOOKMENOW_BACKUP_JSON ||
  path.join(__dirname, "data/20260721-210629/serviceOrders.full.json");
const ROOM_MAP = process.env.BOOKMENOW_ROOM_MAP || path.join(__dirname, "room-map.json");
const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL?.trim();
const ADMIN_EMAIL = process.env.BOOKMENOW_IMPORT_EMAIL || "Azhunebi2026";
const ADMIN_PASSWORD = process.env.BOOKMENOW_IMPORT_PASSWORD || "azhunebi12345";

if (!GAS_URL) {
  console.error("NEXT_PUBLIC_GAS_URL missing");
  process.exit(1);
}

async function gasPost(body, token) {
  const payload = {
    ...body,
    ...(token ? { accessToken: token } : {}),
  };
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`GAS non-JSON (${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(`GAS HTTP ${res.status}: ${text.slice(0, 300)}`);
  return data;
}

async function gasGet(action, token) {
  const url = new URL(GAS_URL);
  url.searchParams.set("action", action);
  if (token) {
    url.searchParams.set("accessToken", token);
    url.searchParams.set("token", token);
  }
  const res = await fetch(url.toString(), { redirect: "follow" });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`GAS GET non-JSON (${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(`GAS GET HTTP ${res.status}: ${text.slice(0, 300)}`);
  return data;
}

function extractRoomsList(payload) {
  if (Array.isArray(payload?.roomsList)) return payload.roomsList;
  if (Array.isArray(payload?.settings?.roomsList)) return payload.settings.roomsList;
  if (Array.isArray(payload?.rooms)) return payload.rooms;
  const nested = payload?.tenants?.[0]?.tenant_settings?.[0]?.rooms_list;
  if (Array.isArray(nested)) return nested;
  return [];
}

function mapPaymentMethod(operationType) {
  const t = String(operationType || "").toLowerCase();
  if (t.includes("cash")) return "Готівка";
  if (t.includes("mono") || t.includes("card") || t.includes("acquir")) return "Картка";
  return "ФОП";
}

function mapStatus(order) {
  const paid = Math.round(Number(order.paidAmount) || 0);
  const status = String(order.status || "");
  if (status === "done" || status === "checkedIn") return "Підтверджено";
  if (paid > 0) return "Підтверджено";
  return "Очікує оплату";
}

function buildPayments(order) {
  const list = [];
  for (const p of order.payments || []) {
    if (String(p.status) !== "success") continue;
    const amount = Math.round(Number(p.amount) || 0);
    if (!amount) continue;
    const op = String(p.operationType || "");
    const isRefund = op === "refund" || amount < 0;
    const paidAt = String(p.paidAt || p.createdAt || order.createdAt || "").slice(0, 10);
    list.push({
      id: String(p._id || `bmn-${list.length}`),
      date: paidAt,
      amount: Math.abs(amount) * (isRefund ? -1 : 1),
      method: mapPaymentMethod(op),
      type: isRefund ? "refund" : list.length === 0 ? "prepay" : "surcharge",
      note: op ? `BookMeNow: ${op}` : "BookMeNow",
    });
  }
  return list;
}

function buildComment(order) {
  const parts = [];
  const children = Math.round(Number(order.guests?.children) || 0);
  if (children > 0) parts.push(`👶 Діти: ${children}`);
  const raw = String(order.comment || "").trim();
  if (raw) parts.push(raw);
  parts.push(`bookmenowId:${order._id}`);
  if (order.orderNumber != null) parts.push(`BMN#${order.orderNumber}`);
  return parts.join(" | ");
}

function transformOrder(order, roomByBmnId, roomsByShort) {
  const chessboard = roomByBmnId.get(String(order.roomId));
  if (!chessboard) {
    return { error: `unmapped roomId ${order.roomId}`, order };
  }
  const ourRoom = roomsByShort.get(chessboard);
  if (!ourRoom) {
    return { error: `no azhunebi room with short="${chessboard}"`, order };
  }

  const client = order.client || {};
  const name = `${client.firstName || ""} ${client.lastName || ""}`.trim() || "Гість";
  const phone = String(client.phoneNumber || "").trim() || "Не вказано";
  const totalPrice = Math.round(
    Number(order.finalPrice ?? order.overallPrice ?? order.totalPrice ?? order.fixedFinalPrice) || 0
  );
  const paidAmount = Math.round(Number(order.paidAmount) || 0);
  const payments = buildPayments(order);
  const prepayAmount = payments.length
    ? Math.round(Number(payments.filter((p) => p.type === "prepay").reduce((s, p) => s + p.amount, 0)) || paidAmount)
    : paidAmount;
  const surchargeAmount = Math.max(0, paidAmount - Math.max(0, prepayAmount));
  const adults = Math.max(1, Math.round(Number(order.guests?.adults) || 2));
  const status = mapStatus(order);
  const importId = `BMN-${order._id}`;

  return {
    payload: {
      action: "createBooking",
      importId,
      source: "BookMeNow",
      adminOverrideRestrictions: true,
      name,
      phone,
      checkIn: order.serviceDateFrom,
      checkOut: order.serviceDateTo,
      cottage: chessboard,
      roomId: ourRoom.id,
      guests: adults,
      pets: "Ні",
      status,
      comment: buildComment(order),
      totalPrice,
      basePrice: Math.round(Number(order.servicesCost ?? totalPrice) || totalPrice),
      discountAmount: Math.round(Number(order.discountAmount) || 0),
      paidAmount,
      prepayAmount: Math.max(0, prepayAmount),
      prepayMethod: payments.find((p) => p.type === "prepay")?.method || "ФОП",
      surchargeAmount,
      surchargeMethod: payments.find((p) => p.type === "surcharge")?.method || "Готівка",
      payments,
      assignmentState: "assigned",
      createdAt: String(order.createdAt || "").replace("T", " ").slice(0, 19),
    },
    meta: {
      importId,
      chessboard,
      roomId: ourRoom.id,
      status,
      totalPrice,
      paidAmount,
      guest: name,
      phone,
      checkIn: order.serviceDateFrom,
      checkOut: order.serviceDateTo,
      bmnStatus: order.status,
      bmnRoomId: order.roomId,
    },
  };
}

async function main() {
  const orders = JSON.parse(fs.readFileSync(BACKUP, "utf8"));
  const roomMapDoc = JSON.parse(fs.readFileSync(ROOM_MAP, "utf8"));
  const roomByBmnId = new Map();
  for (const r of roomMapDoc.rooms || []) {
    if (r.bookmenowRoomId && r.azhunebiChessboardName) {
      roomByBmnId.set(String(r.bookmenowRoomId), r.azhunebiChessboardName);
    }
  }

  console.log(`Orders in backup: ${orders.length}`);
  console.log(`Room map entries: ${roomByBmnId.size}`);
  console.log(`Mode: ${APPLY ? "APPLY (writes to GAS)" : "DRY-RUN"}`);

  const login = await gasPost({
    action: "login",
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (!login.success || !login.accessToken) {
    console.error("Login failed", login);
    process.exit(1);
  }
  const token = login.accessToken;
  console.log("Logged in");

  let settings = await gasPost({ action: "settings" }, token);
  let resolvedRooms = extractRoomsList(settings);
  if (!resolvedRooms.length) {
    settings = await gasGet("settings", token);
    resolvedRooms = extractRoomsList(settings);
  }
  if (!resolvedRooms.length) {
    const init = await gasGet("adminInitData", token);
    resolvedRooms = extractRoomsList(init);
    settings = { ...settings, ...init };
  }

  console.log(`Azhunebi rooms: ${resolvedRooms.length}`);
  if (resolvedRooms.length) {
    console.log(
      "  rooms:",
      resolvedRooms.map((r) => `${r.id}:${r.short || r.name}`).join(", ")
    );
  }
  const roomsByShort = new Map();
  for (const r of resolvedRooms) {
    const short = String(r.short || "").trim();
    const name = String(r.name || "").trim();
    if (short) roomsByShort.set(short, r);
    // also allow matching "Будиночок N" if only name differs
    if (name && !roomsByShort.has(name)) roomsByShort.set(name, r);
  }

  for (let n = 1; n <= 12; n++) {
    const key = `Будиночок ${n}`;
    if (!roomsByShort.has(key)) {
      console.warn(`WARNING: missing room short/name "${key}" in azhunebi settings`);
    } else {
      console.log(`  ✓ ${key} → id=${roomsByShort.get(key).id}`);
    }
  }

  let list = orders.slice().sort((a, b) =>
    String(a.serviceDateFrom).localeCompare(String(b.serviceDateFrom))
  );
  if (LIMIT > 0) list = list.slice(0, LIMIT);

  const prepared = [];
  const errors = [];
  for (const order of list) {
    const result = transformOrder(order, roomByBmnId, roomsByShort);
    if (result.error) errors.push(result);
    else prepared.push(result);
  }

  console.log(`Prepared: ${prepared.length}, errors: ${errors.length}`);
  if (errors.length) {
    const byErr = {};
    for (const e of errors) byErr[e.error] = (byErr[e.error] || 0) + 1;
    console.log("Error summary:", byErr);
  }

  const previewPath = path.join(__dirname, "data", "import-preview.json");
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });
  fs.writeFileSync(
    previewPath,
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        preparedCount: prepared.length,
        errorCount: errors.length,
        sample: prepared.slice(0, 5).map((p) => p.meta),
        errors: errors.slice(0, 20),
      },
      null,
      2
    )
  );
  console.log(`Preview → ${previewPath}`);

  if (!APPLY) {
    console.log("Dry-run only. Re-run with --apply to write.");
    return;
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const failSamples = [];

  for (let i = 0; i < prepared.length; i++) {
    const { payload, meta } = prepared[i];
    try {
      const res = await gasPost(payload, token);
      if (res.skipped) {
        skipped += 1;
        process.stdout.write(`s`);
      } else if (res.success) {
        ok += 1;
        process.stdout.write(`.`);
      } else {
        failed += 1;
        failSamples.push({ meta, res });
        process.stdout.write(`x`);
      }
    } catch (err) {
      failed += 1;
      failSamples.push({ meta, error: String(err) });
      process.stdout.write(`!`);
    }
    if ((i + 1) % 50 === 0) process.stdout.write(` [${i + 1}/${prepared.length}]\n`);
    await new Promise((r) => setTimeout(r, 120));
  }
  console.log("");
  console.log({ ok, skipped, failed });
  if (failSamples.length) {
    const failPath = path.join(__dirname, "data", "import-failures.json");
    fs.writeFileSync(failPath, JSON.stringify(failSamples.slice(0, 50), null, 2));
    console.log(`Failures sample → ${failPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
