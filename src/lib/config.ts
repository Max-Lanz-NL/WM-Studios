export function configuration() {
  const environment = process.env.APP_ENV;
  if (environment !== "local" && environment !== "staging")
    throw new Error(
      "Configure APP_ENV=local or staging. Live sales are not enabled.",
    );
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Configure the Supabase test connection in .env.local.");
  const parsed = new URL(url);
  if (
    environment === "local" &&
    !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
  )
    throw new Error("Local configuration requires a local Supabase URL.");
  if (
    environment === "staging" &&
    (parsed.protocol !== "https:" ||
      parsed.hostname !==
        `${process.env.SUPABASE_STAGING_PROJECT_REF}.supabase.co`)
  )
    throw new Error(
      "The staging URL does not match the configured project reference.",
    );
  return { environment, url, key };
}
export function configured() {
  try {
    configuration();
    return true;
  } catch {
    return false;
  }
}
