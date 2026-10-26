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
import AsyncStorage from "@react-native-async-storage/async-storage";
import ScreenHeader from "../components/ScreenHeader";
import { ListFeedSkeleton } from "../components/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import interestService from "../services/interestService";
import homeService from "../services/homeService";
import memberStateService from "../services/memberStateService";
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
 * Formats a raw created_at / date value into e.g. "12 Oct 2026" (UI only)
 */
function formatInterestDate(value) {
  if (!value) return "";
  try {
    const d = new Date(String(value).replace(" ", "T"));
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Small icon + text info row used inside the card (UI only)
 */
function InfoLine({ icon, text }) {
  if (!text) return null;
  return (
    <View style={styles.infoLine}>
      <View style={styles.infoLineIcon}>
        <Ionicons name={icon} size={12} color={COLORS.primary} />
      </View>
      <Text style={styles.infoLineText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/**
 * Normalizes an interest item (Sent or Received)
 */
function formatInterestItem(item, index) {
  if (!item) return null;
  let userObj = item.user;
  if (typeof userObj === "string") {
    try {
      userObj = JSON.parse(userObj);
    } catch {}
  }
  if (!userObj || typeof userObj !== "object") userObj = null;

  const expressInterestId =
    item.interest_id ||
    item.express_interest_id ||
    (userObj && item.id !== userObj.id ? item.id : null) ||
    item.id;

  const resolvedCode = memberStateService.resolveMemberCode(item);
  const codeStr =
    resolvedCode ||
    String(
      item.code ||
        userObj?.code ||
        item.member_code ||
        userObj?.member_code ||
        "",
    ).trim();
  const digitsFromCode = codeStr
    ? parseInt(codeStr.replace(/\D/g, ""), 10)
    : null;
  const validCodeId =
    Number.isFinite(digitsFromCode) && digitsFromCode > 0
      ? digitsFromCode
      : null;

  const targetUserId =
    userObj?.id ||
    item.user_id ||
    item.interested_by ||
    item.interested_to ||
    validCodeId ||
    item.id ||
    index + 1;

  const rawName =
    item.name ||
    userObj?.name ||
    `${item.first_name || userObj?.first_name || ""} ${item.last_name || userObj?.last_name || ""}`.trim();
  const name = rawName || `Member ${codeStr || targetUserId}`;

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
    photoStr && photoStr !== "null" && photoStr !== "undefined";
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

  // Normalize status string: "Accepted", "Rejected", "Pending"
  let statusStr = "Pending";
  const rawStatus = String(
    item.status ||
      item.interest_status ||
      item.approval_status ||
      item.status_text ||
      "",
  )
    .toLowerCase()
    .trim();

  // Check Rejection FIRST!
  if (
    rawStatus.includes("reject") ||
    rawStatus.includes("decline") ||
    rawStatus.includes("cancel") ||
    rawStatus === "2" ||
    item.status === 2 ||
    item.interest_status === 2 ||
    item.interest_status === "2" ||
    memberStateService.getInterestStatus(targetUserId) === "Rejected" ||
    memberStateService.getInterestStatus(codeStr) === "Rejected"
  ) {
    statusStr = "Rejected";
  } else if (
    rawStatus.includes("accept") ||
    rawStatus.includes("approv") || // matches "approved", "approve", "approval"
    rawStatus === "1" ||
    item.status === 1 ||
    item.status === true ||
    item.interest_status === 1 ||
    item.interest_status === "1" ||
    memberStateService.getInterestStatus(targetUserId) === "Accepted" ||
    memberStateService.getInterestStatus(codeStr) === "Accepted"
  ) {
    statusStr = "Accepted";
  }

  const finalMemberId =
    resolvedCode ||
    String(
      item.code ||
        userObj?.code ||
        item.member_code ||
        userObj?.member_code ||
        `HM-${targetUserId}`,
    );

  return {
    id: expressInterestId || item.id || targetUserId,
    interestId: expressInterestId || item.id || targetUserId,
    userId: targetUserId,
    name: name,
    memberId: finalMemberId,
    photo: finalPhoto,
    plan: memberStateService.resolvePlan(item),
    age: item.age || userObj?.age || item.birthday || "",
    height:
      item.height || userObj?.height
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
    status: statusStr,
    date: item.created_at || item.date || "",
    raw: item,
  };
}

export default function MyInterestScreen() {
  const { user, token } = useAuth();
  const navigation = useNavigation();
  const flatListRef = useRef(null);

  // Active Tab: "received" (Requests from others) | "sent" (Expressed by me)
  const [activeTab, setActiveTab] = useState("received");

  // Interests state
  const [receivedInterests, setReceivedInterests] = useState([]);
  const [sentInterests, setSentInterests] = useState([]);

  // Loading states
  const [loading, setLoading] = useState(() => Boolean(token));
  const [pageLoading, setPageLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionInProgress, setActionInProgress] = useState({});

  // Pagination for active tab
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(10);

  // Dashboard Package & Interest Limit Info
  const [dashboardData, setDashboardData] = useState(null);

  // Fetch member dashboard info to know remaining interests & package status
  const fetchDashboardStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await homeService.getDashboardData(token);
      if (res && res.result !== false && res.data) {
        setDashboardData(res.data);
      }
    } catch {
      // Silently ignore dashboard network glitch
    }
  }, [token]);

  // Fetch paginated list for given tab
  const fetchInterests = useCallback(
    async (tab = activeTab, page = 1, isSilent = false) => {
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
        let res;
        if (tab === "received") {
          res = await interestService.getReceivedInterests(page, token);
        } else {
          res = await interestService.getSentInterests(page, token);
        }

        if (res && res.result !== false && res.data) {
          const rawList = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
              ? res.data.data
              : [];
          memberStateService.syncInterestItems(rawList);
          let formatted = rawList.map(formatInterestItem).filter(Boolean);

          if (tab === "received") {
            setReceivedInterests(formatted);
          } else {
            // Filter out any locally withdrawn / removed sent interests
            if (user?.id) {
              const wKey = `@hm_withdrawn_sent_interests_${user.id}`;
              try {
                const rawW = await AsyncStorage.getItem(wKey);
                if (rawW) {
                  const wMap = JSON.parse(rawW) || {};
                  formatted = formatted.filter(
                    (m) =>
                      !wMap[String(m.userId)] &&
                      !wMap[String(m.interestId)] &&
                      !wMap[String(m.id)],
                  );
                }
              } catch {}
            }
            setSentInterests(formatted);
          }

          // Parse meta
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
          if (tab === "received") setReceivedInterests([]);
          else setSentInterests([]);
          setTotalItems(0);
          setTotalPages(1);
        }
      } catch (err) {
        console.log(`Fetch ${tab} interests error:`, err?.message);
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    },
    [token, activeTab, user],
  );

  // Initial load: Fetch dashboard stats & active tab interests
  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    (async () => {
      await memberStateService.init(token);
      if (isMounted) {
        fetchDashboardStats();
        await fetchInterests(activeTab, 1, false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token, activeTab, fetchInterests, fetchDashboardStats]);

  // Tab switch handler
  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
    setSearchQuery("");
    setCurrentPage(1);
    fetchInterests(newTab, 1, false);
  };

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await Promise.allSettled([
        fetchDashboardStats(),
        fetchInterests(activeTab, 1, true),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [token, activeTab, fetchInterests, fetchDashboardStats]);

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
    await fetchInterests(activeTab, newPage, true);
  };

  // Cross-screen sync (when interest is sent or accepted/rejected elsewhere)
  useEffect(() => {
    return subscribeMemberAction(({ type }) => {
      if (type === "interest" || type === "interest_status") {
        fetchInterests(activeTab, currentPage, true);
        fetchDashboardStats();
      }
    });
  }, [fetchInterests, fetchDashboardStats, activeTab, currentPage]);

  // Handle Accept Received Interest
  const handleAcceptInterest = async (item) => {
    const interestId = item.interestId || item.id;
    setActionInProgress((prev) => ({ ...prev, [interestId]: "accept" }));
    try {
      const res = await interestService.acceptInterest(
        {
          interest_id: item.interestId,
          id: item.id,
          user_id: item.userId,
        },
        token,
      );

      // Optimistically update status to Accepted
      setReceivedInterests((prev) =>
        prev.map((m) =>
          m.interestId === interestId ||
          m.id === interestId ||
          String(m.userId) === String(item.userId)
            ? { ...m, status: "Accepted" }
            : m,
        ),
      );

      memberStateService.setInterestStatus(item.userId, "Accepted");
      memberStateService.setInterestSent(item.userId, true);
      emitMemberAction({
        userId: item.userId,
        type: "interest_status",
        status: "Accepted",
      });
      emitMemberAction({ userId: item.userId, type: "interest", value: true });

      Alert.alert(
        "Interest Accepted! 💖",
        res?.message ||
          `You have accepted interest from ${item.name}. You can now view their full contact and profile details.`,
        [
          { text: "OK" },
          {
            text: "View Profile",
            onPress: () => handleViewProfile(item),
          },
        ],
      );
    } catch (err) {
      Alert.alert("Notice", err.message || "Failed to accept interest.");
    } finally {
      setActionInProgress((prev) => ({ ...prev, [interestId]: null }));
    }
  };

  // Handle Reject Received Interest or Revoking Accepted Interest
  const handleRejectInterest = (item, isRevokingAccepted = false) => {
    const interestId = item.interestId || item.id;
    Alert.alert(
      isRevokingAccepted ? "Cancel & Decline Interest" : "Decline Interest",
      isRevokingAccepted
        ? `Are you sure you want to cancel acceptance and decline interest from ${item.name}?`
        : `Are you sure you want to decline interest from ${item.name}?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: isRevokingAccepted ? "Decline / Cancel" : "Decline",
          style: "destructive",
          onPress: async () => {
            setActionInProgress((prev) => ({
              ...prev,
              [interestId]: "reject",
            }));
            try {
              const res = await interestService.rejectInterest(
                {
                  interest_id: item.interestId,
                  id: item.id,
                  user_id: item.userId,
                },
                token,
              );

              // Optimistically update status to Rejected
              setReceivedInterests((prev) =>
                prev.map((m) =>
                  m.interestId === interestId ||
                  m.id === interestId ||
                  String(m.userId) === String(item.userId)
                    ? { ...m, status: "Rejected" }
                    : m,
                ),
              );

              memberStateService.setInterestStatus(item.userId, "Rejected");
              memberStateService.setInterestSent(item.userId, false);
              emitMemberAction({
                userId: item.userId,
                type: "interest_status",
                status: "Rejected",
              });
              emitMemberAction({
                userId: item.userId,
                type: "interest",
                value: false,
              });

              if (user?.id) {
                const sKey = `@hm_sent_interests_${user.id}`;
                try {
                  const rawS = await AsyncStorage.getItem(sKey);
                  if (rawS) {
                    const sMap = JSON.parse(rawS) || {};
                    delete sMap[String(item.userId)];
                    delete sMap[String(item.id)];
                    await AsyncStorage.setItem(sKey, JSON.stringify(sMap));
                  }
                } catch {}
              }

              Alert.alert(
                "Interest Declined",
                res?.message || `You have declined interest from ${item.name}.`,
              );
            } catch (err) {
              Alert.alert(
                "Notice",
                err.message || "Failed to reject interest.",
              );
            } finally {
              setActionInProgress((prev) => ({ ...prev, [interestId]: null }));
            }
          },
        },
      ],
    );
  };

  // Remove declined / rejected received interest
  const handleRemoveReceivedInterest = (item) => {
    const interestId = item.interestId || item.id;
    setReceivedInterests((prev) =>
      prev.filter(
        (m) =>
          m.interestId !== interestId &&
          m.id !== interestId &&
          String(m.userId) !== String(item.userId),
      ),
    );
    setTotalItems((prev) => Math.max(0, prev - 1));
  };

  // Handle Cancel / Remove Sent Interest
  const handleRemoveSentInterest = (item) => {
    const interestId = item.interestId || item.id;
    Alert.alert(
      "Remove Interest",
      `Are you sure you want to withdraw/remove your interest sent to ${item.name}?`,
      [
        { text: "Keep Interest", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setActionInProgress((prev) => ({
              ...prev,
              [interestId]: "delete",
            }));
            try {
              try {
                await interestService.rejectInterest(
                  {
                    interest_id: item.interestId,
                    id: item.id,
                    user_id: item.userId,
                  },
                  token,
                );
              } catch (e) {
                console.log("Remove interest API note:", e?.message);
              }

              // Optimistically remove from sent list
              setSentInterests((prev) =>
                prev.filter(
                  (m) =>
                    m.interestId !== interestId &&
                    m.id !== interestId &&
                    String(m.userId) !== String(item.userId),
                ),
              );
              setTotalItems((prev) => Math.max(0, prev - 1));

              // Clean up and mark as withdrawn in AsyncStorage so it won't reappear on refresh
              if (user?.id) {
                const wKey = `@hm_withdrawn_sent_interests_${user.id}`;
                const sKey = `@hm_sent_interests_${user.id}`;
                try {
                  const rawW = await AsyncStorage.getItem(wKey);
                  const wMap = rawW ? JSON.parse(rawW) || {} : {};
                  wMap[String(item.userId)] = true;
                  wMap[String(item.interestId)] = true;
                  wMap[String(item.id)] = true;
                  await AsyncStorage.setItem(wKey, JSON.stringify(wMap));

                  const rawS = await AsyncStorage.getItem(sKey);
                  if (rawS) {
                    const sMap = JSON.parse(rawS) || {};
                    delete sMap[String(item.userId)];
                    delete sMap[String(item.id)];
                    await AsyncStorage.setItem(sKey, JSON.stringify(sMap));
                  }
                } catch {}
              }

              // Broadcast update to ActiveMembers, Shortlist, MemberProfile
              memberStateService.setInterestStatus(item.userId, null);
              memberStateService.setInterestSent(item.userId, false);
              emitMemberAction({
                userId: item.userId,
                type: "interest",
                value: false,
              });

              Alert.alert(
                "Interest Removed",
                `Your interest in ${item.name} has been successfully removed.`,
              );
            } catch (err) {
              Alert.alert(
                "Notice",
                err.message || "Failed to remove interest.",
              );
            } finally {
              setActionInProgress((prev) => ({ ...prev, [interestId]: null }));
            }
          },
        },
      ],
    );
  };

  // Open Full Member Profile
  const handleViewProfile = (item) => {
    navigation.navigate("MemberProfile", {
      userId: item.userId,
      interestStatus: item.status,
      member: {
        id: item.userId,
        name: item.name,
        memberId: item.memberId,
        photo: item.photo,
        age: item.age,
        plan: item.plan,
        status: item.status,
        interestStatus: item.status,
        interestSent: activeTab === "sent" || item.status === "Accepted",
        summary: {
          height: item.height,
          religion: item.religion,
          caste: item.caste,
          marital: item.maritalStatus,
          country: item.location,
          motherTongue: item.motherTongue || "",
        },
      },
    });
  };

  // Filtered list based on active tab & live search query
  const currentList =
    activeTab === "received" ? receivedInterests : sentInterests;

  const filteredInterests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return currentList;

    return currentList.filter((m) => {
      const name = String(m.name || "").toLowerCase();
      const code = String(m.memberId || "").toLowerCase();
      const rawId = String(m.id || "").toLowerCase();
      const religion = String(m.religion || "").toLowerCase();
      const caste = String(m.caste || "").toLowerCase();
      const loc = String(m.location || "").toLowerCase();
      const profession = String(m.profession || "").toLowerCase();
      const status = String(m.status || "").toLowerCase();

      return (
        name.includes(q) ||
        code.includes(q) ||
        rawId.includes(q) ||
        religion.includes(q) ||
        caste.includes(q) ||
        loc.includes(q) ||
        profession.includes(q) ||
        status.includes(q)
      );
    });
  }, [currentList, searchQuery]);

  // Status counts for the summary tiles (UI only)
  const statusCounts = useMemo(() => {
    let pending = 0;
    let accepted = 0;
    let declined = 0;
    currentList.forEach((m) => {
      if (m.status === "Accepted") accepted += 1;
      else if (m.status === "Rejected") declined += 1;
      else pending += 1;
    });
    return { pending, accepted, declined };
  }, [currentList]);

  // Derived user package & remaining interests status
  const packageInfo = dashboardData?.current_package_info;
  const isPremiumUser =
    user?.membership >= 2 ||
    /premium|gold|silver|platinum|vip|diamond|pro/i.test(
      packageInfo?.package_name || "",
    );
  const remainingInterestsCount =
    dashboardData?.remaining_interest !== undefined
      ? Number(dashboardData.remaining_interest)
      : null;

  // Render individual interest card
  const renderItem = ({ item }) => {
    const busy = actionInProgress[item.interestId || item.id];
    const isPending = item.status === "Pending";
    const isAccepted = item.status === "Accepted";
    const isRejected = item.status === "Rejected";

    const accentColor = isAccepted
      ? "#10B981"
      : isRejected
        ? "#EF4444"
        : "#F59E0B";
    const dateLabel = formatInterestDate(item.date);
    const viewLabel =
      activeTab === "received" && isPending ? "Profile" : "View Profile";
    const religionLine = item.religion
      ? `${item.religion}${item.caste ? ` • ${item.caste}` : ""}`
      : "";

    return (
      <View style={[styles.card, { borderLeftColor: accentColor }]}>
        {/* Card header: direction + date, and status pill */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons
              name={
                activeTab === "received"
                  ? "arrow-down-circle-outline"
                  : "arrow-up-circle-outline"
              }
              size={14}
              color={COLORS.textLight}
              style={{ marginRight: 5 }}
            />
            <Text style={styles.cardHeaderText} numberOfLines={1}>
              {activeTab === "received" ? "Received" : "Sent"}
              {dateLabel ? ` · ${dateLabel}` : ""}
            </Text>
          </View>

          {/* Status Pill */}
          <View
            style={[
              styles.statusPill,
              isAccepted
                ? styles.statusPillAccepted
                : isRejected
                  ? styles.statusPillRejected
                  : styles.statusPillPending,
            ]}
          >
            <Ionicons
              name={
                isAccepted
                  ? "checkmark-circle"
                  : isRejected
                    ? "close-circle"
                    : "time"
              }
              size={12}
              color={
                isAccepted ? "#15803D" : isRejected ? "#B91C1C" : "#B45309"
              }
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.statusPillText,
                isAccepted
                  ? styles.statusTextAccepted
                  : isRejected
                    ? styles.statusTextRejected
                    : styles.statusTextPending,
              ]}
            >
              {isAccepted
                ? "Accepted"
                : isRejected
                  ? "Declined"
                  : activeTab === "received"
                    ? "New Request"
                    : "Pending"}
            </Text>
          </View>
        </View>

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
                style={{ marginRight: 3 }}
              />
              <Text style={styles.planBadgeText}>{item.plan}</Text>
            </View>
          </View>

          {/* Core Info Column */}
          <View style={styles.cardInfoCol}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
              {item.age ? (
                <Text style={styles.cardAge}>, {item.age} yrs</Text>
              ) : null}
            </Text>

            <View style={styles.idBadgeRow}>
              <Ionicons name="finger-print" size={10} color="#64748B" />
              <Text style={styles.idBadgeText}>{item.memberId}</Text>
            </View>

            {/* Compact quick facts */}
            {item.height || item.maritalStatus ? (
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
              </View>
            ) : null}

            {/* Detail lines */}
            <View style={styles.infoLines}>
              <InfoLine icon="flower-outline" text={religionLine} />
              <InfoLine icon="location-outline" text={item.location} />
              <InfoLine icon="briefcase-outline" text={item.profession} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Status note */}
        {isAccepted ? (
          <View style={[styles.noteBox, styles.noteBoxAccepted]}>
            <Ionicons
              name="lock-open-outline"
              size={14}
              color="#15803D"
              style={{ marginRight: 7 }}
            />
            <Text style={[styles.noteText, { color: "#166534" }]}>
              {activeTab === "received"
                ? "You accepted this request. Full contact details are unlocked."
                : "Great news! They accepted your interest. Contact details are unlocked."}
            </Text>
          </View>
        ) : null}
        {isRejected ? (
          <View style={[styles.noteBox, styles.noteBoxRejected]}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color="#B91C1C"
              style={{ marginRight: 7 }}
            />
            <Text style={[styles.noteText, { color: "#991B1B" }]}>
              {activeTab === "received"
                ? "You declined this request."
                : "This interest was declined."}
            </Text>
          </View>
        ) : null}

        {/* Action Buttons Row */}
        <View style={styles.actionsGrid}>
          {activeTab === "received" ? (
            <>
              {/* If Pending: show Accept + Decline */}
              {isPending ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.acceptBtn]}
                    onPress={() => handleAcceptInterest(item)}
                    disabled={Boolean(busy)}
                    activeOpacity={0.8}
                  >
                    {busy === "accept" ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color="#fff"
                          style={{ marginRight: 5 }}
                        />
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleRejectInterest(item, false)}
                    disabled={Boolean(busy)}
                    activeOpacity={0.8}
                  >
                    {busy === "reject" ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <>
                        <Ionicons
                          name="close-circle-outline"
                          size={16}
                          color="#DC2626"
                          style={{ marginRight: 5 }}
                        />
                        <Text style={styles.rejectBtnText}>Decline</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : null}

              {/* If Accepted / Approved: DO NOT show Accept & Decline! Show Cancel / Decline button */}
              {isAccepted ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelAcceptedBtn]}
                  onPress={() => handleRejectInterest(item, true)}
                  disabled={Boolean(busy)}
                  activeOpacity={0.8}
                >
                  {busy === "reject" ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <>
                      <Ionicons
                        name="close-circle-outline"
                        size={15}
                        color="#DC2626"
                        style={{ marginRight: 5 }}
                      />
                      <Text style={styles.cancelAcceptedText}>
                        Cancel / Decline
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}

              {/* If Rejected: Show Remove button */}
              {isRejected ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.removeInterestBtn]}
                  onPress={() => handleRemoveReceivedInterest(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="trash-outline"
                    size={15}
                    color="#DC2626"
                    style={{ marginRight: 5 }}
                  />
                  <Text style={styles.removeInterestText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}

          {/* When on sent tab, show Remove / Cancel Interest option */}
          {activeTab === "sent" ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.removeInterestBtn]}
              onPress={() => handleRemoveSentInterest(item)}
              disabled={Boolean(busy)}
              activeOpacity={0.8}
            >
              {busy === "delete" ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <>
                  <Ionicons
                    name="trash-outline"
                    size={15}
                    color="#DC2626"
                    style={{ marginRight: 5 }}
                  />
                  <Text style={styles.removeInterestText}>Remove</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {/* View Profile Button */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.viewProfileBtn]}
            onPress={() => handleViewProfile(item)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-outline"
              size={15}
              color={COLORS.primary}
              style={{ marginRight: 5 }}
            />
            <Text style={styles.viewProfileText} numberOfLines={1}>
              {viewLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      {/* ---------- STICKY APP HEADER ---------- */}
      <ScreenHeader
        title="Interests"
        subtitle="Manage member interests and connection requests"
        badge={`${totalItems || currentList.length} ${activeTab === "received" ? "Received" : "Sent"}`}
        badgeIcon="heart"
        badgeColor={COLORS.primary}
        badgeBgColor="#FFF0F5"
        rightElement={
          <TouchableOpacity
            style={[
              styles.packageShortcutPill,
              isPremiumUser
                ? styles.packageShortcutPremium
                : styles.packageShortcutFree,
            ]}
            onPress={() => navigation.navigate("Packages")}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isPremiumUser ? "diamond" : "flash-outline"}
              size={13}
              color={isPremiumUser ? "#7C3AED" : COLORS.primary}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.packageShortcutText,
                isPremiumUser
                  ? styles.packageTextPremium
                  : styles.packageTextFree,
              ]}
            >
              {remainingInterestsCount !== null
                ? `${remainingInterestsCount} Left`
                : isPremiumUser
                  ? "Premium"
                  : "Upgrade 💎"}
            </Text>
          </TouchableOpacity>
        }
      >
        {/* Tab Segment Controls: Received vs Sent */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === "received" && styles.segmentBtnActive,
            ]}
            onPress={() => handleTabChange("received")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="mail-unread-outline"
              size={16}
              color={activeTab === "received" ? "#fff" : COLORS.textLight}
              style={{ marginRight: 7 }}
            />
            <Text
              style={[
                styles.segmentText,
                activeTab === "received" && styles.segmentTextActive,
              ]}
            >
              Received
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === "sent" && styles.segmentBtnActive,
            ]}
            onPress={() => handleTabChange("sent")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="paper-plane-outline"
              size={16}
              color={activeTab === "sent" ? "#fff" : COLORS.textLight}
              style={{ marginRight: 7 }}
            />
            <Text
              style={[
                styles.segmentText,
                activeTab === "sent" && styles.segmentTextActive,
              ]}
            >
              Sent
            </Text>
          </TouchableOpacity>
        </View>

        {/* Instant Search Bar */}
        {(totalItems > 0 ||
          currentList.length > 0 ||
          searchQuery.length > 0) && (
          <View style={styles.searchBarContainer}>
            <Ionicons
              name="search"
              size={18}
              color={COLORS.textLight}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${activeTab === "received" ? "received requests" : "sent interests"} by name, ID, city...`}
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
                  size={18}
                  color={COLORS.textLight}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScreenHeader>

      {/* Package Limit / Upgrade Notice Banner for Free or Low Balance */}
      {(!isPremiumUser ||
        (remainingInterestsCount !== null && remainingInterestsCount <= 2)) && (
        <TouchableOpacity
          style={styles.upgradeNoticeBanner}
          onPress={() => navigation.navigate("Packages")}
          activeOpacity={0.9}
        >
          <View style={styles.upgradeNoticeLeft}>
            <View style={styles.upgradeNoticeIconWrap}>
              <Ionicons name="diamond" size={17} color="#FBBF24" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.upgradeNoticeTitle} numberOfLines={1}>
                {!isPremiumUser
                  ? "Express Interests with Premium"
                  : `Only ${remainingInterestsCount} Interests Remaining`}
              </Text>
              <Text style={styles.upgradeNoticeSubtitle} numberOfLines={2}>
                {!isPremiumUser
                  ? "Upgrade your package to send direct interests & view contacts."
                  : "Renew your package to keep expressing interest to matches."}
              </Text>
            </View>
          </View>
          <View style={styles.upgradeNoticeBtn}>
            <Text style={styles.upgradeNoticeBtnText}>Upgrade</Text>
            <Ionicons name="chevron-forward" size={12} color="#2B2D42" />
          </View>
        </TouchableOpacity>
      )}

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
        <ListFeedSkeleton count={4} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredInterests}
          keyExtractor={(item, index) =>
            String(
              item?.interestId ||
                item?.userId ||
                item?.id ||
                `interest_${index}`,
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
            filteredInterests.length > 0 ? (
              <View>
                {/* Status summary tiles */}
                {!searchQuery.trim() ? (
                  <View style={styles.statsRow}>
                    <View style={styles.statTile}>
                      <View
                        style={[
                          styles.statIcon,
                          { backgroundColor: "#FEF3C7" },
                        ]}
                      >
                        <Ionicons name="time" size={15} color="#B45309" />
                      </View>
                      <Text style={styles.statNumber}>
                        {statusCounts.pending}
                      </Text>
                      <Text style={styles.statLabel}>
                        {activeTab === "received" ? "New" : "Pending"}
                      </Text>
                    </View>
                    <View style={styles.statTile}>
                      <View
                        style={[
                          styles.statIcon,
                          { backgroundColor: "#DCFCE7" },
                        ]}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={15}
                          color="#15803D"
                        />
                      </View>
                      <Text style={styles.statNumber}>
                        {statusCounts.accepted}
                      </Text>
                      <Text style={styles.statLabel}>Accepted</Text>
                    </View>
                    <View style={styles.statTile}>
                      <View
                        style={[
                          styles.statIcon,
                          { backgroundColor: "#FEE2E2" },
                        ]}
                      >
                        <Ionicons
                          name="close-circle"
                          size={15}
                          color="#B91C1C"
                        />
                      </View>
                      <Text style={styles.statNumber}>
                        {statusCounts.declined}
                      </Text>
                      <Text style={styles.statLabel}>Declined</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.resultsSummaryRow}>
                  <Text style={styles.resultsSummaryText}>
                    Showing{" "}
                    <Text style={styles.resultsSummaryBold}>
                      {filteredInterests.length}
                    </Text>{" "}
                    of {totalItems || currentList.length}{" "}
                    {activeTab === "received"
                      ? "received requests"
                      : "sent interests"}
                  </Text>
                  {searchQuery.trim() ? (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Text style={styles.clearSearchLink}>Clear Search</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null
          }
          ListFooterComponent={
            !loading && filteredInterests.length > 0 && !searchQuery.trim() ? (
              <View style={styles.paginationCard}>
                <View style={styles.paginationSummaryRow}>
                  <Text style={styles.paginationSummaryText}>
                    Showing{" "}
                    <Text style={styles.paginationBoldText}>
                      {totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1}-
                      {Math.min(currentPage * perPage, totalItems)}
                    </Text>{" "}
                    of{" "}
                    <Text style={styles.paginationBoldText}>{totalItems}</Text>{" "}
                    {activeTab === "received"
                      ? "received requests"
                      : "sent interests"}
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
                <View
                  style={[styles.emptyIconCircle, styles.emptyCircleReceived]}
                >
                  <Ionicons
                    name="search-outline"
                    size={42}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.emptyTitle}>No Matching Interests</Text>
                <Text style={styles.emptySubtitle}>
                  We could not find any interest matching &ldquo;{searchQuery}
                  &rdquo;.
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
                <View
                  style={[
                    styles.emptyIconCircle,
                    activeTab === "received"
                      ? styles.emptyCircleReceived
                      : styles.emptyCircleSent,
                  ]}
                >
                  <Ionicons
                    name={
                      activeTab === "received"
                        ? "heart-dislike-outline"
                        : "paper-plane-outline"
                    }
                    size={44}
                    color={
                      activeTab === "received" ? COLORS.primary : "#7C3AED"
                    }
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {activeTab === "received"
                    ? "No Received Requests Yet"
                    : "No Expressed Interests Yet"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {activeTab === "received"
                    ? "When other members like your profile and express interest, their requests will appear here for you to accept or decline."
                    : "Explore Active Members and tap 'Send Interest' to express your interest to potential life partners."}
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

  /* Package Shortcut Pill */
  packageShortcutPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  packageShortcutPremium: {
    backgroundColor: "#F5F3FF",
    borderColor: "#DDD6FE",
  },
  packageShortcutFree: {
    backgroundColor: "#FFF5F7",
    borderColor: "#FFE4E8",
  },
  packageShortcutText: {
    fontSize: 11.5,
    fontFamily: FONTS.bold,
  },
  packageTextPremium: {
    color: "#7C3AED",
  },
  packageTextFree: {
    color: COLORS.primary,
  },

  /* Segmented Tab Control */
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#F3ECE8",
    borderRadius: 14,
    padding: 4,
    marginTop: 12,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  segmentText: {
    fontSize: 13.5,
    fontFamily: FONTS.semiBold,
    color: COLORS.textLight,
  },
  segmentTextActive: {
    color: "#fff",
    fontFamily: FONTS.bold,
  },

  /* Search Bar */
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EAE0DA",
    paddingHorizontal: 13,
    height: 46,
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 9,
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

  /* Upgrade Notice Banner */
  upgradeNoticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2B2D42",
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 2,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: "#2B2D42",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 9,
    elevation: 4,
  },
  upgradeNoticeLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  upgradeNoticeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(251,191,36,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  upgradeNoticeTitle: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: "#fff",
  },
  upgradeNoticeSubtitle: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: "#CBD5E1",
    marginTop: 2,
    lineHeight: 15,
  },
  upgradeNoticeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBBF24",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 3,
  },
  upgradeNoticeBtnText: {
    fontSize: 11.5,
    fontFamily: FONTS.bold,
    color: "#2B2D42",
  },

  /* Content Feed */
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  /* Summary tiles */
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statTile: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 11,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EFE8E3",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    lineHeight: 21,
  },
  statLabel: {
    fontSize: 10.5,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    marginTop: 1,
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
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EFE8E3",
    borderLeftWidth: 4,
    shadowColor: "#2B1B14",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 11,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3EEEA",
    gap: 8,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  cardHeaderText: {
    fontSize: 11.5,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    flexShrink: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  /* Portrait Photo */
  photoContainer: {
    position: "relative",
    width: 92,
    height: 120,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FCE7F3",
  },
  cardPhoto: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  planBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  planPremium: {
    backgroundColor: "rgba(225,29,72,0.92)",
  },
  planFree: {
    backgroundColor: "rgba(71,85,105,0.92)",
  },
  planBadgeText: {
    color: "#fff",
    fontSize: 8.5,
    fontFamily: FONTS.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* Info Column */
  cardInfoCol: {
    flex: 1,
    marginLeft: 14,
  },
  cardName: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  cardAge: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textLight,
  },
  idBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    marginTop: 4,
    gap: 3,
  },
  idBadgeText: {
    fontSize: 10.5,
    fontFamily: FONTS.semiBold,
    color: "#475569",
  },

  /* Quick fact chips */
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 9,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F7",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#FFE4E8",
    maxWidth: "100%",
  },
  chipText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: "#4A3E3D",
    marginLeft: 4,
  },

  /* Detail lines */
  infoLines: {
    marginTop: 8,
    gap: 5,
  },
  infoLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoLineIcon: {
    width: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: "#FFF5F7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
  },
  infoLineText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#4A3E3D",
  },

  /* Status Pill */
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusPillAccepted: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
  },
  statusPillRejected: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
  },
  statusPillPending: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  statusPillText: {
    fontSize: 10.5,
    fontFamily: FONTS.bold,
  },
  statusTextAccepted: {
    color: "#15803D",
  },
  statusTextRejected: {
    color: "#B91C1C",
  },
  statusTextPending: {
    color: "#92400E",
  },

  /* Status note */
  noteBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginTop: 12,
  },
  noteBoxAccepted: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  noteBoxRejected: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  noteText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: FONTS.medium,
    lineHeight: 16,
  },

  /* Actions Grid */
  actionsGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  acceptBtn: {
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  acceptBtnText: {
    color: "#fff",
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  rejectBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  rejectBtnText: {
    color: "#DC2626",
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  cancelAcceptedBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  cancelAcceptedText: {
    color: "#DC2626",
    fontFamily: FONTS.semiBold,
    fontSize: 12.5,
  },
  viewProfileBtn: {
    backgroundColor: "#FFF5F7",
    borderWidth: 1,
    borderColor: "#FFD9E0",
  },
  viewProfileText: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  removeInterestBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  removeInterestText: {
    color: "#DC2626",
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },

  /* Empty State */
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyCircleReceived: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FFE4E8",
    shadowColor: COLORS.primary,
  },
  emptyCircleSent: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    shadowColor: "#7C3AED",
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
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 15,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
  },
  exploreBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: FONTS.bold,
  },

  /* Pagination Card */
  paginationCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#F1E8E2",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
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
    height: 34,
    borderRadius: 10,
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
    minWidth: 32,
    height: 32,
    borderRadius: 10,
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
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
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
    borderRadius: 12,
    gap: 8,
  },
  pageLoadingText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
});
