import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import { Skeleton } from "../components/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import profileViewerService from "../services/profileViewerService";
import homeService from "../services/homeService";
import memberStateService from "../services/memberStateService";
import { COLORS, FONTS, DEFAULT_AVATAR, DEFAULT_FEMALE_AVATAR } from "../theme";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatViewedAt(str) {
  if (!str) return "";
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const month = MONTHS[d.getMonth()] || "";
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${day} ${month} ${year} • ${hours}:${minutes} ${ampm}`;
    }
  } catch {
    // Fallback
  }

  // Secondary parsing for 'DD-MM-YYYY' or 'YYYY-MM-DD'
  const cleanStr = String(str).trim();
  if (cleanStr.includes("-")) {
    const parts = cleanStr.split(" ");
    const datePart = parts[0];
    const timePart = parts[1] || "";
    const segments = datePart.split("-");
    if (segments.length === 3) {
      if (segments[0].length === 4) {
        // YYYY-MM-DD
        const mName = MONTHS[parseInt(segments[1], 10) - 1] || segments[1];
        return `${segments[2]} ${mName} ${segments[0]}${timePart ? ` • ${timePart}` : ""}`;
      } else {
        // DD-MM-YYYY
        const mName = MONTHS[parseInt(segments[1], 10) - 1] || segments[1];
        return `${segments[0]} ${mName} ${segments[2]}${timePart ? ` • ${timePart}` : ""}`;
      }
    }
  }
  return cleanStr;
}

function formatViewerItem(item) {
  if (!item) return null;

  // Check nested visitor, user, or member object
  const userObj = item.visitor || item.user || item.member || {};

  // Determine target user ID
  const targetUserId =
    userObj.id ||
    item.visitor_user_id ||
    item.user_id ||
    item.member_id ||
    item.id;

  // Name
  const firstName = userObj.first_name || item.first_name || "";
  const lastName = userObj.last_name || item.last_name || "";
  const name =
    userObj.name ||
    item.name ||
    (firstName ? `${firstName} ${lastName}`.trim() : "Member");

  // Code / ID
  const code =
    userObj.code ||
    item.code ||
    userObj.member_code ||
    item.member_code ||
    (targetUserId ? `HM-${targetUserId}` : "");

  // Gender & Default Avatar
  const gender = userObj.gender || item.gender || "";
  const defaultAvatar =
    String(gender).toLowerCase() === "female"
      ? DEFAULT_FEMALE_AVATAR
      : DEFAULT_AVATAR;

  // Photo
  const photo =
    userObj.photo ||
    userObj.avatar ||
    userObj.avatar_original ||
    item.photo ||
    item.avatar ||
    item.avatar_original ||
    defaultAvatar;

  // Age
  const age = userObj.age || item.age;

  // Location & Community
  const city = userObj.city || item.city || "";
  const state = userObj.state || item.state || "";
  const location = [city, state].filter(Boolean).join(", ");

  const religion = userObj.religion || item.religion || "";
  const caste = userObj.caste || item.caste || "";
  const community = [religion, caste].filter(Boolean).join(" • ");

  // Viewed timestamp
  const rawTime =
    item.viewed_at ||
    item.created_at ||
    item.created_at_formatted ||
    item.date ||
    item.time ||
    "";
  const viewedAt = formatViewedAt(rawTime);

  return {
    id: String(item.id || targetUserId),
    targetUserId,
    name,
    code,
    photo,
    age: age ? `${age} yrs` : "",
    gender,
    location,
    community,
    viewedAt,
  };
}

function ViewerRowItem({ item, onPress }) {
  return (
    <TouchableOpacity
      style={styles.viewerCard}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Image
        source={{
          uri:
            item?.photo &&
            typeof item.photo === "string" &&
            item.photo.trim().length > 0
              ? item.photo.trim()
              : DEFAULT_AVATAR,
        }}
        style={styles.avatar}
        resizeMode="cover"
      />
      <View style={styles.cardContent}>
        <View style={styles.cardNameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Ionicons
            name="checkmark-circle"
            size={14}
            color="#059669"
            style={{ marginLeft: 4 }}
          />
        </View>

        {item.code ? (
          <View style={styles.codePill}>
            <Text style={styles.codeText}>ID: {item.code}</Text>
          </View>
        ) : null}

        {item.age || item.community || item.location ? (
          <Text style={styles.subInfoText} numberOfLines={1}>
            {[item.age, item.community, item.location]
              .filter(Boolean)
              .join(" • ")}
          </Text>
        ) : null}

        {item.viewedAt ? (
          <View style={styles.viewedTimeRow}>
            <Ionicons
              name="eye-outline"
              size={12}
              color={COLORS.primary}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.viewedTimeText}>Viewed {item.viewedAt}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.viewProfileBtn}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.viewProfileBtnText}>View</Text>
        <Ionicons name="chevron-forward" size={12} color={COLORS.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function ViewerSkeletonRow() {
  return (
    <View style={styles.viewerCard}>
      <Skeleton width={56} height={56} borderRadius={28} />
      <View style={[styles.cardContent, { marginLeft: 12 }]}>
        <Skeleton width="60%" height={16} borderRadius={6} />
        <Skeleton
          width="40%"
          height={12}
          borderRadius={6}
          style={{ marginTop: 6 }}
        />
        <Skeleton
          width="80%"
          height={12}
          borderRadius={6}
          style={{ marginTop: 6 }}
        />
      </View>
    </View>
  );
}

export default function ProfileViewerScreen({ navigation }) {
  const { token, user } = useAuth();

  const [viewers, setViewers] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [packageGated, setPackageGated] = useState(false);
  const [remainingViews, setRemainingViews] = useState(null);
  const [error, setError] = useState(null);

  const isFetchingRef = useRef(false);

  const isPremium = useMemo(() => {
    if (
      user?.package_name &&
      String(user.package_name).toLowerCase().includes("free")
    )
      return false;
    const mem = Number(user?.membership);
    const pkgId = Number(user?.package_id || user?.current_package_id);
    if (pkgId === 1) return false;
    if (pkgId > 1) return true;
    if (mem === 1) return false;
    if (mem >= 2) return true;
    return Boolean(
      user?.is_premium || memberStateService.resolvePlan(user) === "Premium",
    );
  }, [user]);

  const fetchPage = useCallback(
    async (page, { isRefresh = false } = {}) => {
      if (!token || isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (isRefresh) setRefreshing(true);
      else if (page === 1) setLoading(true);
      else setLoadingMore(true);

      setError(null);

      try {
        // Fetch profile viewers & dashboard stats in parallel on first page
        const [viewerRes, dashRes] = await Promise.allSettled([
          profileViewerService.getProfileViewers(token, page),
          page === 1
            ? homeService.getDashboardData(token)
            : Promise.resolve(null),
        ]);

        if (dashRes.status === "fulfilled" && dashRes.value?.data) {
          const dData = dashRes.value.data;
          if (dData.remaining_profile_viewer_view !== undefined) {
            setRemainingViews(dData.remaining_profile_viewer_view);
          }
        }

        if (viewerRes.status === "fulfilled") {
          const res = viewerRes.value;

          if (res.packageGated) {
            setPackageGated(true);
            setViewers([]);
          } else {
            setPackageGated(false);
            const formatted = (res.data || [])
              .map(formatViewerItem)
              .filter(Boolean);

            setViewers((prev) =>
              page === 1 ? formatted : [...prev, ...formatted],
            );
            setMeta(
              res.meta || {
                current_page: page,
                last_page: page,
                total: formatted.length,
              },
            );

            if (res.remainingViews !== undefined) {
              setRemainingViews(res.remainingViews);
            }
          }
        } else {
          const errMsg =
            viewerRes.reason?.message || "Could not load profile viewers.";
          if (/package|upgrade|limit|remaining|permission/i.test(errMsg)) {
            setPackageGated(true);
          } else {
            setError(errMsg);
          }
        }
      } catch (err) {
        setError(err?.message || "Could not load profile viewers.");
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      fetchPage(1);
    }, [fetchPage]),
  );

  const onRefresh = useCallback(() => {
    fetchPage(1, { isRefresh: true });
  }, [fetchPage]);

  const hasMore = meta.current_page < meta.last_page;

  const onEndReached = useCallback(() => {
    if (!hasMore || loadingMore || loading || refreshing) return;
    fetchPage(meta.current_page + 1);
  }, [hasMore, loadingMore, loading, refreshing, meta.current_page, fetchPage]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // No history (opened via tab/reset): go to a safe fallback screen.
      // Change "Home" to your actual home route name if different.
      navigation.navigate("Home");
    }
    return true;
  }, [navigation]);

  // Android hardware back button
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", handleBack);
      return () => sub.remove();
    }, [handleBack]),
  );

  const handleOpenProfile = useCallback(
    (item) => {
      if (!item?.targetUserId) return;
      navigation.navigate("MemberProfile", {
        userId: item.targetUserId,
        memberId: item.targetUserId,
      });
    },
    [navigation],
  );

  const renderEmpty = () => {
    if (loading) return null;

    if (packageGated) {
      return (
        <View style={styles.premiumGateCard}>
          <View style={styles.gateIconWrap}>
            <Ionicons name="sparkles" size={32} color="#7C3AED" />
          </View>
          <Text style={styles.gateTitle}>Unlock Profile Viewers</Text>
          <Text style={styles.gateSubtitle}>
            See who is viewing your profile! Upgrading to a premium package
            gives you visitor insights, direct contact views, and unlimited
            interests.
          </Text>

          <TouchableOpacity
            style={styles.gateUpgradeBtn}
            onPress={() => navigation.navigate("Packages")}
            activeOpacity={0.85}
          >
            <Ionicons
              name="diamond"
              size={16}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.gateUpgradeBtnText}>
              View Packages & Upgrade
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyWrap}>
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color={COLORS.danger}
          />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => fetchPage(1)}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="eye-outline" size={36} color={COLORS.primary} />
        </View>
        <Text style={styles.emptyTitle}>No profile views yet</Text>
        <Text style={styles.emptySubtitle}>
          When members browse and view your profile, they will appear here.
        </Text>
        <TouchableOpacity
          style={styles.exploreMembersBtn}
          onPress={() => navigation.navigate("ActiveMembers")}
          activeOpacity={0.8}
        >
          <Text style={styles.exploreMembersBtnText}>
            Browse Active Members
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <ScreenHeader
        title="Profile Viewers"
        subtitle={
          meta.total
            ? `${meta.total} member${meta.total > 1 ? "s" : ""} viewed your profile`
            : "Who viewed your profile"
        }
        showBack
        onBackPress={handleBack}
        onBack={handleBack}
        onPressBack={handleBack}
      />

      {/* Quota / Status Banner */}
      {!loading && (
        <View style={styles.topBannerRow}>
          <View style={styles.quotaPill}>
            <Ionicons
              name="eye"
              size={13}
              color={remainingViews > 0 ? COLORS.primary : COLORS.textLight}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.quotaPillText}>
              {remainingViews !== null && remainingViews !== undefined
                ? `Remaining Views: ${remainingViews}`
                : isPremium
                  ? "Premium View Access"
                  : "Basic View Access"}
            </Text>
          </View>

          {!isPremium ? (
            <TouchableOpacity
              style={styles.upgradeHeaderPill}
              onPress={() => navigation.navigate("Packages")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="sparkles"
                size={11}
                color="#7C3AED"
                style={{ marginRight: 3 }}
              />
              <Text style={styles.upgradeHeaderPillText}>Upgrade</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Skeleton Loading State */}
      {loading ? (
        <View style={styles.skeletonContainer}>
          <ViewerSkeletonRow />
          <ViewerSkeletonRow />
          <ViewerSkeletonRow />
          <ViewerSkeletonRow />
          <ViewerSkeletonRow />
        </View>
      ) : (
        <FlatList
          data={viewers}
          keyExtractor={(item, idx) =>
            String(item.id || item.targetUserId || idx)
          }
          renderItem={({ item }) => (
            <ViewerRowItem
              item={item}
              onPress={() => handleOpenProfile(item)}
            />
          )}
          contentContainerStyle={
            viewers.length === 0 ? styles.emptyListContent : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  quotaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  quotaPillText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  upgradeHeaderPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  upgradeHeaderPillText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: "#7C3AED",
  },
  skeletonContainer: {
    padding: 16,
    gap: 10,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyListContent: {
    flexGrow: 1,
    padding: 16,
  },

  viewerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: COLORS.primarySoft,
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    flexShrink: 1,
  },
  codePill: {
    backgroundColor: "#F3EDE8",
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginTop: 2,
  },
  codeText: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  subInfoText: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 3,
  },
  viewedTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  viewedTimeText: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  viewProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF0F5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCE7F3",
  },
  viewProfileBtnText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
    marginRight: 2,
  },

  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  exploreMembersBtn: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  exploreMembersBtnText: {
    color: "#fff",
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: "#fff",
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },

  /* Premium Gate Card */
  premiumGateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    marginTop: 40,
    marginHorizontal: 8,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  gateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  gateTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  gateSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
  gateUpgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7C3AED",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 20,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  gateUpgradeBtnText: {
    color: "#fff",
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
});
