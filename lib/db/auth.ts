import { createHash, randomBytes } from "crypto";
import { loadAllSettings, saveSettingsKey } from "@/lib/db/settings";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TEAM_MAX_MEMBERS = 5;

export type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin";
  passwordHash?: string;
  salt?: string;
  active?: boolean;
  createdAt?: string;
  inviteToken?: string | null;
  inviteExpiresAt?: string | null;
};

export type TeamSession = {
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type TeamState = {
  members: TeamMember[];
  sessions: Record<string, TeamSession>;
};

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("hex");
}

export function hashPassword(password: string, salt: string): string {
  return createHash("sha256")
    .update(`${salt || ""}:${password || ""}`, "utf8")
    .digest("hex");
}

function publicMember(member: TeamMember | null) {
  if (!member) return null;
  return {
    id: member.id,
    email: member.email,
    name: member.name || "",
    role: member.role === "admin" ? "admin" : "owner",
    active: member.active !== false,
    createdAt: member.createdAt || "",
    hasPendingInvite: Boolean(member.inviteToken),
  };
}

function findByEmail(team: TeamState, email: string) {
  const needle = normalizeEmail(email);
  return team.members.find((m) => normalizeEmail(m.email) === needle) || null;
}

function findById(team: TeamState, id: string) {
  return team.members.find((m) => String(m.id) === String(id)) || null;
}

function bootstrapTeam(): TeamState {
  const email =
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.GAS_ADMIN_EMAIL?.trim() ||
    "Azhunebi2026";
  const password =
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.GAS_ADMIN_PASSWORD?.trim() ||
    "azhunebi12345";
  const salt = randomToken(8);
  const member: TeamMember = {
    id: "owner-1",
    email: normalizeEmail(email),
    name: "Власник",
    role: "owner",
    passwordHash: hashPassword(password, salt),
    salt,
    active: true,
    createdAt: new Date().toISOString(),
    inviteToken: null,
    inviteExpiresAt: null,
  };
  return { members: [member], sessions: {} };
}

export async function loadTeamState(): Promise<TeamState> {
  const settings = await loadAllSettings();
  const raw = settings.teamMembers;
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as TeamState).members)) {
    const boot = bootstrapTeam();
    await saveSettingsKey("teamMembers", boot);
    return boot;
  }
  const team = raw as TeamState;
  if (!team.sessions || typeof team.sessions !== "object") team.sessions = {};
  if (!team.members.length) {
    const boot = bootstrapTeam();
    await saveSettingsKey("teamMembers", boot);
    return boot;
  }
  return team;
}

async function saveTeamState(team: TeamState): Promise<void> {
  await saveSettingsKey("teamMembers", team);
}

