export function configuration() {
  const environment = process.env.APP_ENV;
  if (environment !== "local" && environment !== "staging")
    throw new Error(
      "Configureer APP_ENV=local of staging. Productie is niet ingeschakeld.",
    );
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Configureer de Supabase test-/stagingverbinding via .env.local.",
    );
  const parsed = new URL(url);
  if (
    environment === "local" &&
    !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
  )
    throw new Error("Lokale configuratie vereist een lokale Supabase-URL.");
  if (
    environment === "staging" &&
    (parsed.protocol !== "https:" ||
      parsed.hostname !==
        `${process.env.SUPABASE_STAGING_PROJECT_REF}.supabase.co`)
  )
    throw new Error("Staging-URL wijkt af van de expliciete projectref.");
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
