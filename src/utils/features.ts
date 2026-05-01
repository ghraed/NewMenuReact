export const areFeaturesEnabled = (
  featureFlags: Record<string, boolean> | null | undefined,
  requiredFeatures?: string[]
): boolean => {
  if (!requiredFeatures || requiredFeatures.length === 0) {
    return true;
  }

  if (!featureFlags) {
    return false;
  }

  return requiredFeatures.every((featureKey) => featureFlags[featureKey] === true);
};
