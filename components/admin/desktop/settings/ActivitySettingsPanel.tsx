"use client";

import { useCallback, useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { listActivityLog, type ActivityLogEntry } from "@/lib/gas-api";
import { roleLabelUk } from "@/lib/admin/permissions";
import { showToast } from "../adminGlobals";
import "./settings-additional-services.css";

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

function actorLabel(entry: ActivityLogEntry): string {
  const a = entry.actor;
  if (!a) return "Невідомо";
  const name = String(a.name || "").trim();
  const email = String(a.email || "").trim();
  const who = name || email || "Користувач";
  const role = a.role ? roleLabelUk(a.role) : "";
  return role ? `${who} · ${role}` : who;
}

function typeTone(type: string): { bg: string; fg: string; label: string } {
  if (type.startsWith("booking.create"))
    return { bg: "#E8F5E9", fg: "#1B5E20", label: "Нова бронь" };
  if (type.startsWith("booking.update"))
    return { bg: "#E3F2FD", fg: "#0D47A1", label: "Оновлення" };
  if (type.startsWith("booking.delete"))
    return { bg: "#FFEBEE", fg: "#B71C1C", label: "Видалення" };
  if (type.startsWith("settings"))
    return { bg: "#FFF3E0", fg: "#E65100", label: "Налаштування" };
  if (type.startsWith("team"))
    return { bg: "#F3E5F5", fg: "#6A1B9A", label: "Команда" };
  return { bg: "#F3F4F6", fg: "#374151", label: "Дія" };
}

export function ActivitySettingsPanel({ isActive = true }: { isActive?: boolean }) {
  const [items, setItems] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listActivityLog();
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не вдалося завантажити журнал");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void load();
  }, [isActive, load]);

  return (
    <section className="svc-accordion is-open" style={{ border: "none", boxShadow: "none" }}>
      <div className="svc-accordion__panel" style={{ paddingTop: 8 }}>
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
            marginBottom: 22,
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
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
              <History size={20} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#14241E" }}>
                Журнал змін
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: 14, color: "#5B6B64", lineHeight: 1.45 }}>
                Усі збереження в адмінці: броні, налаштування, команда.
                {total > 0 ? ` Записів: ${total}.` : null}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-outline"
            disabled={loading}
            onClick={() => void load()}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          >
            <RefreshCw size={14} />
            Оновити
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#78716c", fontSize: 14 }}>Завантаження…</p>
        ) : items.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: "28px 20px",
              textAlign: "center",
              color: "#6B7280",
              fontSize: 14,
              background: "#F7F9F8",
              borderRadius: 16,
              border: "1px dashed #D7E3DC",
            }}
          >
            Поки немає записів. Вони зʼявляться після перших збережень команди.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {items.map((entry) => {
              const tone = typeTone(entry.type || "");
              return (
                <li
                  key={entry.id || `${entry.at}-${entry.summary}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: 12,
                    alignItems: "start",
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: "#F7F9F8",
                    border: "1px solid #E4E9E6",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      padding: "4px 8px",
                      borderRadius: 8,
                      background: tone.bg,
                      color: tone.fg,
                      whiteSpace: "nowrap",
                      marginTop: 2,
                    }}
                  >
                    {tone.label}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "#14241E", fontSize: 14, lineHeight: 1.4 }}>
                      {entry.summary || "Зміна"}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: "#6B7280",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px 12px",
                      }}
                    >
                      <span>{actorLabel(entry)}</span>
                      <span>{formatWhen(entry.at)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
