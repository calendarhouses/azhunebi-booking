export type MonoChastOrderState =
  | "IN_PROCESS"
  | "SUCCESS"
  | "FAIL"
  | string;

export type MonoChastOrderSubState =
  | "WAITING_FOR_CLIENT"
  | "WAITING_FOR_STORE_CONFIRM"
  | "ACTIVE"
  | "DONE"
  | "RETURNED"
  | "CLIENT_NOT_FOUND"
  | "EXCEEDED_SUM_LIMIT"
  | "EXISTS_OTHER_OPEN_ORDER"
  | "NOT_ENOUGH_MONEY_FOR_INIT_DEBIT"
  | "REJECTED_BY_CLIENT"
  | "PAY_PARTS_ARE_NOT_ACCEPTABLE"
  | "FRAUD_REJECTED"
  | "RESTRICTED_BY_RISKS"
  | "CLIENT_PUSH_TIMEOUT"
  | "REJECTED_BY_STORE"
  | "FAIL"
  | string;

export type MonoChastCreateOrderResponse = {
  order_id?: string;
  orderId?: string;
};

export type MonoChastOrderStateResponse = {
  order_id?: string;
  state?: MonoChastOrderState;
  order_sub_state?: MonoChastOrderSubState;
  message?: string;
};

export type MonoChastCallbackPayload = {
  order_id?: string;
  state?: MonoChastOrderState;
  order_sub_state?: MonoChastOrderSubState;
};
