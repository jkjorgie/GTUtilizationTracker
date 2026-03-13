import { z } from "zod";

export const PASSWORD_REQUIREMENTS =
  "At least 16 characters, including uppercase, lowercase, number, and special character.";

export const passwordSchema = z
  .string()
  .min(16, "Password must be at least 16 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");
