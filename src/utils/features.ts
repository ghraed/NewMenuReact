const FULL_ACCESS_EMAILS = new Set([
  'admin@alpha.com',
]);

const FULL_ACCESS_FEATURE_KEYS = [
  'inventory',
  'room_plan_editor',
  'table_reservations',
  'event_reservations',
  'finance_dashboard',
  'dish_profitability',
  'expense_management',
  'payroll_management',
  'staff_scheduling',
  'realtime_staff_orders',
  'table_ordering',
  'invoice_splitting',
  'ai_chatbot',
  'ai_recommendations',
  'multi_language',
] as const;

export const hasFullFeatureAccess = (email?: string | null): boolean => {
  if (!email) {
    return false;
  }

  return FULL_ACCESS_EMAILS.has(email.trim().toLowerCase());
};

export const withFullFeatureAccess = <T extends { email: string | null; restaurant: { feature_flags?: Record<string, boolean> } | null }>(
  user: T
): T => {
  if (!hasFullFeatureAccess(user.email) || !user.restaurant) {
    return user;
  }

  const nextFeatureFlags = { ...(user.restaurant.feature_flags ?? {}) } as Record<string, boolean>;
  FULL_ACCESS_FEATURE_KEYS.forEach((featureKey) => {
    nextFeatureFlags[featureKey] = true;
  });

  return {
    ...user,
    restaurant: {
      ...user.restaurant,
      feature_flags: nextFeatureFlags,
    },
  };
};

export const areFeaturesEnabled = (
  featureFlags: Record<string, boolean> | null | undefined,
  requiredFeatures?: string[],
  userEmail?: string | null
): boolean => {
  if (!requiredFeatures || requiredFeatures.length === 0) {
    return true;
  }

  if (hasFullFeatureAccess(userEmail)) {
    return true;
  }

  if (!featureFlags) {
    return false;
  }

  return requiredFeatures.every((featureKey) => featureFlags[featureKey] === true);
};
