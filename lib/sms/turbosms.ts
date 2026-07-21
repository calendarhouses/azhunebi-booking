import { getTurboSmsConfig, isTurboSmsConfigured } from "./config";

const API_BASE = "https://api.turbosms.ua";

export type TurboSmsMessageDetail = {
  message_id: string;
  phone?: string;
  status?: string;
  status_time?: string;
  cost?: number;
  parts?: number;
};

export async function fetchTurboSmsMessageDetails(messageIds: string[]): Promise<{
  ok: boolean;
  details?: TurboSmsMessageDetail[];
  error?: string;
}> {
  if (!messageIds.length) return { ok: true, details: [] };
  if (!isTurboSmsConfigured()) {
    return { ok: false, error: "TURBOSMS_TOKEN not configured" };
  }

  const { token } = getTurboSmsConfig();
  const res = await fetch(`${API_BASE}/message/details.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages: messageIds }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => null)) as {
    response_code?: number;
    response_result?: TurboSmsMessageDetail[] | null;
  } | null;

  if (!data || data.response_code !== 0) {
    return {
      ok: false,
      error: data?.response_code
        ? `details error ${data.response_code}`
        : "invalid response",
    };
  }

  return { ok: true, details: data.response_result ?? [] };
}

export type TurboSmsSendResult = {
  ok: boolean;
  messageId?: string | null;
  responseCode?: number;
  responseStatus?: string;
  error?: string;
};

type TurboSmsApiResponse = {
  response_code?: number;
  response_status?: string;
  response_result?: Array<{
    phone?: string;
    message_id?: string | null;
    response_code?: number;
    response_status?: string;
  }> | null;
};

export async function fetchTurboSmsBalance(): Promise<{
  ok: boolean;
  balance?: number;
  error?: string;
}> {
  if (!isTurboSmsConfigured()) {
    return { ok: false, error: "TURBOSMS_TOKEN not configured" };
  }

  const { token } = getTurboSmsConfig();
  const res = await fetch(`${API_BASE}/user/balance.json`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = (await res.json().catch(() => null)) as {
    response_code?: number;
    response_result?: { balance?: number };
  } | null;

  if (!data || data.response_code !== 0) {
    return {
      ok: false,
      error: data?.response_code ? `balance error ${data.response_code}` : "invalid response",
    };
  }

  return { ok: true, balance: Number(data.response_result?.balance) || 0 };
}

export async function sendTurboSms(params: {
  phone: string;
  text: string;
  sequenceId?: string;
}): Promise<TurboSmsSendResult> {
  if (!isTurboSmsConfigured()) {
    return { ok: false, error: "TURBOSMS_TOKEN not configured" };
  }

  const digits = params.phone.replace(/\D/g, "");
  if (!digits) {
    return { ok: false, error: "invalid phone" };
  }

  const { token, sender } = getTurboSmsConfig();
  const body: Record<string, unknown> = {
    recipients: [digits],
    sms: {
      sender,
      text: params.text,
    },
  };
  if (params.sequenceId) {
    body.sequence_id = params.sequenceId;
  }

  const res = await fetch(`${API_BASE}/message/send.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => null)) as TurboSmsApiResponse | null;
  if (!data) {
    return { ok: false, error: "invalid API response" };
  }

  const recipient = Array.isArray(data.response_result) ? data.response_result[0] : null;
  const recipientCode = recipient?.response_code;
  const recipientStatus = recipient?.response_status;

  if (recipientCode === 0 && recipient?.message_id) {
    return {
      ok: true,
      messageId: recipient.message_id,
      responseCode: recipientCode,
      responseStatus: recipientStatus,
    };
  }

  const globalOk = data.response_code === 0 || data.response_code === 801 || data.response_code === 802;
  if (globalOk && recipient?.message_id) {
    return {
      ok: true,
      messageId: recipient.message_id,
      responseCode: recipientCode ?? data.response_code,
      responseStatus: recipientStatus ?? data.response_status,
    };
  }

  return {
    ok: false,
    responseCode: recipientCode ?? data.response_code,
    responseStatus: recipientStatus ?? data.response_status,
    error: recipientStatus || data.response_status || "send failed",
  };
}
