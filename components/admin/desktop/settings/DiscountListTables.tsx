"use client";

import { Fragment } from "react";
import { dedupeDiscountsList } from "@/lib/admin/discountDraft";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminSettingsPayload, DiscountConfig, DiscountKind } from "../types";
import { matchesDiscountSection } from "./discountConfig";
import { DiscountTableRows } from "./DesktopSettingsTables";
import type { DiscountTemplateDef } from "./DiscountTemplateGallery";

export function DiscountTableColGroup() {
  return (
    <colgroup>
      <col className="settings-discounts-col-name" />
      <col className="settings-discounts-col-type" />
      <col className="settings-discounts-col-status" />
      <col className="settings-discounts-col-actions" />
    </colgroup>
  );
}

export function DiscountTableHead() {
  return (
    <thead>
      <tr>
        <th>Назва</th>
        <th>Тип</th>
        <th>Статус</th>
        <th>Дія</th>
      </tr>
    </thead>
  );
}

export function DiscountAllGroupedTable({
  activeSections,
  settings,
  modals,
}: {
  activeSections: { template: DiscountTemplateDef; discounts: DiscountConfig[] }[];
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
}) {
  return (
    <table className="settings-discounts-table settings-discounts-table--fixed-cols settings-discounts-table--grouped">
      <DiscountTableColGroup />
      <tbody>
        {activeSections.map(({ template, discounts }, sectionIndex) => {
          const { kind, Icon, iconContainerClass, iconClass, title } = template;
          return (
            <Fragment key={kind}>
              {sectionIndex > 0 ? (
                <tr className="discount-kind-section-spacer" aria-hidden>
                  <td colSpan={4} />
                </tr>
              ) : null}
              <tr className="discount-kind-section-heading" id={`discount-section-${kind}`}>
                <td colSpan={4}>
                  <div className="discount-kind-section__header discount-kind-section__header--in-table">
                    <div className={`discount-kind-section__icon ${iconContainerClass}`}>
                      <Icon className={iconClass} size={18} strokeWidth={1.5} />
                    </div>
                    <h3 className="discount-kind-section__title">{title}</h3>
                    <span className="discount-kind-section__count">{discounts.length}</span>
                  </div>
                </td>
              </tr>
              <DiscountTableRows
                discounts={discounts}
                settings={settings}
                modals={modals}
                includeLeadingSpacer={false}
              />
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

export function DiscountFilteredTable({
  sectionKind,
  settings,
  modals,
}: {
  sectionKind: DiscountKind;
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
}) {
  const discounts = dedupeDiscountsList(settings.discountsList || []).filter((d) =>
    matchesDiscountSection(d, sectionKind)
  );

  if (discounts.length === 0) return null;

  return (
    <table className="settings-discounts-table settings-discounts-table--fixed-cols">
      <DiscountTableColGroup />
      <DiscountTableHead />
      <tbody>
        <DiscountTableRows discounts={discounts} settings={settings} modals={modals} includeLeadingSpacer />
      </tbody>
    </table>
  );
}
