import type { AdminSettingsPayload } from "@/components/admin/desktop/types";

export type OnboardingStepId = "basics" | "first_room" | "amenities" | "prices";

export type OnboardingStepStatus = "complete" | "pending";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  actionLabel: string;
  status: OnboardingStepStatus;
};

export type OnboardingProgressInput = {
  settings: AdminSettingsPayload;
  tenantName?: string | null;
};

export type OnboardingProgressResult = {
  percent: number;
  completedCount: number;
  totalSteps: number;
  steps: OnboardingStep[];
  isComplete: boolean;
};
