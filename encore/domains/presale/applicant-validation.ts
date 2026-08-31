// Author: Klaasvaakie ( |╲ )
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

export function normalizeInternationalCellphone(value: string): string | null {
  const parsed = parsePhoneNumberFromString(value.trim());
  return parsed?.isValid() ? parsed.number : null;
}

export function physicalAddressLine(value: { streetAddress: string; suburb: string; city: string; postalCode: string }): string {
  return [value.streetAddress, value.suburb, value.city, value.postalCode].map((part) => part.trim()).join(", ");
}

export const strongPasswordSchema = z.string().min(12).max(128)
  .regex(/\d/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

// Authentication verifies an existing credential. Account-creation strength
// policy belongs to registration and password reset, not the login boundary.
export const applicantLoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export const internationalCellphoneSchema = z.string().trim().min(8).max(40)
  .refine((value) => normalizeInternationalCellphone(value) !== null, "Enter a valid cellphone number including its country code")
  .transform((value) => normalizeInternationalCellphone(value)!);
