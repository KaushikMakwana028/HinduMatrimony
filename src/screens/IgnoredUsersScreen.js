import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import { useAuth } from "../contexts/AuthContext";
import ignoreService from "../services/ignoreService";
import {
  subscribeMemberAction,
  emitMemberAction,
} from "../services/memberEvents";
import { COLORS, FONTS, DEFAULT_AVATAR } from "../theme";

/**
 * Smart Pagination Range Generator
 */
function getPaginationRange(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

/**
 * Resolves membership plan (Premium vs Free badge)
 */
function getMemberPlan(item) {
  if (!item) return "Free";

  let userObj = item.user;
  if (typeof userObj === "string") {
    try {
      userObj = JSON.parse(userObj);
    } catch {}
  }
  if (!userObj || typeof userObj !== "object") userObj = null;

  // 1. Textual package names check
  const candidates = [
    item.package_name,
    userObj?.package_name,
    item.package?.name,
    userObj?.package?.name,
    item.current_package_name,
    userObj?.current_package_name,
    item.current_package_info?.package_name,
    userObj?.current_package_info?.package_name,
    item.package_info?.package_name,
    userObj?.package_info?.package_name,
    item.member_plan,
    userObj?.member_plan,
    item.plan,
    userObj?.plan,
    typeof item.package === "string" ? item.package : "",
    typeof userObj?.package === "string" ? userObj?.package : "",
  ];

  for (const c of candidates) {
    if (!c) continue;
    const str = String(c).trim().toLowerCase();
    if (
      str.includes("premium") ||
      str.includes("gold") ||
      str.includes("silver") ||
      str.includes("platinum") ||
      str.includes("vip") ||
      str.includes("diamond") ||
      str.includes("pro") ||
      str.includes("paid")
    ) {
      return "Premium";
    }
  }

  // 2. Numeric package_id (> 1 means paid/premium package in Active Matrimonial CMS)
  const pkgIds = [
    item.package_id,
    userObj?.package_id,
    item.current_package_id,
    userObj?.current_package_id,
    item.package?.id,
    userObj?.package?.id,
  ];
  for (const pid of pkgIds) {
    const num = Number(pid);
    if (Number.isFinite(num) && num > 1) {
      return "Premium";
    }
  }

  // 3. Membership status (>= 2 is paid/premium in Active Matrimonial CMS)
  const memVals = [
    item.membership,
    userObj?.membership,
    item.membership_type,
    userObj?.membership_type,
    item.member_type,
    userObj?.member_type,
  ];
  for (const m of memVals) {
    const num = Number(m);
    if (Number.isFinite(num) && num >= 2) {
      return "Premium";
    }
    if (typeof m === "string") {
      const lower = m.toLowerCase();
      if (
        lower.includes("paid") ||
        lower.includes("premium") ||
        lower.includes("silver") ||
        lower.includes("gold") ||
        lower.includes("platinum")
      ) {
        return "Premium";
      }
    }
  }

  // 4. Boolean or flag checks
  if (
    item.is_premium === true ||
    item.is_premium === 1 ||
    item.is_premium === "1" ||
    userObj?.is_premium === true ||
    userObj?.is_premium === 1 ||
    userObj?.is_premium === "1"
  ) {
    return "Premium";
  }

  return "Free";
}

/**
 * Normalizes ignored member item from API
 */
function formatIgnoredMember(item, index) {
  if (!item) return null;
  const userObj = item.user && typeof item.user === "object" ? item.user : null;
  const id =
    item.user_id ||
    userObj?.id ||
    item.id ||
    item.member_id ||
    index + 1;

  const rawName =
    item.name ||
    userObj?.name ||
    `${item.first_name || userObj?.first_name || ""} ${item.last_name || userObj?.last_name || ""}`.trim();
  const name =
    rawName ||
    `Member ${item.code || userObj?.code || item.member_code || id}`;

  const rawPhoto =
    item.photo ||
    userObj?.photo ||
    item.avatar ||
    userObj?.avatar ||
    item.avatar_original ||
    userObj?.avatar_original ||
    item.profile_image ||
    "";
  const photoStr = String(rawPhoto).trim();
  const isValidPhoto =
    photoStr &&
    photoStr !== "null" &&
    photoStr !== "undefined";
  const finalPhoto = isValidPhoto ? photoStr : DEFAULT_AVATAR;

  const rawCity =
    typeof item.city === "object"
      ? item.city?.name
      : item.city || userObj?.city || "";
  const rawState =
    typeof item.state === "object"
      ? item.state?.name
      : item.state || userObj?.state || "";
  const rawCountry =
    typeof item.country === "object"
      ? item.country?.name
      : item.country || userObj?.country || "";

  const loc =
    [rawCity, rawState, rawCountry]
      .filter((v) => v && typeof v === "string" && v.trim())
      .join(", ") ||
    item.location ||
    userObj?.location ||
    "";

  return {
    id: id,
    userId: item.user_id || userObj?.id || id,
    name: name,
    memberId: String(
      item.code ||
        userObj?.code ||
        item.member_code ||
        userObj?.member_code ||
        `HM-${id}`,
    ),
    photo: finalPhoto,
    plan: getMemberPlan(item),
    age: item.age || userObj?.age || item.birthday || "",
    height: item.height || userObj?.height
      ? String(item.height || userObj?.height).includes("ft")
        ? item.height || userObj?.height
        : `${item.height || userObj?.height} ft`
      : "",
    religion:
      item.religion ||
      userObj?.religion ||
      item.religion_name ||
      userObj?.religion_name ||
      "",
    caste:
      item.caste ||
      userObj?.caste ||
      item.caste_name ||
      userObj?.caste_name ||
      "",
    motherTongue:
      item.mothere_tongue ||
      userObj?.mothere_tongue ||
      item.mother_tongue ||
      userObj?.mother_tongue ||
      "",
    location: loc,
    maritalStatus:
      item.marital_status ||
      userObj?.marital_status ||
      item.maritial_status ||
      "",
    profession:
      item.profession ||
      userObj?.profession ||
      item.career ||
      userObj?.career ||
      "",
    raw: item,
  };
}

export default function IgnoredUsersScreen() {
  const { token } = useAuth();
  const navigation = useNavigation();
  const flatListRef = useRef(null);

  const [ignoredUsers, setIgnoredUsers] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(token));
  const [pageLoading, setPageLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionInProgress, setActionInProgress] = useState({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(10);

  // Fetch paginated ignored users from server
  const fetchIgnoredUsers = useCallback(
    async (page = 1, isSilent = false) => {
      if (!token) {
        setLoading(false);
        setPageLoading(false);
        return;
      }
      if (isSilent) {
        setPageLoading(true);
      } else {
        setLoading(true);
      }

      try {
        const res = await ignoreService.getIgnoredUsers(page, token);
        if (res && res.result !== false && res.data) {
          const rawList = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
              ? res.data.data
              : [];
          const formatted = rawList.map(formatIgnoredMember).filter(Boolean);
          setIgnoredUsers(formatted);

          // Parse meta information
          const meta = res.meta || {};
          const pageNum = Number(meta.current_page ?? page) || 1;
          const lastP = Number(meta.last_page) || 1;
          const total =
            meta.total !== undefined ? Number(meta.total) : formatted.length;
          const perP = Number(meta.per_page) || 10;

          setCurrentPage(pageNum);
          setTotalPages(Math.max(1, lastP));
          setTotalItems(total);
          setPerPage(perP);
        } else {
          setIgnoredUsers([]);
          setTotalItems(0);
          setTotalPages(1);
        }
      } catch (err) {
        console.log("Fetch ignored users error:", err?.message);
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    },
    [token],
  );

  // Initial load
  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    (async () => {
      if (isMounted) {
        await fetchIgnoredUsers(1, false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token, fetchIgnoredUsers]);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await fetchIgnoredUsers(1, true);
    } finally {
      setRefreshing(false);
    }
  }, [token, fetchIgnoredUsers]);

  // Handle Page Change with smooth scroll to top and server fetch
  const handlePageChange = async (newPage) => {
    if (
      newPage < 1 ||
      newPage > totalPages ||
      newPage === currentPage ||
      pageLoading
    )
      return;
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    await fetchIgnoredUsers(newPage, true);
  };

  // Cross-screen sync (when a user is ignored or un-ignored from another screen)
  useEffect(() => {
    return subscribeMemberAction(({ userId, type, value }) => {
      const uid = String(userId);
      if (type === "ignore") {
        if (!value) {
          // Unignored elsewhere: remove from list
          setIgnoredUsers((prev) =>
            prev.filter(
              (m) => String(m.id) !== uid && String(m.userId) !== uid,
            ),
          );
          setTotalItems((prev) => Math.max(0, prev - 1));
        } else {
          // Newly ignored: refresh current page
          fetchIgnoredUsers(currentPage, true);
        }
      }
    });
  }, [fetchIgnoredUsers, currentPage]);

  // Handle Remove from Ignore List (Unignore)
  const handleUnignore = (member) => {
    Alert.alert(
      "Unignore Member",
      `Are you sure you want to remove ${member.name} from your ignored list? They will be visible again in your match feeds.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unignore",
          onPress: async () => {
            setActionInProgress((prev) => ({ ...prev, [member.id]: true }));
            try {
              const res = await ignoreService.removeFromIgnoreList(
                member.userId,
                token,
              );
              setIgnoredUsers((prev) =>
                prev.filter(
                  (m) =>
                    String(m.id) !== String(member.id) &&
                    String(m.userId) !== String(member.userId),
                ),
              );
              setTotalItems((prev) => Math.max(0, prev - 1));
              emitMemberAction({
                userId: member.userId,
                type: "ignore",
                value: false,
              });
              Alert.alert(
                "Member Unignored",
                res?.message || `${member.name} has been removed from your ignored list.`,
              );
            } catch (err) {
              Alert.alert(
                "Notice",
                err.message || "Failed to remove member from ignored list",
              );
            } finally {
              setActionInProgress((prev) => ({ ...prev, [member.id]: false }));
            }
          },
        },
      ],
    );
  };

  // Open Full Member Profile
  const handleViewProfile = (member) => {
    navigation.navigate("MemberProfile", {
      userId: member.userId,
      member: {
        name: member.name,
        memberId: member.memberId,
        photo: member.photo,
        age: member.age,
        plan: member.plan,
        ignored: true,
        summary: {
          height: member.height,
          religion: member.religion,
          caste: member.caste,
          marital: member.maritalStatus,
          country: member.location,
          motherTongue: member.motherTongue || "",
        },
      },
    });
  };

  // Filtered ignored users by live search query
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ignoredUsers;

    return ignoredUsers.filter((m) => {
      const name = String(m.name || "").toLowerCase();
      const code = String(m.memberId || "").toLowerCase();
      const rawId = String(m.id || "").toLowerCase();
      const religion = String(m.religion || "").toLowerCase();
      const caste = String(m.caste || "").toLowerCase();
      const loc = String(m.location || "").toLowerCase();
      const profession = String(m.profession || "").toLowerCase();
      const marital = String(m.maritalStatus || "").toLowerCase();
      const motherTongue = String(m.motherTongue || "").toLowerCase();

      return (
        name.includes(q) ||
        code.includes(q) ||
        rawId.includes(q) ||
        religion.includes(q) ||
        caste.includes(q) ||
        loc.includes(q) ||
        profession.includes(q) ||
        marital.includes(q) ||
        motherTongue.includes(q)
      );
    });
  }, [ignoredUsers, searchQuery]);

  // Render individual ignored member card
  const renderItem = ({ item }) => {
    const busy = Boolean(actionInProgress[item.id]);

    return (
      <View style={styles.card}>
        {/* Top Info Section: Photo + Core Details */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleViewProfile(item)}
          style={styles.cardTopRow}
        >
          {/* Portrait Photo Container */}
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: item.photo || DEFAULT_AVATAR }}
              style={styles.cardPhoto}
              resizeMode="cover"
            />

            {/* Plan Badge Overlay on Photo */}
            <View
              style={[
                styles.planBadge,
                item.plan === "Premium" ? styles.planPremium : styles.planFree,
              ]}
            >
              <Ionicons
                name={item.plan === "Premium" ? "ribbon" : "sparkles"}
                size={9}
                color="#fff"
                style={{ marginRight: 2 }}
              />
              <Text style={styles.planBadgeText}>{item.plan}</Text>
            </View>
          </View>

          {/* Core Info Column */}
          <View style={styles.cardInfoCol}>
            {/* Name, Age & Ignored badge */}
            <View style={styles.nameHeaderRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                  {item.age ? (
                    <Text style={styles.cardAge}>, {item.age} yrs</Text>
                  ) : null}
                </Text>
                <View style={styles.idBadgeRow}>
                  <Text style={styles.idBadgeText}>{item.memberId}</Text>
                </View>
              </View>

              {/* Status Pill: Ignored */}
              <View style={styles.ignoredPill}>
                <Ionicons
                  name="ban"
                  size={10.5}
                  color="#DC2626"
                  style={{ marginRight: 3 }}
                />
                <Text style={styles.ignoredPillText}>Ignored</Text>
              </View>
            </View>

            {/* Attribute Chips */}
            <View style={styles.chipsRow}>
              {item.height ? (
                <View style={styles.chip}>
                  <Ionicons
                    name="resize-outline"
                    size={11}
                    color={COLORS.primary}
                  />
                  <Text style={styles.chipText}>{item.height}</Text>
                </View>
              ) : null}

              {item.religion ? (
                <View style={styles.chip}>
                  <Ionicons
                    name="flower-outline"
                    size={11}
                    color={COLORS.primary}
                  />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {item.religion}
                    {item.caste ? ` • ${item.caste}` : ""}
                  </Text>
                </View>
              ) : null}

              {item.maritalStatus ? (
                <View style={styles.chip}>
                  <Ionicons
                    name="heart-outline"
                    size={11}
                    color={COLORS.primary}
                  />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {item.maritalStatus}
                  </Text>
                </View>
              ) : null}

              {item.location ? (
                <View style={styles.chip}>
                  <Ionicons
                    name="location-outline"
                    size={11}
                    color={COLORS.primary}
                  />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {item.location}
                  </Text>
                </View>
              ) : null}

              {item.profession ? (
                <View style={styles.chip}>
                  <Ionicons
                    name="briefcase-outline"
                    size={11}
                    color={COLORS.primary}
                  />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {item.profession}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.cardDivider} />

        {/* Action Buttons Row */}
        <View style={styles.actionsGrid}>
          {/* Unignore Button */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.unignoreBtn]}
            onPress={() => handleUnignore(item)}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#1E293B" />
            ) : (
              <>
                <Ionicons
                  name="eye-outline"
                  size={15}
                  color="#1E293B"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.unignoreBtnText}>Unignore Profile</Text>
              </>
            )}
          </TouchableOpacity>

          {/* View Profile Button */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.viewProfileBtn]}
            onPress={() => handleViewProfile(item)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-outline"
              size={14}
              color={COLORS.primary}
              style={{ marginRight: 5 }}
            />
            <Text style={styles.viewProfileText}>View Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* ---------- STICKY HEADER ---------- */}
      <ScreenHeader
        title="Ignored Users"
        subtitle="Profiles hidden from your match feeds"
        showBack
        onBack={() => navigation.goBack()}
        badge={`${totalItems || ignoredUsers.length} Ignored`}
        badgeIcon="ban-outline"
        badgeColor="#DC2626"
        badgeBgColor="#FEE2E2"
      >
        {/* Instant Search Bar */}
        {(totalItems > 0 || ignoredUsers.length > 0 || searchQuery.length > 0) && (
          <View style={styles.searchBarContainer}>
            <Ionicons
              name="search"
              size={17}
              color={COLORS.textLight}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, ID, caste, location..."
              placeholderTextColor={COLORS.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                style={styles.clearSearchBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={17}
                  color={COLORS.textLight}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScreenHeader>

      {/* Page Loading Banner */}
      {pageLoading && (
        <View style={styles.pageLoadingBanner}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.pageLoadingText}>
            Loading page {currentPage}...
          </Text>
        </View>
      )}

      {/* ---------- CONTENT FEED ---------- */}
      {loading && !pageLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading ignored users...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredUsers}
          keyExtractor={(item, index) =>
            String(
              item?.userId ||
                item?.id ||
                item?.memberId ||
                `ignored_${index}`,
            )
          }
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={
            filteredUsers.length > 0 ? (
              <View style={styles.resultsSummaryRow}>
                <Text style={styles.resultsSummaryText}>
                  Showing{" "}
                  <Text style={styles.resultsSummaryBold}>
                    {filteredUsers.length}
                  </Text>{" "}
                  of {totalItems || ignoredUsers.length} ignored members
                </Text>
                {searchQuery.trim() ? (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Text style={styles.clearSearchLink}>Clear Search</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null
          }
          ListFooterComponent={
            !loading && filteredUsers.length > 0 && !searchQuery.trim() ? (
              <View style={styles.paginationCard}>
                <View style={styles.paginationSummaryRow}>
                  <Text style={styles.paginationSummaryText}>
                    Showing{" "}
                    <Text style={styles.paginationBoldText}>
                      {totalItems === 0
                        ? 0
                        : (currentPage - 1) * perPage + 1}
                      -
                      {Math.min(currentPage * perPage, totalItems)}
                    </Text>{" "}
                    of{" "}
                    <Text style={styles.paginationBoldText}>{totalItems}</Text>{" "}
                    ignored profiles
                  </Text>
                </View>

                {totalPages > 1 && (
                  <View style={styles.paginationControlsRow}>
                    {/* Prev Button */}
                    <TouchableOpacity
                      style={[
                        styles.navPageBtn,
                        (currentPage === 1 || pageLoading) &&
                          styles.navPageBtnDisabled,
                      ]}
                      onPress={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || pageLoading}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={14}
                        color={
                          currentPage === 1 || pageLoading
                            ? "#CBD5E1"
                            : COLORS.text
                        }
                      />
                      <Text
                        style={[
                          styles.navPageBtnText,
                          (currentPage === 1 || pageLoading) &&
                            styles.navPageBtnTextDisabled,
                        ]}
                      >
                        Prev
                      </Text>
                    </TouchableOpacity>

                    {/* Page Numbers */}
                    <View style={styles.pagePillsGroup}>
                      {getPaginationRange(currentPage, totalPages).map(
                        (p, idx) => {
                          if (p === "...") {
                            const isLeftEllipsis = idx === 1;
                            const targetPage = isLeftEllipsis
                              ? Math.max(1, currentPage - 5)
                              : Math.min(totalPages, currentPage + 5);
                            return (
                              <TouchableOpacity
                                key={`ellipsis_${idx}`}
                                style={styles.ellipsisWrap}
                                onPress={() => handlePageChange(targetPage)}
                                disabled={pageLoading}
                                activeOpacity={0.6}
                              >
                                <Text style={styles.ellipsisText}>•••</Text>
                              </TouchableOpacity>
                            );
                          }

                          const isCurrent = p === currentPage;
                          return (
                            <TouchableOpacity
                              key={`page_${p}`}
                              style={[
                                styles.pageNumberBtn,
                                isCurrent && styles.pageNumberBtnActive,
                                pageLoading && styles.pageNumberBtnLoading,
                              ]}
                              onPress={() => handlePageChange(p)}
                              disabled={pageLoading || isCurrent}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.pageNumberText,
                                  isCurrent && styles.pageNumberTextActive,
                                ]}
                              >
                                {p}
                              </Text>
                            </TouchableOpacity>
                          );
                        },
                      )}
                    </View>

                    {/* Next Button */}
                    <TouchableOpacity
                      style={[
                        styles.navPageBtn,
                        (currentPage === totalPages || pageLoading) &&
                          styles.navPageBtnDisabled,
                      ]}
                      onPress={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages || pageLoading}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.navPageBtnText,
                          (currentPage === totalPages || pageLoading) &&
                            styles.navPageBtnTextDisabled,
                        ]}
                      >
                        Next
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={
                          currentPage === totalPages || pageLoading
                            ? "#CBD5E1"
                            : COLORS.text
                        }
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            searchQuery.trim() ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons
                    name="search-outline"
                    size={42}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.emptyTitle}>No Matching Users</Text>
                <Text style={styles.emptySubtitle}>
                  We could not find any ignored member matching &ldquo;
                  {searchQuery}&rdquo;.
                </Text>
                <TouchableOpacity
                  style={styles.exploreBtn}
                  onPress={() => setSearchQuery("")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.exploreBtnText}>Clear Search</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={44}
                    color="#10B981"
                  />
                </View>
                <Text style={styles.emptyTitle}>No Ignored Users</Text>
                <Text style={styles.emptySubtitle}>
                  You have not ignored any members. When you ignore a member,
                  they won&apos;t appear in your active matches feed and will be
                  listed here.
                </Text>
                <TouchableOpacity
                  style={styles.exploreBtn}
                  onPress={() => navigation.navigate("ActiveMembers")}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="sparkles"
                    size={16}
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.exploreBtnText}>
                    Explore Active Members
                  </Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9F6F4",
  },

  /* Header Group */
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FAF5F2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#EAE0DA",
  },
  headerTitleGroup: {
    flex: 1,
  },
  titleWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 21,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  countBadgeText: {
    fontSize: 11.5,
    fontFamily: FONTS.bold,
    color: "#991B1B",
  },
  subtitle: {
    fontSize: 12.5,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 2,
  },

  /* Search Bar */
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF5F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAE0DA",
    paddingHorizontal: 12,
    height: 42,
    marginTop: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    height: "100%",
  },
  clearSearchBtn: {
    padding: 4,
  },

  /* Content Feed */
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  resultsSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  resultsSummaryText: {
    fontSize: 12.5,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  resultsSummaryBold: {
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  clearSearchLink: {
    fontSize: 12.5,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },

  /* Card */
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EFE8E3",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  /* Portrait Photo */
  photoContainer: {
    position: "relative",
    width: 82,
    height: 98,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#FCE7F3",
  },
  cardPhoto: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  photoFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2B2D42",
    alignItems: "center",
    justifyContent: "center",
  },
  photoInitial: {
    color: "#fff",
    fontSize: 28,
    fontFamily: FONTS.bold,
  },
  planBadge: {
    position: "absolute",
    bottom: 5,
    left: 5,
    right: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  planPremium: {
    backgroundColor: "#E11D48",
  },
  planFree: {
    backgroundColor: "#475569",
  },
  planBadgeText: {
    color: "#fff",
    fontSize: 8.5,
    fontFamily: FONTS.bold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  /* Info Column */
  cardInfoCol: {
    flex: 1,
    marginLeft: 14,
  },
  nameHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  cardAge: {
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  idBadgeRow: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  idBadgeText: {
    fontSize: 10.5,
    fontFamily: FONTS.semiBold,
    color: "#475569",
  },
  ignoredPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  ignoredPillText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: "#DC2626",
    textTransform: "uppercase",
  },

  /* Attribute Chips */
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F7",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFE4E8",
    maxWidth: "100%",
  },
  chipText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: "#4A3E3D",
    marginLeft: 3.5,
  },

  /* Card Divider */
  cardDivider: {
    height: 1,
    backgroundColor: "#F3EEEA",
    marginVertical: 12,
  },

  /* Actions Grid */
  actionsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  unignoreBtn: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  unignoreBtnText: {
    color: "#1E293B",
    fontFamily: FONTS.semiBold,
    fontSize: 12.5,
  },
  viewProfileBtn: {
    backgroundColor: "#FAF5F2",
    borderWidth: 1,
    borderColor: "#EADFD8",
  },
  viewProfileText: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
    fontSize: 12.5,
  },

  /* Empty State */
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 19,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  exploreBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: FONTS.bold,
  },

  /* Pagination Card */
  paginationCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 6,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#F1E8E2",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  paginationSummaryRow: {
    marginBottom: 10,
    alignItems: "center",
  },
  paginationSummaryText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
  },
  paginationBoldText: {
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  paginationControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: 4,
  },
  navPageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  navPageBtnDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
    opacity: 0.5,
  },
  navPageBtnText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginHorizontal: 3,
  },
  navPageBtnTextDisabled: {
    color: "#94A3B8",
  },
  pagePillsGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  pageNumberBtn: {
    minWidth: 30,
    height: 30,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 4,
  },
  pageNumberBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pageNumberBtnLoading: {
    opacity: 0.6,
  },
  pageNumberText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: "#334155",
  },
  pageNumberTextActive: {
    color: "#fff",
  },
  ellipsisWrap: {
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  ellipsisText: {
    fontSize: 11,
    color: "#94A3B8",
    letterSpacing: 1,
  },
  pageLoadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F2",
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 10,
    gap: 8,
  },
  pageLoadingText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
});
