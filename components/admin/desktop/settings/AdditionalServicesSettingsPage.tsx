"use client";

import { FlexibleScheduleSettingsPanel } from "./FlexibleScheduleSettingsPanel";
import { AdditionalServicesSettings } from "./AdditionalServicesSettings";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminSettingsPayload } from "../types";
import "./settings-additional-services.css";

type Props = {
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
};

export function AdditionalServicesSettingsPage({ settings, modals }: Props) {
  return (
    <div className="svc-page">
      <p className="svc-page__intro">
        Налаштуй ранній заїзд, пізній виїзд і послуги для гостей — вони зʼявляться при бронюванні та в
        деталях броні.
      </p>

      <FlexibleScheduleSettingsPanel settings={settings} modals={modals} />
      <AdditionalServicesSettings settings={settings} modals={modals} />
    </div>
  );
}
