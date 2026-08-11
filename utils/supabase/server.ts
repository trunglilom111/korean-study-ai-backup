import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient(request?: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL trong .env.local");
  }

  if (!supabasePublishableKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY trong .env.local"
    );
  }

  const cookieStore = await cookies();

  const authorization = request?.headers.get("authorization");

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
    ...(authorization
      ? {
          global: {
            headers: {
              Authorization: authorization,
            },
          },
        }
      : {}),
  });
}
