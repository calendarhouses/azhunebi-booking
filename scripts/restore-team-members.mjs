#!/usr/bin/env node
/**
 * Restore settings.teamMembers in Supabase from a Sheets/GAS export.
 * Usage: node scripts/restore-team-members.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv(file) {
  const p = resolve(root, file);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

/** Members from Sheets Settings (password hashes preserved). Sessions cleared — re-login required. */
const TEAM = {
  members: [
    {
      id: "admin-user-1",
      email: "azhunebi2026",
      name: "Адмін Ажунебі",
      role: "owner",
      passwordHash:
        "e2f2e89d8ae03a17ae32f0c1ee69aaee65abface736dcc082205399b6ab48993",
      salt: "520bcf6597f642e7",
      active: true,
      createdAt: "2026-07-23T12:29:59.872Z",
      inviteToken: null,
      inviteExpiresAt: null,
    },
    {
      id: "u-1784809878387-1cc604eb19f3455d",
      email: "nazar.duzhik02222@gmail.com",
      name: "Назар",
      role: "owner",
      passwordHash:
        "97e7864d3f748f07e7765e9f299f09248806ee8cc6591c6ab358ac47d0867936",
      salt: "791d0bfe3725484e",
      active: true,
      createdAt: "2026-07-23T12:31:18.389Z",
      inviteToken: null,
      inviteExpiresAt: null,
    },
    {
      id: "u-1784811262580-d7bbadb36d08410b",
      email: "9891399@gmail.com",
      name: "Андрій",
      role: "owner",
      passwordHash:
        "52a667781a17c883f11a867e31ce53c57793f2779bd38402abf730f3eac57389",
      salt: "c8c118c58486456a",
      active: true,
      createdAt: "2026-07-23T12:54:22.582Z",
      inviteToken: null,
      inviteExpiresAt: null,
    },
    {
      id: "u-1784811321917-bc4036e88eda42b2",
      email: "azhunebi@gmail.com",
      name: "АЖ У НЕБІ",
      role: "owner",
      passwordHash:
        "14ef16e6a687cd5636de29f7736d6f0ee446f948bf001fd1ea2cdb5153b6abf9",
      salt: "cc420b8e8b95495e",
      active: true,
      createdAt: "2026-07-23T12:55:21.918Z",
      inviteToken: null,
      inviteExpiresAt: null,
    },
  ],
  sessions: {},
};

const sb = createClient(url, key, { auth: { persistSession: false } });
const { error } = await sb.from("settings").upsert(
  { key: "teamMembers", value: TEAM },
  { onConflict: "key" }
);
if (error) {
  console.error("upsert failed:", error.message);
  process.exit(1);
}

const { data, error: readErr } = await sb
  .from("settings")
  .select("value")
  .eq("key", "teamMembers")
  .maybeSingle();
if (readErr) {
  console.error("read failed:", readErr.message);
  process.exit(1);
}
const members = data?.value?.members || [];
console.log(
  "OK restored",
  members.length,
  "members:",
  members.map((m) => `${m.email} (${m.name})`).join(", ")
);
