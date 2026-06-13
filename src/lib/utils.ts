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
