/**
 * TurboSMS segment calculation.
 * Thresholds from TurboSMS documentation.
 */

// GSM-7 basic character set (128 chars)
const GSM7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);

// TurboSMS cumulative char limits per segment count
const UNICODE_THRESHOLDS = [70, 133, 199, 265, 331, 397, 463, 529, 595, 661] as const;
const GSM_THRESHOLDS = [160, 305, 457, 609, 761, 913, 1065, 1217, 1369, 1521] as const;

export function smsRequiresUnicode(text: string): boolean {
  for (const char of text) {
    if (!GSM7_BASIC.has(char)) return true;
  }
  return false;
}

export type SmsSegmentInfo = {
  chars: number;
  encoding: "gsm" | "unicode";
  segments: number;
  maxForSegments: number;
  remainingInSegment: number;
};

export function countSmsSegments(text: string): SmsSegmentInfo {
  // Use spread to count Unicode code points correctly
  const chars = [...text].length;
  const encoding = smsRequiresUnicode(text) ? "unicode" : "gsm";
  const thresholds: readonly number[] =
    encoding === "unicode" ? UNICODE_THRESHOLDS : GSM_THRESHOLDS;

  let segments = thresholds.length;
  let maxForSegments = thresholds[thresholds.length - 1];

  for (let i = 0; i < thresholds.length; i++) {
    if (chars <= thresholds[i]) {
      segments = i + 1;
      maxForSegments = thresholds[i];
      break;
    }
  }

  const remainingInSegment = maxForSegments - chars;

  return { chars, encoding, segments, maxForSegments, remainingInSegment };
}

export function estimateSmsCost(segments: number, pricePerSegment: number): number {
  return Math.round(segments * pricePerSegment * 100) / 100;
}
