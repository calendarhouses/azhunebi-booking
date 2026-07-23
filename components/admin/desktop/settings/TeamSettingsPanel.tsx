"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  History,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import {
  createTeamMember,
  listActivityLog,
  listTeamMembers,
  updateTeamMember,
  type ActivityLogEntry,
  type TeamMemberPublic,
} from "@/lib/gas-api";
import { roleLabelUk, TEAM_MAX_MEMBERS } from "@/lib/admin/permissions";
import { showToast } from "../adminGlobals";
import "./settings-team.css";

type CreateMode = "password" | "invite";
type TeamSubView = "team" | "activity";
type ActivityTypeFilter = "all" | "booking" | "settings" | "team" | "other";

type FancyOption = { value: string; label: string };

function TeamLoader({
  variant = "members",
  label = "Завантажуємо",
}: {
  variant?: "members" | "journal";
  label?: string;
}) {
  const rows = variant === "journal" ? 3 : 2;
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
      <div className={`team-loader__skel team-loader__skel--${variant}`}>
        {Array.from({ length: rows }).map((_, i) => (
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

function TeamFancySelect({
  value,
  options,
  disabled,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: string;
  options: FancyOption[];
  disabled?: boolean;
  onChange: (next: string) => void;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`team-dd${open ? " team-dd--open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="team-dd__trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="team-dd__label">{current?.label || "—"}</span>
        <ChevronDown size={14} className="team-dd__chev" aria-hidden />
      </button>
      {open ? (
        <div className="team-dd__menu" role="listbox">
          {options.map((opt) => {
            const on = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={on}
                className={`team-dd__option${on ? " team-dd__option--on" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {on ? <Check size={14} className="team-dd__check" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function initialFrom(name: string, email: string): string {
  const s = (name || email || "?").trim();
  return s.charAt(0).toUpperCase();
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return d.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "щойно";
  if (mins < 60) return `${mins} хв тому`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} год тому`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн тому`;
  return formatWhen(iso);
}

function actorKey(entry: ActivityLogEntry): string {
  const a = entry.actor;
  if (!a) return "";
  return String(a.userId || a.email || a.name || "").trim();
}

function actorLabel(entry: ActivityLogEntry): string {
  const a = entry.actor;
  if (!a) return "Невідомо";
  return String(a.name || a.email || "Користувач").trim();
}

function activityKind(type: string): ActivityTypeFilter {
  if (type.startsWith("booking")) return "booking";
  if (type.startsWith("settings")) return "settings";
  if (type.startsWith("team")) return "team";
  return "other";
}

function kindMeta(kind: ActivityTypeFilter): {
  label: string;
  tone: string;
  title: string;
} {
  switch (kind) {
    case "booking":
      return { label: "Бронь", tone: "booking", title: "Зміна броні" };
    case "settings":
      return { label: "Налаштування", tone: "settings", title: "Налаштування" };
    case "team":
      return { label: "Команда", tone: "team", title: "Команда" };
    default:
      return { label: "Дія", tone: "other", title: "Зміна" };
  }
}

function entryChanges(entry: ActivityLogEntry): { label?: string; from?: string; to?: string }[] {
  const raw = entry.details?.changes;
  return Array.isArray(raw) ? raw : [];
}

function changeDisplay(change: { label?: string; from?: string; to?: string }): {
  label: string;
  text: string;
  hasDiff: boolean;
} {
  const label = String(change.label || "Поле");
  const from = String(change.from || "").trim();
  const to = String(change.to || "").trim();
  if (from && to && from !== "—" && from !== to) {
    return { label, text: `${from} → ${to}`, hasDiff: true };
  }
  return { label, text: to || from || "—", hasDiff: false };
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function TeamSettingsPanel({ isActive = true }: { isActive?: boolean }) {
  const [subView, setSubView] = useState<TeamSubView>("team");
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

  const [activityItems, setActivityItems] = useState<ActivityLogEntry[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityLoading, setActivityLoading] = useState(false);
  const [personFilter, setPersonFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>("all");
  const [search, setSearch] = useState("");

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

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const data = await listActivityLog();
      setActivityItems(data.items);
      setActivityTotal(data.total);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не вдалося завантажити журнал");
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void loadMembers();
  }, [isActive, loadMembers]);

  useEffect(() => {
    if (!isActive || subView !== "activity") return;
    void loadActivity();
  }, [isActive, subView, loadActivity]);

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

  const peopleOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of activityItems) {
      const key = actorKey(entry);
      if (!key) continue;
      if (!map.has(key)) map.set(key, actorLabel(entry));
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "uk"));
  }, [activityItems]);

  const filteredActivity = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activityItems.filter((entry) => {
      const kind = activityKind(entry.type || "");
      if (typeFilter !== "all" && kind !== typeFilter) return false;
      if (personFilter !== "all" && actorKey(entry) !== personFilter) return false;
      if (q) {
        const hay = `${entry.summary || ""} ${actorLabel(entry)} ${entry.type || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activityItems, typeFilter, personFilter, search]);

  const activityStats = useMemo(() => {
    const now = new Date();
    let today = 0;
    let bookings = 0;
    let settings = 0;
    let team = 0;
    for (const entry of activityItems) {
      const at = new Date(entry.at);
      if (!Number.isNaN(at.getTime()) && isSameDay(at, now)) today += 1;
      const kind = activityKind(entry.type || "");
      if (kind === "booking") bookings += 1;
      else if (kind === "settings") settings += 1;
      else if (kind === "team") team += 1;
    }
    return { today, bookings, settings, team, total: activityTotal || activityItems.length };
  }, [activityItems, activityTotal]);

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
      if (subView === "activity") void loadActivity();
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
        <div className="reports-tabs team-subtabs">
          <button
            type="button"
            className={`r-tab${subView === "team" ? " active" : ""}`}
            onClick={() => setSubView("team")}
          >
            <Users size={16} strokeWidth={1.75} aria-hidden />
            Команда
          </button>
          <button
            type="button"
            className={`r-tab${subView === "activity" ? " active" : ""}`}
            onClick={() => setSubView("activity")}
          >
            <History size={16} strokeWidth={1.75} aria-hidden />
            Журнал змін
            {activityTotal > 0 || activityItems.length > 0 ? (
              <span className="team-subtabs__count">
                {activityTotal || activityItems.length}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {subView === "team" ? (
        <>
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
              <TeamLoader variant="members" label="Завантажуємо команду" />
            ) : sorted.length === 0 ? (
              <p className="team-empty">Поки немає учасників</p>
            ) : (
              <ul className="team-members">
                {sorted.map((m) => (
                  <li
                    key={m.id}
                    className={`team-member${!m.active ? " team-member--off" : ""}`}
                  >
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
                          className={`team-tag team-tag--${
                            m.role === "owner" ? "owner" : "admin"
                          }`}
                        >
                          {roleLabelUk(m.role)}
                        </span>
                        {m.hasPendingInvite ? (
                          <span className="team-tag team-tag--pending">Очікує запрошення</span>
                        ) : null}
                        {!m.active ? (
                          <span className="team-tag team-tag--off">Вимкнено</span>
                        ) : null}
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
                        className={`team-btn ${
                          m.active ? "team-btn--danger" : "team-btn--ghost"
                        }`}
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
        </>
      ) : (
        <section className="team-card">
          <div className="team-card__header team-card__header--row">
            <div>
              <div className="team-card__title-row">
                <span className="team-card__title-icon" aria-hidden>
                  <History size={16} strokeWidth={1.75} />
                </span>
                <h3>Журнал змін</h3>
              </div>
              <p>Усі збереження в адмінці — хто і що змінив</p>
            </div>
            <button
              type="button"
              className="team-btn team-btn--ghost"
              disabled={activityLoading}
              onClick={() => void loadActivity()}
            >
              <RefreshCw size={14} className={activityLoading ? "team-spin" : undefined} />
              Оновити
            </button>
          </div>

          <div className="team-stats">
            <div className="team-stat">
              <span className="team-stat__label">Усього</span>
              <span className="team-stat__value">{activityStats.total}</span>
            </div>
            <div className="team-stat">
              <span className="team-stat__label">Сьогодні</span>
              <span className="team-stat__value">{activityStats.today}</span>
            </div>
            <div className="team-stat">
              <span className="team-stat__label">Броні</span>
              <span className="team-stat__value">{activityStats.bookings}</span>
            </div>
            <div className="team-stat">
              <span className="team-stat__label">Налаштування</span>
              <span className="team-stat__value">{activityStats.settings}</span>
            </div>
          </div>

          <div className="team-filters">
            <div className="team-search">
              <Search size={14} className="team-search__icon" aria-hidden />
              <input
                className="team-search__input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Пошук у журналі…"
              />
            </div>
            <div className="team-filters__row">
              <TeamFancySelect
                value={personFilter}
                aria-label="Фільтр по людині"
                onChange={setPersonFilter}
                options={[
                  { value: "all", label: "Усі люди" },
                  ...peopleOptions.map(([id, label]) => ({ value: id, label })),
                ]}
              />
              <TeamFancySelect
                value={typeFilter}
                aria-label="Фільтр по типу"
                onChange={(next) => setTypeFilter(next as ActivityTypeFilter)}
                options={[
                  { value: "all", label: "Усі типи" },
                  { value: "booking", label: "Броні" },
                  { value: "settings", label: "Налаштування" },
                  { value: "team", label: "Команда" },
                  { value: "other", label: "Інше" },
                ]}
              />
            </div>
          </div>

          {activityLoading && activityItems.length === 0 ? (
            <TeamLoader variant="journal" label="Завантажуємо журнал" />
          ) : filteredActivity.length === 0 ? (
            <p className="team-empty">
              {activityItems.length === 0
                ? "Поки немає записів. Вони зʼявляться після перших збережень."
                : "Нічого не знайдено за цими фільтрами."}
            </p>
          ) : (
            <ul className="team-log">
              {filteredActivity.map((entry) => {
                const kind = activityKind(entry.type || "");
                const meta = kindMeta(kind);
                const changes = entryChanges(entry);
                const context = [
                  entry.details?.orderId,
                  entry.details?.name,
                  entry.details?.cottage,
                ]
                  .map((x) => String(x || "").trim())
                  .filter(Boolean);
                return (
                  <li key={entry.id || `${entry.at}-${entry.summary}`} className="team-log__item">
                    <article className={`team-log-card team-log-card--${meta.tone}`}>
                      <header className="team-log-card__head">
                        <div className="team-log-card__badge-wrap">
                          <span className={`team-log-card__badge team-log-card__badge--${meta.tone}`}>
                            {meta.label}
                          </span>
                          {context.length ? (
                            <span className="team-log-card__ctx">{context.join(" · ")}</span>
                          ) : null}
                        </div>
                        <time className="team-log-card__time" title={formatWhen(entry.at)}>
                          {formatRelative(entry.at)}
                        </time>
                      </header>
                      <h4 className="team-log-card__title">{entry.summary || meta.title}</h4>
                      {changes.length > 0 ? (
                        <ul className="team-log-card__changes">
                          {changes.slice(0, 8).map((change, idx) => {
                            const row = changeDisplay(change);
                            return (
                              <li key={`${row.label}-${idx}`} className="team-log-card__change">
                                <span className="team-log-card__change-label">{row.label}</span>
                                <span
                                  className={`team-log-card__change-value${
                                    row.hasDiff ? " team-log-card__change-value--diff" : ""
                                  }`}
                                >
                                  {row.hasDiff ? (
                                    <>
                                      <span className="team-log-card__from">
                                        {String(change.from)}
                                      </span>
                                      <span className="team-log-card__arrow" aria-hidden>
                                        →
                                      </span>
                                      <span className="team-log-card__to">{String(change.to)}</span>
                                    </>
                                  ) : (
                                    row.text
                                  )}
                                </span>
                              </li>
                            );
                          })}
                          {changes.length > 8 ? (
                            <li className="team-log-card__more">+{changes.length - 8} ще</li>
                          ) : null}
                        </ul>
                      ) : null}
                      <footer className="team-log-card__foot">
                        <span className="team-log-card__actor">{actorLabel(entry)}</span>
                      </footer>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
