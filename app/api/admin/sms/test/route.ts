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
import { makeSmsJournalEntry, recordSmsJournalEntry } from "@/lib/sms/smsJournal";
import { normalizeGuestPhone } from "@/lib/admin/guestMessengerLinks";

export const runtime = "nodejs";

type TestSmsBody = {
  phone?: string;
  text?: string;
  templateId?: SmsTemplateId;
  smsSettings?: unknown;
};

const LIFECYCLE_SECRET = () =>
  process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
  process.env.TELEGRAM_BOT_TOKEN?.trim() ||
  "";

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  let body: TestSmsBody;
  try {
    body = (await request.json()) as TestSmsBody;
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
  if (body.text) {
    text = body.text.trim();
  } else if (body.templateId && SMS_TEMPLATE_META[body.templateId]) {
    const tpl = settings.templates[body.templateId];
    // Render with placeholder values for preview
    const placeholderVars: Record<string, string> = {};
    for (const { key } of SMS_TEMPLATE_META[body.templateId].variables) {
      placeholderVars[key] = `[${key}]`;
    }
    text = renderSmsTemplate(tpl.text, placeholderVars);
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

  const result = await sendTurboSms({ phone, text, sequenceId: "test" });

  const entry = makeSmsJournalEntry({
    type: "test",
    phone,
    text,
    ok: result.ok,
    messageId: result.messageId,
    error: result.error || result.responseStatus,
    pricePerSegment: settings.pricePerSegment,
  });

  // Fire-and-forget journal persistence
  const secret = LIFECYCLE_SECRET();
  if (secret) {
    void recordSmsJournalEntry(entry, secret);
  }

  return NextResponse.json({
    ok: result.ok,
    messageId: result.messageId,
    responseStatus: result.responseStatus,
    error: result.error,
    journal: entry,
  });
}
