"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Link2,
  Plus,
  RefreshCw,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import {
  createTeamMember,
  listTeamMembers,
  updateTeamMember,
  type TeamMemberPublic,
} from "@/lib/gas-api";
import { roleLabelUk, TEAM_MAX_MEMBERS } from "@/lib/admin/permissions";
import { showToast } from "../adminGlobals";
import "./settings-team.css";

type CreateMode = "password" | "invite";

function TeamLoader({ label = "Завантажуємо" }: { label?: string }) {
  return (
    <div className="team-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="team-loader__head">
        <span className="team-loader__ring" aria-hidden />
        <span className="team-loader__label">
          {label}
          <span className="team-loader__dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </span>
      </div>
      <div className="team-loader__skel team-loader__skel--members">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="team-loader__card" aria-hidden>
            <div className="team-loader__avatar" />
            <div className="team-loader__lines">
              <span className="team-loader__line team-loader__line--lg" />
              <span className="team-loader__line team-loader__line--md" />
              <span className="team-loader__line team-loader__line--sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamRoleSeg({
  value,
  disabled,
  size = "sm",
  onChange,
  "aria-label": ariaLabel,
}: {
  value: "owner" | "admin";
  disabled?: boolean;
  size?: "sm" | "lg";
  onChange: (next: "owner" | "admin") => void;
  "aria-label"?: string;
}) {
  return (
    <div
      className={`team-seg${size === "lg" ? " team-seg--lg" : " team-seg--sm"}`}
      role="group"
      aria-label={ariaLabel || "Роль"}
    >
      {(
        [
          { id: "owner" as const, label: "Власник" },
          { id: "admin" as const, label: "Адмін" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`team-seg__btn${value === opt.id ? " team-seg__btn--on" : ""}`}
          disabled={disabled}
          aria-pressed={value === opt.id}
          onClick={() => {
            if (value !== opt.id) onChange(opt.id);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function initialFrom(name: string, email: string): string {
  const s = (name || email || "?").trim();
  return s.charAt(0).toUpperCase();
}

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

  const loadMembers = useCallback(async () => {
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
    void loadMembers();
  }, [isActive, loadMembers]);

  const seatsLeft = Math.max(0, maxMembers - members.filter((m) => m.active).length);
  const canAdd = seatsLeft > 0 && !saving;
  const activeOwners = members.filter((m) => m.active && m.role === "owner").length;
  const activeAdmins = members.filter((m) => m.active && m.role === "admin").length;

  const sorted = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
        if (a.active !== b.active) return a.active ? -1 : 1;
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
      await loadMembers();
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
      await loadMembers();
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
      await loadMembers();
      showToast("Роль оновлено");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Помилка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="team-page">
      <div className="team-page__top">
        <p className="team-page__intro">
          До {maxMembers} акаунтів. Власники бачать усе; адміністратор — шахматку, броні та гостей.
        </p>
      </div>

      <section className="team-hero">
        <div className="team-hero__main">
          <div className="team-hero__icon" aria-hidden>
            <Users size={22} strokeWidth={1.75} />
          </div>
          <div className="team-hero__copy">
            <span className="team-hero__label">Вільних місць</span>
            <strong className="team-hero__value">
              {seatsLeft}{" "}
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--team-stone-500)" }}>
                / {maxMembers}
              </span>
            </strong>
            <span className="team-hero__hint">
              Активних: {members.filter((m) => m.active).length}
            </span>
          </div>
        </div>
        <div className="team-hero__meta">
          <span className="team-chip team-chip--accent">Власників: {activeOwners}</span>
          <span className="team-chip">Адмінів: {activeAdmins}</span>
        </div>
      </section>

      <section className="team-card">
        <div className="team-card__header team-card__header--row">
          <div>
            <div className="team-card__title-row">
              <span className="team-card__title-icon" aria-hidden>
                <Shield size={16} strokeWidth={1.75} />
              </span>
              <h3>Учасники</h3>
            </div>
            <p>Ролі, доступ і запрошення в одному місці</p>
          </div>
          <button
            type="button"
            className="team-btn team-btn--ghost team-btn--icon"
            disabled={loading || saving}
            onClick={() => void loadMembers()}
            aria-label="Оновити"
            title="Оновити"
          >
            <RefreshCw size={15} className={loading ? "team-spin" : undefined} />
          </button>
        </div>

        {loading ? (
          <TeamLoader label="Завантажуємо команду" />
        ) : sorted.length === 0 ? (
          <p className="team-empty">Поки немає учасників</p>
        ) : (
          <ul className="team-members">
            {sorted.map((m) => (
              <li key={m.id} className={`team-member${!m.active ? " team-member--off" : ""}`}>
                <div
                  className={`team-member__avatar team-member__avatar--${
                    m.role === "owner" ? "owner" : "admin"
                  }`}
                  aria-hidden
                >
                  {initialFrom(m.name, m.email)}
                </div>
                <div className="team-member__body">
                  <div className="team-member__name">{m.name || "Без імені"}</div>
                  <div className="team-member__email">{m.email}</div>
                  <div className="team-member__tags">
                    <span
                      className={`team-tag team-tag--${m.role === "owner" ? "owner" : "admin"}`}
                    >
                      {roleLabelUk(m.role)}
                    </span>
                    {m.hasPendingInvite ? (
                      <span className="team-tag team-tag--pending">Очікує запрошення</span>
                    ) : null}
                    {!m.active ? <span className="team-tag team-tag--off">Вимкнено</span> : null}
                  </div>
                </div>
                <div className="team-member__actions">
                  <TeamRoleSeg
                    value={m.role}
                    disabled={saving}
                    aria-label={`Роль ${m.name || m.email}`}
                    onChange={(next) => void setMemberRole(m, next)}
                  />
                  <button
                    type="button"
                    className={`team-btn ${m.active ? "team-btn--danger" : "team-btn--ghost"}`}
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
      </section>

      <section className="team-add">
        <div className="team-add__head">
          <span className="team-add__head-icon" aria-hidden>
            <UserPlus size={16} strokeWidth={1.75} />
          </span>
          <strong>Додати людину</strong>
        </div>

        <div className="team-form-grid">
          <label className="team-field">
            <span className="team-field__label">Імʼя</span>
            <input
              className="team-field__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Юлія"
              disabled={!canAdd}
              autoComplete="off"
            />
          </label>
          <label className="team-field">
            <span className="team-field__label">Логін / email</span>
            <input
              className="team-field__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yulia@…"
              disabled={!canAdd}
              autoComplete="off"
            />
          </label>
        </div>

        <div className="team-mode-row">
          {(
            [
              { id: "invite" as const, label: "Запрошення-лінк", Icon: Link2 },
              { id: "password" as const, label: "Логін + пароль", Icon: Shield },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`team-mode${mode === id ? " team-mode--on" : ""}`}
              onClick={() => setMode(id)}
              disabled={!canAdd}
            >
              <Icon size={14} strokeWidth={2} />
              {label}
            </button>
          ))}
          <TeamRoleSeg
            value={role}
            size="lg"
            disabled={!canAdd}
            aria-label="Роль нового учасника"
            onChange={setRole}
          />
        </div>

        {mode === "password" ? (
          <label className="team-field team-field--full" style={{ marginBottom: 14 }}>
            <span className="team-field__label">Тимчасовий пароль</span>
            <input
              className="team-field__input"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="мін. 6 символів"
              disabled={!canAdd}
              autoComplete="new-password"
            />
          </label>
        ) : null}

        <button
          type="button"
          className="team-btn team-btn--primary"
          disabled={!canAdd}
          onClick={() => void handleCreate()}
        >
          <Plus size={16} strokeWidth={2.2} />
          {saving ? "Збереження…" : seatsLeft <= 0 ? "Ліміт акаунтів" : "Додати до команди"}
        </button>

        {lastInviteUrl ? (
          <div className="team-invite">
            <code>{lastInviteUrl}</code>
            <button
              type="button"
              className="team-btn team-btn--ghost team-btn--icon"
              onClick={() => void copyInvite()}
              aria-label="Скопіювати запрошення"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