export async function resolveSessionUser(token: string): Promise<TeamMember | null> {
  if (!token) return null;
  const team = await loadTeamState();
  const legacy = process.env.LEGACY_ADMIN_TOKEN?.trim();
  if (legacy && token === legacy) {
    return (
      team.members.find((m) => m.role === "owner" && m.active !== false) ||
      team.members[0] ||
      null
    );
  }
  const sess = team.sessions[token];
  if (!sess) return null;
  if (sess.expiresAt && new Date(sess.expiresAt).getTime() < Date.now()) {
    delete team.sessions[token];
    await saveTeamState(team);
    return null;
  }
  const member = findById(team, sess.userId);
  if (!member || member.active === false) return null;
  return member;
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ accessToken: string; user: { id: string; email: string; name: string } }> {
  const team = await loadTeamState();
  const member = findByEmail(team, email);
  if (!member || member.active === false) {
    throw Object.assign(new Error("Невірний email або пароль"), { code: "INVALID_CREDENTIALS" });
  }
  const expected = hashPassword(password, member.salt || "");
  if (expected !== member.passwordHash) {
    throw Object.assign(new Error("Невірний email або пароль"), { code: "INVALID_CREDENTIALS" });
  }
  const token = randomToken(24);
  team.sessions[token] = {
    userId: member.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
  await saveTeamState(team);
  return {
    accessToken: token,
    user: { id: member.id, email: member.email, name: member.name || "" },
  };
}

export async function logoutToken(token: string): Promise<void> {
  if (!token) return;
  const team = await loadTeamState();
  if (team.sessions[token]) {
    delete team.sessions[token];
    await saveTeamState(team);
  }
}

export async function verifyToken(token: string): Promise<{
  valid: boolean;
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
}> {
  const member = await resolveSessionUser(token);
  if (!member) return { valid: false };
  return {
    valid: true,
    userId: member.id,
    email: member.email,
    name: member.name,
    role: member.role,
  };
}

export async function adminBoot(token: string) {
  const member = await resolveSessionUser(token);
  if (!member) {
    throw Object.assign(new Error("UNAUTHORIZED"), { code: "UNAUTHORIZED" });
  }
  return {
    user: { id: member.id, email: member.email, name: member.name || "" },
    accessToken: token,
    membership: {
      tenantId: "default",
      role: member.role,
      tenantName: "Azhunebi",
      plan: "pro",
      displayName: member.name || null,
      userId: member.id,
      email: member.email,
    },
  };
}

export async function listTeamMembersPublic() {
  const team = await loadTeamState();
  return {
    members: team.members.map((m) => publicMember(m)).filter(Boolean),
    maxMembers: TEAM_MAX_MEMBERS,
  };
}

export async function createTeamMember(params: {
  email: string;
  name: string;
  role?: string;
  mode?: "password" | "invite";
  password?: string;
  inviteBaseUrl?: string;
  actorRole: string;
}) {
  if (params.actorRole !== "owner") {
    throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
  }
  const team = await loadTeamState();
  if (team.members.filter((m) => m.active !== false).length >= TEAM_MAX_MEMBERS) {
    throw Object.assign(new Error("Ліміт учасників"), { code: "TEAM_FULL" });
  }
  const email = normalizeEmail(params.email);
  if (findByEmail(team, email)) {
    throw Object.assign(new Error("Email вже існує"), { code: "EXISTS" });
  }
  const member: TeamMember = {
    id: `u-${Date.now()}`,
    email,
    name: String(params.name || "").trim() || email,
    role: params.role === "admin" ? "admin" : "owner",
    active: true,
    createdAt: new Date().toISOString(),
    inviteToken: null,
    inviteExpiresAt: null,
  };
  let inviteUrl: string | undefined;
  let inviteToken: string | undefined;
  if (params.mode === "invite") {
    inviteToken = randomToken(16);
    member.inviteToken = inviteToken;
    member.inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
    const base = (params.inviteBaseUrl || "").replace(/\/$/, "");
    inviteUrl = base ? `${base}/invite/${inviteToken}` : undefined;
  } else {
    const salt = randomToken(8);
    member.salt = salt;
    member.passwordHash = hashPassword(String(params.password || ""), salt);
  }
  team.members.push(member);
  await saveTeamState(team);
  return { success: true, member: publicMember(member), inviteUrl, inviteToken };
}

export async function requireSession(
  token: string | null | undefined
): Promise<TeamMember> {
  const member = await resolveSessionUser(String(token || ""));
  if (!member) {
    throw Object.assign(new Error("UNAUTHORIZED"), { code: "UNAUTHORIZED" });
  }
  return member;
}

export async function updateTeamMember(params: {
  id: string;
  name?: string;
  role?: string;
  active?: boolean;
  password?: string;
  actorRole: string;
  actorId: string;
}) {
  if (params.actorRole !== "owner") {
    throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
  }
  const team = await loadTeamState();
  const member = findById(team, params.id);
  if (!member) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });

  if (params.name != null) member.name = String(params.name);
  if (params.role === "admin" || params.role === "owner") member.role = params.role;
  if (params.active != null) {
    if (
      member.role === "owner" &&
      params.active === false &&
      team.members.filter((m) => m.role === "owner" && m.active !== false).length <= 1
    ) {
      throw Object.assign(new Error("Cannot deactivate last owner"), { code: "LAST_OWNER" });
    }
    member.active = Boolean(params.active);
  }
  if (params.password && String(params.password).length >= 6) {
    const salt = randomToken(8);
    member.salt = salt;
    member.passwordHash = hashPassword(String(params.password), salt);
  }
  await saveTeamState(team);
  return { success: true, member: publicMember(member) };
}

export async function getInviteInfo(inviteToken: string) {
  const team = await loadTeamState();
  const member = team.members.find((m) => m.inviteToken === inviteToken);
  if (!member) return { ok: false, reason: "not_found" };
  if (
    member.inviteExpiresAt &&
    new Date(member.inviteExpiresAt).getTime() < Date.now()
  ) {
    return { ok: false, reason: "expired" };
  }
  return {
    ok: true,
    email: member.email,
    name: member.name,
    role: member.role,
  };
}

export async function acceptTeamInvite(params: {
  inviteToken: string;
  password: string;
  name?: string;
}) {
  const team = await loadTeamState();
  const member = team.members.find((m) => m.inviteToken === params.inviteToken);
  if (!member) {
    throw Object.assign(new Error("Invite not found"), { code: "NOT_FOUND" });
  }
  if (
    member.inviteExpiresAt &&
    new Date(member.inviteExpiresAt).getTime() < Date.now()
  ) {
    throw Object.assign(new Error("Invite expired"), { code: "EXPIRED" });
  }
  if (String(params.password || "").length < 6) {
    throw Object.assign(new Error("Weak password"), { code: "WEAK_PASSWORD" });
  }
  const salt = randomToken(8);
  member.salt = salt;
  member.passwordHash = hashPassword(params.password, salt);
  if (params.name) member.name = String(params.name);
  member.inviteToken = null;
  member.inviteExpiresAt = null;
  const token = randomToken(24);
  team.sessions[token] = {
    userId: member.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
  await saveTeamState(team);
  return {
    success: true,
    accessToken: token,
    user: { id: member.id, email: member.email, name: member.name || "" },
  };
}

export function checkWebhookSecret(provided: unknown): boolean {
  const expected =
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    "";
  if (!expected) return false;
  return String(provided || "") === expected;
}
