import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import { isTurboSmsConfigured } from "@/lib/sms/config";
import { sendTurboSms } from "@/lib/sms/turbosms";
import {
  type SmsTemplateId,
  normalizeSmsSettings,
  renderSmsTemplate,
  SMS_TEMPLATE_META,
} from "@/lib/sms/smsSettings";
import { makeSmsJournalEntry } from "@/lib/sms/smsJournal";
import { persistSmsJournalEntryAdmin } from "@/lib/sms/persistSmsJournal";
import { extractBearerToken } from "@/lib/admin/adminDbClient";
import { normalizeGuestPhone } from "@/lib/admin/guestMessengerLinks";

export const runtime = "nodejs";

type SendSmsBody = {
  phone?: string;
  /** Ready-to-send text (preferred for manual sends) */
  text?: string;
  templateId?: SmsTemplateId;
  vars?: Record<string, string>;
  smsSettings?: unknown;
};

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  let body: SendSmsBody;
  try {
    body = (await request.json()) as SendSmsBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const settings = normalizeSmsSettings(body.smsSettings);
  const rawPhone = body.phone || settings.testPhone || "";
  const phone = normalizeGuestPhone(rawPhone);
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: "missing_or_invalid_phone" },
      { status: 400 },
    );
  }

  let text: string;
  if (body.text?.trim()) {
    text = body.text.trim();
  } else if (body.templateId && SMS_TEMPLATE_META[body.templateId]) {
    const tpl = settings.templates[body.templateId];
    text = renderSmsTemplate(tpl.text, body.vars || {});
  } else {
    return NextResponse.json(
      { ok: false, error: "missing_text_or_templateId" },
      { status: 400 },
    );
  }

  if (!text) {
    return NextResponse.json({ ok: false, error: "empty_text" }, { status: 400 });
  }

  if (!isTurboSmsConfigured()) {
    return NextResponse.json(
      { ok: false, error: "TURBOSMS_TOKEN not configured" },
      { status: 503 },
    );
  }

  const journalType = body.templateId || "test";
  const result = await sendTurboSms({
    phone,
    text,
    sequenceId: body.templateId ? `manual-${body.templateId}-${Date.now()}` : "test",
  });

  const entry = makeSmsJournalEntry({
    type: journalType,
    phone,
    text,
    ok: result.ok,
    messageId: result.messageId,
    error: result.error || result.responseStatus,
    pricePerSegment: settings.pricePerSegment,
  });

  const persisted = await persistSmsJournalEntryAdmin(entry, {
    authToken: extractBearerToken(request),
    tenantId,
  });

  if (!persisted.ok) {
    console.error("[SMS send] journal persist failed", persisted.error);
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error || result.responseStatus,
        journal: entry,
        journalPersisted: persisted.ok,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    messageId: result.messageId,
    responseStatus: result.responseStatus,
    journal: entry,
    journalPersisted: persisted.ok,
    journalAll: persisted.journal,
  });
}
