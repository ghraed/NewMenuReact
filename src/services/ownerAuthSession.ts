export const OWNER_SESSION_STORAGE_KEY = 'owner_auth_session';
export const OWNER_IDENTITY_STORAGE_KEY = 'owner_auth_identity';
export const readOwnerIdentity = (): number | null => {
  try {
    const value = Number(localStorage.getItem(OWNER_IDENTITY_STORAGE_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch { return null; }
};

let verifiedOwner: { userId: number; revision: string } | null = null;
export const setVerifiedOwnerIdentity = (userId: number | null, revision: string | null): void => {
  verifiedOwner = userId && revision ? { userId, revision } : null;
};
export const getVerifiedOwnerIdentity = (): number | null => verifiedOwner
  && localStorage.getItem(OWNER_SESSION_STORAGE_KEY) === verifiedOwner.revision
  && readOwnerIdentity() === verifiedOwner.userId ? verifiedOwner.userId : null;
