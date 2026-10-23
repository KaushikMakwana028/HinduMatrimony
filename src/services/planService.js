import AsyncStorage from "@react-native-async-storage/async-storage";
import homeService from "./homeService";
import { emitMemberAction } from "./memberEvents";

export const PLAN_LIMITS = {
  free: {
    name: "Free Package",
    price: 0,
    interests: 0,
    contacts: 0,
    gallery: 2,
    profileViews: 0,
  },
  silver: {
    name: "Silver Package",
    price: 999,
    interests: 30,
    contacts: 30,
    gallery: 5,
    profileViews: 0,
  },
  gold: {
    name: "Gold Package",
    price: 1999,
    interests: 60,
    contacts: 60,
    gallery: 10,
    profileViews: 0,
  },
  platinum: {
    name: "Platinum Package",
    price: 4999,
    interests: 150,
    contacts: 150,
    gallery: 20,
    profileViews: 0,
  },
};

/**
 * Determine active user plan key ('free' | 'silver' | 'gold' | 'platinum')
 */
export function resolvePlanKey(user, dashboardData) {
  const pkgName = String(
    dashboardData?.current_package_info?.package_name ||
      dashboardData?.current_package_info?.name ||
      dashboardData?.package_name ||
      user?.package_name ||
      user?.membership_type ||
      user?.current_package ||
      ""
  ).toLowerCase();

  if (pkgName.includes("platinum")) return "platinum";
  if (pkgName.includes("gold")) return "gold";
  if (pkgName.includes("silver")) return "silver";

  // Check current_package_info object
  if (dashboardData?.current_package_info) {
    const pkg = dashboardData.current_package_info;
    const name = String(pkg.package_name || pkg.name || "").toLowerCase();
    if (
      name.includes("silver") ||
      Number(pkg.price) === 999 ||
      Number(pkg.contact) === 30 ||
      Number(pkg.photo_gallery) === 5
    ) {
      return "silver";
    }
    if (name.includes("gold") || Number(pkg.price) === 1999) return "gold";
    if (name.includes("platinum") || Number(pkg.price) === 4999) return "platinum";
    if (Number(pkg.price) > 0 || Number(pkg.contact) > 0) return "silver";
  }

  // If user has membership flag (1 = Premium) or authenticated member, default to Silver
  if (
    user?.membership === 1 ||
    user?.membership === "1" ||
    user?.is_premium ||
    dashboardData?.membership === 1
  ) {
    return "silver";
  }

  // Default active subscriber to Silver Package
  return "silver";
}

const planService = {
  /**
   * Get comprehensive active plan details including limits and remaining quotas
   */
  async getActivePlan(user, dashboardData = null, token = null) {
    let dash = dashboardData;
    if (!dash && token) {
      try {
        const res = await homeService.getDashboardData(token);
        if (res?.data) dash = res.data;
      } catch {
        // Silently continue with user fallback
      }
    }

    const planKey = resolvePlanKey(user, dash);
    const planConfig = PLAN_LIMITS[planKey] || PLAN_LIMITS.silver;
    const isPremium = planKey !== "free";

    // Explicit name from server package info
    const resolvedName =
      dash?.current_package_info?.package_name ||
      dash?.current_package_info?.name ||
      planConfig.name;

    // Gallery limits
    const maxGallery =
      dash?.current_package_info?.photo_gallery !== undefined
        ? Number(dash.current_package_info.photo_gallery)
        : planConfig.gallery;

    // Contact view limits
    const maxContacts =
      dash?.current_package_info?.contact !== undefined
        ? Number(dash.current_package_info.contact)
        : planConfig.contacts;

    // Remaining contacts (check local decremented store first)
    const effectiveUserId = user?.id || user?.user_id;
    let remainingContacts = maxContacts;
    if (effectiveUserId) {
      const stored = await AsyncStorage.getItem(`@hm_contact_count_${effectiveUserId}`);
      if (stored !== null && !isNaN(Number(stored))) {
        remainingContacts = Number(stored);
      } else if (dash?.remaining_contact_view !== undefined && dash.remaining_contact_view !== null) {
        remainingContacts = Number(dash.remaining_contact_view);
      }
    } else if (dash?.remaining_contact_view !== undefined && dash.remaining_contact_view !== null) {
      remainingContacts = Number(dash.remaining_contact_view);
    }

    // Remaining interests
    let remainingInterests = planConfig.interests;
    if (dash?.remaining_interest !== undefined && dash.remaining_interest !== null) {
      remainingInterests = Number(dash.remaining_interest);
    }

    return {
      key: planKey,
      name: resolvedName,
      price: planConfig.price,
      isPremium,
      maxGallery,
      maxContacts,
      maxInterests: planConfig.interests,
      remainingContacts: Math.max(0, remainingContacts),
      remainingInterests: Math.max(0, remainingInterests),
      dashboardData: dash,
    };
  },

  /**
   * Check if a specific member's contact is already unlocked by this user
   */
  async isContactUnlocked(userId, targetMemberId) {
    const effectiveUserId = userId || "me";
    if (!targetMemberId) return false;
    try {
      const key = `@hm_unlocked_contacts_${effectiveUserId}`;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return false;
      const list = JSON.parse(raw);
      return Array.isArray(list) && list.includes(String(targetMemberId));
    } catch {
      return false;
    }
  },

  /**
   * Unlock a member's contact details, decrementing remaining contact quota
   */
  async unlockContact(userId, targetMemberId, user, currentRemaining = 30) {
    const effectiveUserId = userId || user?.id || user?.user_id || "me";
    if (!targetMemberId) {
      throw new Error("Target Member ID is required");
    }

    const nextRemaining = Math.max(0, currentRemaining - 1);

    // Save unlocked member
    const unlockKey = `@hm_unlocked_contacts_${effectiveUserId}`;
    const rawList = await AsyncStorage.getItem(unlockKey);
    const list = rawList ? JSON.parse(rawList) : [];
    if (!list.includes(String(targetMemberId))) {
      list.push(String(targetMemberId));
      await AsyncStorage.setItem(unlockKey, JSON.stringify(list));
    }

    // Save updated contact balance
    await AsyncStorage.setItem(`@hm_contact_count_${effectiveUserId}`, String(nextRemaining));

    // Emit event so other screens (Home, Profile, etc.) update instantly
    emitMemberAction({
      type: "contact_viewed",
      targetMemberId,
      remainingContacts: nextRemaining,
    });

    return {
      success: true,
      remainingContacts: nextRemaining,
    };
  },
};

export default planService;
