import { z } from "zod";

export const serviceFields = [
  ["businessName", "Business name", 200],
  ["contactEmail", "Customer service email", 200],
  ["businessAddress", "Business contact address", 1000],
  ["registration", "Business registration details", 500],
  ["delivery", "Delivery destinations, rates and times", 5000],
  ["returns", "Returns address, costs and procedure", 5000],
  ["privacy", "Privacy notice — draft", 12000],
  ["terms", "Terms and conditions — draft", 12000],
] as const;
export const servicesSchema = z.object({
  businessName: z.string().trim().max(200).optional(),
  contactEmail: z.union([z.literal(""), z.email().max(200)]).optional(),
  businessAddress: z.string().trim().max(1000).optional(),
  registration: z.string().trim().max(500).optional(),
  delivery: z.string().trim().max(5000).optional(),
  returns: z.string().trim().max(5000).optional(),
  privacy: z.string().trim().max(12000).optional(),
  terms: z.string().trim().max(12000).optional(),
});
export const homeSchema = z.object({
  headline: z.string().trim().min(2).max(150),
  subtitle: z.string().max(500),
  services: servicesSchema.optional(),
});
export type HomeContent = z.infer<typeof homeSchema>;
