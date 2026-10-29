import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { HomeScreenSkeleton } from "../components/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import homeService from "../services/homeService";
import planService from "../services/planService";
import { subscribeMemberAction } from "../services/memberEvents";
import { COLORS, FONTS, DEFAULT_AVATAR } from "../theme";

const PREMIUM_COLOR = "#6D28D9";

// Returns the first usable value; treats undefined, null and "" as missing
const pick = (...vals) =>
  vals.find((v) => v !== undefined && v !== null && v !== "");

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen({ navigation }) {
  const { user, token } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [planInfo, setPlanInfo] = useState(null);
  const [emailUnverified, setEmailUnverified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Single loader used by both first load and pull-to-refresh
  const loadData = useCallback(async () => {
    if (!token) return;

    const [dashRes, planRes] = await Promise.allSettled([
      homeService.getDashboardData(token),
      planService.getActivePlan(user, null, token),
    ]);

    // Dashboard API is the source of truth
    if (dashRes.status === "fulfilled") {
      const d = dashRes.value;
      if (d && d.result !== false && d.data) {
        setDashboardData(d.data);
        setEmailUnverified(false);
      }
    } else if (/not verified/i.test(dashRes.reason?.message || "")) {
      // allSettled never throws, so the error lives in dashRes.reason
      setEmailUnverified(true);
      console.log("Dashboard: Account email pending verification.");
    } else {
      console.log("Could not fetch dashboard data:", dashRes.reason?.message);
    }

    // Plan service is only a fallback
    if (planRes.status === "fulfilled" && planRes.value) {
      setPlanInfo(planRes.value);
    }
  }, [token, user]);

  useEffect(() => {
    let active = true;
    (async () => {
      await loadData();
      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Live update when contacts or quota are used or photo updated
  useEffect(() => {
    const unsub = subscribeMemberAction((event) => {
      if (
        event?.type === "contact_viewed" &&
        event?.remainingContacts !== undefined
      ) {
        setPlanInfo((prev) =>
          prev ? { ...prev, remainingContacts: event.remainingContacts } : prev,
        );
        setDashboardData((prev) =>
          prev
            ? { ...prev, remaining_contact_view: event.remainingContacts }
            : prev,
        );
      }
      if (
        (event?.type === "profile_updated" ||
          event?.type === "profile_photo_updated") &&
        event?.photo
      ) {
        setDashboardData((prev) =>
          prev ? { ...prev, member_photo: event.photo } : prev,
        );
      }
    });
    return () => unsub();
  }, []);

  // "…" while loading, "—" when the API has no value
  const show = (v) => (v === undefined ? (loading ? "…" : "—") : v);

  // ---------- Derived fields ----------
  const rawName =
    pick(dashboardData?.member_name, user?.name) || "Welcome back";
  const firstName = String(rawName).split(" ")[0];
  const memberPhoto = pick(
    dashboardData?.member_photo,
    user?.avatar_original,
    user?.avatar,
  );

  const packageInfo = dashboardData?.current_package_info;
  const packageName =
    pick(packageInfo?.package_name, planInfo?.name) ||
    (loading ? "Loading…" : "Free Package");
  const packageExpiry = packageInfo?.package_expiry;
  const isFreePlan = !packageExpiry && /free/i.test(String(packageName));

  const remainingInterest = pick(
    dashboardData?.remaining_interest,
    planInfo?.remainingInterests,
  );
  const remainingContact = pick(
    dashboardData?.remaining_contact_view,
    planInfo?.remainingContacts,
  );
  const remainingGallery = pick(
    dashboardData?.remaining_photo_gallery,
    planInfo?.maxGallery,
  );
  const remainingProfileView = pick(
    dashboardData?.remaining_profile_viewer_view,
  );

  const stats = [
    {
      key: "interest",
      label: "Interests",
      value: show(remainingInterest),
      icon: "heart",
      tint: COLORS.primary,
      bg: "#FDF2F8",
      subtitle: "You can still send",
    },
    {
      key: "contact",
      label: "Contact views",
      value: show(remainingContact),
      icon: "call",
      tint: "#059669",
      bg: "#ECFDF5",
      subtitle: "Contacts you can view",
    },
    {
      key: "profileViewer",
      label: "Profile views",
      value: show(remainingProfileView),
      icon: "eye",
      tint: "#2563EB",
      bg: "#EFF6FF",
      subtitle: "Profiles you can view",
    },
    {
      key: "gallery",
      label: "Gallery uploads",
      value: show(remainingGallery),
      icon: "images",
      tint: "#EA580C",
      bg: "#FFF7ED",
      subtitle: "Photos you can add",
    },
  ];

  const handleStatPress = (key) => {
    if (key === "profileViewer") {
      navigation.navigate("ProfileViewer");
    } else if (key === "interest") {
      navigation.navigate("MyInterest");
    } else if (key === "gallery") {
      navigation.navigate("Gallery");
    } else if (key === "contact") {
      navigation.navigate("Packages");
    }
  };

  const planColor = isFreePlan ? COLORS.primary : PREMIUM_COLOR;

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      {/* ---------- STICKY HEADER ---------- */}
      <ScreenHeader>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.greeting}>{getGreeting()} 🙏</Text>
            <Text style={styles.name} numberOfLines={1}>
              {firstName}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => navigation.navigate("Profile")}
            activeOpacity={0.8}
            accessibilityLabel="Open profile"
          >
            <Image
              source={{
                uri:
                  memberPhoto &&
                  typeof memberPhoto === "string" &&
                  memberPhoto.trim().length > 0
                    ? memberPhoto.trim()
                    : DEFAULT_AVATAR,
              }}
              style={styles.avatarImg}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
      </ScreenHeader>

      {/* ---------- SCROLLABLE CONTENT ---------- */}
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Email Verification Notice */}
        {emailUnverified && (
          <View style={styles.verificationBanner}>
            <View style={styles.verificationIconWrap}>
              <Ionicons name="mail-unread-outline" size={18} color="#B78103" />
            </View>
            <View style={styles.verificationTextWrap}>
              <Text style={styles.verificationTitle}>Verify your email</Text>
              <Text style={styles.verificationSubtitle}>
                Verify your email on hindumatrimony.org.in to unlock live
                statistics and premium dashboard features.
              </Text>
            </View>
          </View>
        )}

        {loading && !dashboardData ? (
          <HomeScreenSkeleton />
        ) : (
          <>
            {/* ---------- Plan card ---------- */}
            <View style={[styles.planCard, { backgroundColor: planColor }]}>
              <View style={[styles.planCircle, styles.planCircleA]} />
              <View style={[styles.planCircle, styles.planCircleB]} />

              <View style={styles.planTopRow}>
                <View style={styles.planPill}>
                  <Ionicons
                    name={isFreePlan ? "shield-checkmark-outline" : "diamond"}
                    size={12}
                    color="#fff"
                    style={{ marginRight: 5 }}
                  />
                  <Text style={styles.planPillText}>Active plan</Text>
                </View>
              </View>

              <Text style={styles.planName} numberOfLines={2}>
                {packageName}
              </Text>

              {packageExpiry ? (
                <View style={styles.expiryRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color="rgba(255,255,255,0.85)"
                  />
                  <Text style={styles.expiryText}>
                    Valid until {packageExpiry}
                  </Text>
                </View>
              ) : (
                <Text style={styles.planHint}>
                  Get more interests, contact views and gallery uploads.
                </Text>
              )}

              <TouchableOpacity
                style={styles.planBtn}
                activeOpacity={0.85}
                onPress={() => navigation.navigate("Packages")}
              >
                <Text style={[styles.planBtnText, { color: planColor }]}>
                  {isFreePlan ? "Upgrade plan" : "View plans"}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={15}
                  color={planColor}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>
            </View>

            {/* ---------- Usage ---------- */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Your plan usage</Text>
              <Text style={styles.sectionSubtitle}>
                {"What's left in your current membership"}
              </Text>
            </View>

            <View style={styles.statsGrid}>
              {stats.map((stat) => (
                <TouchableOpacity
                  key={stat.key}
                  style={styles.statCard}
                  onPress={() => handleStatPress(stat.key)}
                  activeOpacity={0.75}
                >
                  <View style={styles.statTop}>
                    <View
                      style={[
                        styles.statIconWrap,
                        { backgroundColor: stat.bg },
                      ]}
                    >
                      <Ionicons name={stat.icon} size={20} color={stat.tint} />
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={COLORS.textLight}
                    />
                  </View>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {stat.label}
                  </Text>
                  <Text style={styles.statSubtitle} numberOfLines={2}>
                    {stat.subtitle}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const CARD_SHADOW = {
  shadowColor: "#7A4A2B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 2,
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  /* ---------- Header ---------- */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
  },
  name: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginTop: 2,
    letterSpacing: -0.3,
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: COLORS.primarySoft,
    backgroundColor: "#F3F4F6",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },

  scroll: { padding: 16, paddingBottom: 40 },

  /* ---------- Verification ---------- */
  verificationBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9E6",
    borderWidth: 1,
    borderColor: "#FFE082",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  verificationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF0B3",
    alignItems: "center",
    justifyContent: "center",
  },
  verificationTextWrap: { flex: 1, marginLeft: 12 },
  verificationTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#B78103",
  },
  verificationSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: "#6D540A",
    marginTop: 2,
    lineHeight: 16,
  },

  /* ---------- Plan card ---------- */
  planCard: {
    borderRadius: 24,
    padding: 20,
    overflow: "hidden",
    marginBottom: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 5,
  },
  planCircle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  planCircleA: {
    width: 190,
    height: 190,
    top: -80,
    right: -50,
  },
  planCircleB: {
    width: 110,
    height: 110,
    bottom: -45,
    left: -25,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  planTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  planPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  planPillText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: "#fff",
  },
  planName: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: "#fff",
    letterSpacing: -0.4,
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  expiryText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: "rgba(255,255,255,0.9)",
  },
  planHint: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: "rgba(255,255,255,0.88)",
    marginTop: 8,
    lineHeight: 19,
    maxWidth: 260,
  },
  planBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    marginTop: 18,
  },
  planBtnText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },

  /* ---------- Usage grid ---------- */
  sectionHead: {
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 3,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statCard: {
    width: "48.5%",
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    ...CARD_SHADOW,
  },
  statTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 30,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginTop: 4,
  },
  statSubtitle: {
    fontSize: 11.5,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 2,
    lineHeight: 16,
  },
});
