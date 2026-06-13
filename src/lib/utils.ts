import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function normalizePhone(
  phone: string | null | undefined,
): string | null {
  if (!phone) return null;
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");
  // If it starts with a country code, return as is
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return cleaned;
  }
  // If it's exactly 10 digits, assume it's an Indian number and add 91
  if (cleaned.length === 10) {
    return "91" + cleaned;
  }
  return null;
}

export function generateTimes(
  start: string,
  end: string,
  slotDurationMinutes: number = 6, // Default to 6 minutes for 10 slots per hour
): string[] {
  const times: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  for (let m = startMin; m < endMin; m += slotDurationMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    times.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return times;
}
