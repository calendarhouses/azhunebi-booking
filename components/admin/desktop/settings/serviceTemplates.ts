import type { ServiceFormState } from "./additionalServicesLogic";

export type ServiceTemplate = {
  id: string;
  label: string;
  form: Partial<ServiceFormState>;
};

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: "horses",
    label: "Кінь",
    form: {
      name: "Прогулянка на коні",
      price: "600",
      perHour: true,
      perDay: false,
      perGuest: false,
      perBooking: false,
      onSite: false,
      description: "Вартість за одну годину. Оберіть кількість годин",
      inputType: "counter",
      maxQuantity: 8,
      active: true,
    },
  },
  {
    id: "bike",
    label: "Велосипед",
    form: {
      name: "Прокат велосипеда",
      price: "300",
      perDay: false,
      perGuest: false,
      onSite: false,
      description: "На добу або частину дня",
      inputType: "counter",
      maxQuantity: 5,
      active: true,
    },
  },
  {
    id: "chan",
    label: "Чан",
    form: {
      name: "Чан",
      price: "0",
      perDay: false,
      perGuest: false,
      onSite: true,
      description: "Оплата на місці після прогріву",
      inputType: "toggle",
      active: true,
    },
  },
  {
    id: "sauna",
    label: "Лазня",
    form: {
      name: "Лазня",
      price: "0",
      perDay: false,
      perGuest: false,
      onSite: true,
      requiresApproval: true,
      description: "За попереднім записом",
      inputType: "toggle",
      active: true,
    },
  },
  {
    id: "transfer",
    label: "Трансфер",
    form: {
      name: "Трансфер з вокзалу м. Вижниця",
      price: "500",
      perDay: false,
      perGuest: false,
      requiresApproval: true,
      description: "Вкажіть час прибуття поїзда в коментарі",
      inputType: "toggle",
      active: true,
    },
  },
];
