"use client";

import { getCategoryIconPath } from "../desktop/reports/financeCategoryIcons";
import type { useReportsAnalytics } from "../desktop/reports/useReportsAnalytics";

type ReportsApi = ReturnType<typeof useReportsAnalytics>;

function CategoryIcon({ title, color, bg }: { title: string; color: string; bg: string }) {
  const path = getCategoryIconPath(title);
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: bg,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <g dangerouslySetInnerHTML={{ __html: path }} />
      </svg>
    </div>
  );
}

export interface FinanceMobileTableProps {
  r: ReportsApi;
}

export function FinanceMobileTable({ r }: FinanceMobileTableProps) {
  const rows = r.analytics?.financeRows ?? [];

  if (rows.length === 0) {
    return (
      <div className="finance-mob-table" id="financeTableBody">
        <p style={{ textAlign: "center", color: "#9CA3AF", padding: 32, fontSize: 14 }}>
          Немає фінансових операцій за цей період
        </p>
      </div>
    );
  }

  return (
    <div className="finance-mob-table" id="financeTableBody">
      {rows.flatMap((row) => {
        const isInc = row.type === "income";
        const color = isInc ? "#059669" : "#DC2626";
        const iconBg = isInc ? "#ECFDF5" : "#FEF2F2";
        const sign = isInc ? "+" : "-";
        const isEditing = row.id != null && r.editingTxId === row.id;
        const badge = isInc ? (
          <span className="badge confirmed" style={{ background: "#D1FAE5", color: "#059669", fontSize: 11 }}>
            Дохід
          </span>
        ) : (
          <span className="badge cancelled" style={{ background: "#FEE2E2", color: "#DC2626", fontSize: 11 }}>
            Витрата
          </span>
        );

        const nodes = [
          <div
            key={row.key}
            className="fin-mob-row"
            id={row.id != null ? `mainRow-${row.id}` : undefined}
            onClick={
              row.id != null && !row.isSystem ? () => r.toggleEditFinRow(row.id!) : undefined
            }
            role={row.id != null && !row.isSystem ? "button" : undefined}
            tabIndex={row.id != null && !row.isSystem ? 0 : undefined}
          >
            <div className="fin-mob-row-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <CategoryIcon title={row.title} color={color} bg={iconBg} />
                <div>
                  <div className="fin-mob-title">{row.title}</div>
                  <div className="fin-mob-desc">{row.desc}</div>
                </div>
              </div>
              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <div className="fin-mob-amt" style={{ color }}>
                  {sign}
                  {Math.round(row.amount).toLocaleString("uk-UA")} ₴
                </div>
                {badge}
              </div>
            </div>
            {!row.isSystem && row.id != null ? (
              <div className="fin-mob-actions">
                <button type="button" className="btn-icon-only tap-btn" onClick={() => r.toggleEditFinRow(row.id!)}>
                  ✎
                </button>
                <button
                  type="button"
                  className="btn-icon-only danger tap-btn"
                  onClick={() => r.deleteTransaction(row.id!)}
                >
                  🗑
                </button>
              </div>
            ) : row.isSystem ? (
              <div className="fin-mob-actions">
                <span style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 700 }}>Auto</span>
              </div>
            ) : null}
          </div>,
        ];

        if (isEditing && row.id != null && r.editDraft) {
          nodes.push(
            <div
              key={`edit-${row.id}`}
              id={`editRow-${row.id}`}
              style={{
                background: "#FAFAFA",
                border: "1px solid #E5E7EB",
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderLeft: `4px solid ${color}`,
              }}
            >
              <div className="form-grid" style={{ gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Сума (грн)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    id={`editAmt-${row.id}`}
                    value={r.editDraft.amount}
                    min={1}
                    onChange={(e) => r.setEditDraft({ ...r.editDraft!, amount: e.target.value })}
                    style={{ fontWeight: 800, fontSize: 18, color, background: "#FFF", width: "100%" }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Дата</label>
                  <input
                    type="text"
                    id={`editDate-${row.id}`}
                    className="it-date-picker"
                    value={r.editDraft.date}
                    onChange={(e) => r.setEditDraft({ ...r.editDraft!, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Коментар (необов&apos;язково)</label>
                <input
                  type="text"
                  id={`editComm-${row.id}`}
                  value={r.editDraft.comment}
                  onChange={(e) => r.setEditDraft({ ...r.editDraft!, comment: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary tap-btn" onClick={() => r.toggleEditFinRow(row.id!)}>
                  Скасувати
                </button>
                <button
                  type="button"
                  className="btn-primary tap-btn"
                  style={{ background: color, borderColor: color }}
                  onClick={() => void r.saveInlineEdit(row.id!)}
                >
                  Зберегти
                </button>
              </div>
            </div>
          );
        }

        return nodes;
      })}
    </div>
  );
}
