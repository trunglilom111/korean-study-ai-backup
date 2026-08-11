import { createClient } from "@/utils/supabase/server";

export async function getAuthenticatedUser(request?: Request) {
  const supabase = await createClient(request);
  const authorization = request?.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const {
    data: { user },
    error,
  } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}
