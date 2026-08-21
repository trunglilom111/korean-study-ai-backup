export const TOPIK_MASTER_OWNER_EMAIL = "trunglilom11@gmail.com";

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || "";
}

export function isTopikMasterOwner(email?: string | null) {
  return normalizeEmail(email) === TOPIK_MASTER_OWNER_EMAIL;
}
