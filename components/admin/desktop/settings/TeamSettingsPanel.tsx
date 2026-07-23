"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Shield, UserPlus, Users } from "lucide-react";
import {
  createTeamMember,
  listTeamMembers,
  updateTeamMember,
  type TeamMemberPublic,
} from "@/lib/gas-api";
import { roleLabelUk, TEAM_MAX_MEMBERS } from "@/lib/admin/permissions";
import { showToast } from "../adminGlobals";
import "./settings-additional-services.css";

type CreateMode = "password" | "invite";

export function TeamSettingsPanel({ isActive = true }: { isActive?: boolean }) {
  const [members, setMembers] = useState<TeamMemberPublic[]>([]);
  const [maxMembers, setMaxMembers] = useState(TEAM_MAX_MEMBERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "admin">("admin");
  const [mode, setMode] = useState<CreateMode>("invite");
  const [password, setPassword] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTeamMembers();
      setMembers(data.members);
      setMaxMembers(data.maxMembers);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не вдалося завантажити команду");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void load();
  }, [isActive, load]);

  const seatsLeft = Math.max(0, maxMembers - members.filter((m) => m.active).length);
  const canAdd = seatsLeft > 0 && !saving;

  const sorted = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
        return a.name.localeCompare(b.name, "uk");
      }),
    [members]
  );

  const handleCreate = async () => {
    if (!name.trim() || !email.trim()) {
      showToast("Вкажіть імʼя та логін");
      return;
    }
    if (mode === "password" && password.length < 6) {
      showToast("Пароль щонайменше 6 символів");
      return;
    }
    setSaving(true);
    setLastInviteUrl(null);
    try {
      const result = await createTeamMember({
        name: name.trim(),
        email: email.trim(),
        role,
        mode,
        password: mode === "password" ? password : undefined,
        inviteBaseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      setName("");
      setEmail("");
      setPassword("");
      setRole("admin");
      if (result.inviteUrl) setLastInviteUrl(result.inviteUrl);
      showToast(mode === "invite" ? "Запрошення створено" : "Акаунт додано");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Помилка збереження");
    } finally {
      setSaving(false);
    }
  };

  const copyInvite = async () => {
    if (!lastInviteUrl) return;
    try {
      await navigator.clipboard.writeText(lastInviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      showToast("Не вдалося скопіювати");
    }
  };

  const toggleActive = async (member: TeamMemberPublic) => {
    setSaving(true);
    try {
      await updateTeamMember({ id: member.id, active: !member.active });
      await load();
      showToast(member.active ? "Доступ вимкнено" : "Доступ увімкнено");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Помилка");
    } finally {
      setSaving(false);
    }
  };

  const setMemberRole = async (member: TeamMemberPublic, next: "owner" | "admin") => {
    if (member.role === next) return;
    setSaving(true);
    try {
      await updateTeamMember({ id: member.id, role: next });
      await load();
      showToast("Роль оновлено");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Помилка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="svc-accordion is-open" style={{ border: "none", boxShadow: "none" }}>
      <div className="svc-accordion__panel" style={{ paddingTop: 8 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 22 }}>
          <span
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(145deg, #1A332A, #2F5D4A)",
              color: "#F4F7F5",
              flexShrink: 0,
            }}
          >
            <Users size={20} />
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#14241E" }}>Команда</h3>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#5B6B64", lineHeight: 1.45 }}>
              До {maxMembers} акаунтів. Власники бачать усе; адміністратор — шахматку, броні та гостей.
              {seatsLeft >= 0 ? ` Вільних місць: ${seatsLeft}.` : null}
            </p>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "#78716c", fontSize: 14 }}>Завантаження…</p>
        ) : (
          <ul style={{ listStyle: "none", margin: "0 0 28px", padding: 0, display: "grid", gap: 10 }}>
            {sorted.map((m) => (
              <li
                key={m.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "14px 16px",
                  borderRadius: 16,
                  background: m.active ? "#F7F9F8" : "#F3F1EF",
                  border: "1px solid #E4E9E6",
                  opacity: m.active ? 1 : 0.72,
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: m.role === "owner" ? "#1A332A" : "#DCE8E2",
                    color: m.role === "owner" ? "#F4F7F5" : "#1A332A",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {(m.name || m.email || "?").trim().charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "#14241E", fontSize: 15 }}>{m.name || "Без імені"}</div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{m.email}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: m.role === "owner" ? "#E8F0EC" : "#EEF2FF",
                        color: m.role === "owner" ? "#1A332A" : "#3730A3",
                      }}
                    >
                      {roleLabelUk(m.role)}
                    </span>
                    {m.hasPendingInvite ? (
                      <span style={{ fontSize: 11, color: "#B45309", fontWeight: 600 }}>Очікує запрошення</span>
                    ) : null}
                    {!m.active ? (
                      <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>Вимкнено</span>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
                  <select
                    value={m.role}
                    disabled={saving}
                    onChange={(e) => void setMemberRole(m, e.target.value as "owner" | "admin")}
                    style={{
                      border: "1px solid #D1D5DB",
                      borderRadius: 10,
                      padding: "6px 10px",
                      fontSize: 12,
                      background: "#fff",
                    }}
                  >
                    <option value="owner">Власник</option>
                    <option value="admin">Адміністратор</option>
                  </select>
                  <button
                    type="button"
                    className="btn-outline-danger"
                    style={{ fontSize: 12, padding: "6px 10px" }}
                    disabled={saving}
                    onClick={() => void toggleActive(m)}
                  >
                    {m.active ? "Вимкнути" : "Увімкнути"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div
          style={{
            borderRadius: 20,
            padding: 20,
            background: "linear-gradient(160deg, #F8FAF9 0%, #EEF4F1 100%)",
            border: "1px solid #D7E3DC",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <UserPlus size={18} color="#1A332A" />
            <strong style={{ color: "#14241E" }}>Додати людину</strong>
          </div>

          <div className="svc-form-grid svc-form-grid--2" style={{ marginBottom: 12 }}>
            <label className="svc-field">
              <span className="svc-field__label">Імʼя</span>
              <input
                className="svc-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Юлія"
                disabled={!canAdd}
              />
            </label>
            <label className="svc-field">
              <span className="svc-field__label">Логін / email</span>
              <input
                className="svc-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yulia@…"
                disabled={!canAdd}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {(
              [
                { id: "invite" as const, label: "Запрошення-лінк", Icon: Link2 },
                { id: "password" as const, label: "Логін + пароль", Icon: Shield },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                disabled={!canAdd}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: mode === id ? "1px solid #1A332A" : "1px solid #D1D5DB",
                  background: mode === id ? "#1A332A" : "#fff",
                  color: mode === id ? "#F4F7F5" : "#374151",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "owner" | "admin")}
              disabled={!canAdd}
              style={{
                marginLeft: "auto",
                border: "1px solid #D1D5DB",
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 13,
                background: "#fff",
              }}
            >
              <option value="admin">Роль: Адміністратор</option>
              <option value="owner">Роль: Власник</option>
            </select>
          </div>

          {mode === "password" ? (
            <label className="svc-field" style={{ marginBottom: 14 }}>
              <span className="svc-field__label">Тимчасовий пароль</span>
              <input
                className="svc-input"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="мін. 6 символів"
                disabled={!canAdd}
              />
            </label>
          ) : null}

          <button
            type="button"
            className="btn-primary"
            disabled={!canAdd}
            onClick={() => void handleCreate()}
            style={{ width: "100%" }}
          >
            {saving ? "Збереження…" : seatsLeft <= 0 ? "Ліміт акаунтів" : "Додати до команди"}
          </button>

          {lastInviteUrl ? (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                background: "#fff",
                border: "1px dashed #9CB5A8",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <code style={{ flex: 1, fontSize: 12, wordBreak: "break-all", color: "#1A332A" }}>
                {lastInviteUrl}
              </code>
              <button type="button" className="btn-outline" onClick={() => void copyInvite()}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
