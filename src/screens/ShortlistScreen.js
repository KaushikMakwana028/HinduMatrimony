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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import { ListFeedSkeleton } from "../components/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import activeMemberService from "../services/activeMemberService";
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
 * Normalizes shortlist member item
 */
function formatShortlistMember(item, index) {
  if (!item) return null;
  const id = item.user_id || item.id || item.member_id || index + 1;
  const rawName = item.name
    ? String(item.name).trim()
    : `${item.first_name || ""} ${item.last_name || ""}`.trim();
  const name = rawName || `Member ${item.code || item.member_code || id}`;
  const rawPhoto =
    item.photo ||
    item.avatar ||
    item.avatar_original ||
    item.profile_image ||
    "";
  const photoStr = String(rawPhoto).trim();
  const isValidPhoto =
    photoStr && photoStr !== "null" && photoStr !== "undefined";
  const finalPhoto = isValidPhoto ? photoStr : DEFAULT_AVATAR;

  const loc =
    [item.city, item.state, item.country]
      .filter((v) => v && typeof v === "string" && v.trim())
      .join(", ") ||
    item.location ||
    item.country ||
    "";

  const resolvedCode = memberStateService.resolveMemberCode(item);
  const interestStatus = memberStateService.getInterestStatus(
    id || item.user_id || resolvedCode,
  );
  const rawStatus = String(item.interest_status || "").toLowerCase();
  const isRejected =
    rawStatus.includes("reject") ||
    rawStatus.includes("decline") ||
    interestStatus === "Rejected";
  const isAccepted = !isRejected && interestStatus === "Accepted";

  const hasExpressedInterest =
    !isRejected &&
    (isAccepted ||
      item.express_interest === true ||
      item.express_interest === 1 ||
      item.express_interest === "1" ||
      rawStatus.includes("sent") ||
      rawStatus.includes("pending") ||
      memberStateService.isInterestSent(id || item.user_id || resolvedCode));

  return {
    id: id,
    userId: item.user_id || id,
    name: name,
    memberId:
      resolvedCode ||
      String(item.code || item.member_code || item.member_id || `HM-${id}`),
    photo: finalPhoto,
    plan: memberStateService.resolvePlan(item),
    isAccepted,
    age: item.age || item.birthday || "",
    height: item.height
      ? String(item.height).includes("ft")
        ? item.height
        : `${item.height} ft`
      : "",
    religion: item.religion || item.religion_name || "",
    caste: item.caste || item.caste_name || "",
    motherTongue: item.mothere_tongue || item.mother_tongue || "",
    location: loc,
    maritalStatus: item.marital_status || item.maritial_status || "",
    profession: item.profession || item.career || "",
    hasExpressedInterest,
    raw: item,
  };
}

export default function ShortlistScreen() {
  const { user, token } = useAuth();
  const navigation = useNavigation();
  const flatListRef = useRef(null);

  const [shortlistedMembers, setShortlistedMembers] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(token));
  const [pageLoading, setPageLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [interestSentMap, setInterestSentMap] = useState({});
  const [actionInProgress, setActionInProgress] = useState({});

  // Pagination state aligned with backend meta: current_page, last_page, per_page, total
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(10);

  const SENT_INTERESTS_KEY = useMemo(
    () => `@hm_sent_interests_${user?.id || "default"}`,
    [user?.id],
  );

  // Fetch live shortlisted profiles from server for a specific page
  const fetchShortlists = useCallback(
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
        const res = await activeMemberService.getMyShortlists(page, token);
        if (res && res.result !== false && res.data) {
          const rawList = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
              ? res.data.data
              : [];
          memberStateService.registerMembers(rawList);
          const formatted = rawList.map(formatShortlistMember).filter(Boolean);
          setShortlistedMembers(formatted);

          // Synchronize interest status from server items
          const itemInterests = {};
          rawList.forEach((it) => {
            const uid = String(it.user_id || it.id || it.member_id || "");
            if (
              uid &&
              (it.express_interest === true ||
                it.express_interest === 1 ||
                it.express_interest === "1" ||
                it.interest_status === "sent interest" ||
                it.interest_status === 1 ||
                it.interest_status === "1")
            ) {
              itemInterests[uid] = true;
            }
          });
          if (Object.keys(itemInterests).length > 0) {
            setInterestSentMap((prev) => ({ ...prev, ...itemInterests }));
          }

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
          setShortlistedMembers([]);
          setTotalItems(0);
          setTotalPages(1);
        }
      } catch {
        // Keep previous list on transient network error
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    },
    [token],
  );

  // Initial load: Fetch shortlists page 1 & load sent interests
  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    (async () => {
      // Load local stored sent interests
      try {
        const saved = await AsyncStorage.getItem(SENT_INTERESTS_KEY);
        if (saved && isMounted) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            setInterestSentMap((prev) => ({ ...parsed, ...prev }));
          }
        }
      } catch {}

      // Fetch live interests sent
      activeMemberService
        .getMyInterests(token)
        .then((res) => {
          if (isMounted && res && res.result !== false && res.data) {
            const list = Array.isArray(res.data)
              ? res.data
              : res.data?.data || [];
            memberStateService.syncInterestItems(list, { currentUserId: user?.id });
            const iMap = {};
            const currentUid = user?.id ? String(user.id) : null;
            list.forEach((item) => {
              let targetId = null;
              if (item.user?.id && String(item.user.id) !== currentUid) {
                targetId = item.user.id;
              } else if (item.interested_to && String(item.interested_to) !== currentUid) {
                targetId = item.interested_to;
              } else if (item.user_id && String(item.user_id) !== currentUid) {
                targetId = item.user_id;
              }
              const rawStatus = String(
                item.status || item.interest_status || "",
              ).toLowerCase();
              const isRejected =
                rawStatus.includes("reject") ||
                rawStatus.includes("decline") ||
                item.status === 2 ||
                item.interest_status === 2;
              if (targetId && !isRejected) {
                iMap[String(targetId)] = true;
              }
            });
            setInterestSentMap(iMap);
            AsyncStorage.setItem(
              SENT_INTERESTS_KEY,
              JSON.stringify(iMap),
            ).catch(() => {});
          }
        })
        .catch(() => {});

      // Fetch live shortlists page 1
      if (isMounted) {
        await fetchShortlists(1, false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token, user?.id, SENT_INTERESTS_KEY, fetchShortlists]);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await fetchShortlists(1, true);
    } finally {
      setRefreshing(false);
    }
  }, [token, fetchShortlists]);

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
    await fetchShortlists(newPage, true);
  };

  // Synchronize cross-screen actions (e.g. from ActiveMembersScreen or MemberProfileScreen)
  useEffect(() => {
    return subscribeMemberAction(({ userId, type, value }) => {
      const uid = String(userId);
      if (type === "shortlist") {
        if (!value) {
          setShortlistedMembers((prev) =>
            prev.filter(
              (m) => String(m.id) !== uid && String(m.userId) !== uid,
            ),
          );
          setTotalItems((prev) => Math.max(0, prev - 1));
        } else {
          // Re-fetch to pull the full item data
          fetchShortlists(currentPage, true);
        }
      } else if (type === "interest") {
        setInterestSentMap((prev) => {
          const next = { ...prev, [uid]: value };
          AsyncStorage.setItem(SENT_INTERESTS_KEY, JSON.stringify(next)).catch(
            () => {},
          );
          return next;
        });
      } else if (type === "interest_status") {
        setInterestSentMap((prev) => ({ ...prev }));
      }
    });
  }, [fetchShortlists, currentPage, SENT_INTERESTS_KEY]);

  // Handle Remove from Shortlist
  const handleRemove = (member) => {
    Alert.alert(
      "Remove Shortlist",
      `Are you sure you want to remove ${member.name} from your shortlisted profiles?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setActionInProgress((prev) => ({ ...prev, [member.id]: true }));
            try {
              await activeMemberService.removeFromShortlist(
                member.userId,
                token,
              );
              setShortlistedMembers((prev) =>
                prev.filter(
                  (m) =>
                    String(m.id) !== String(member.id) &&
                    String(m.userId) !== String(member.userId),
                ),
              );
              setTotalItems((prev) => Math.max(0, prev - 1));
              emitMemberAction({
                userId: member.userId,
                type: "shortlist",
                value: false,
              });
            } catch (err) {
              Alert.alert("Notice", err.message || "Failed to remove member");
            } finally {
              setActionInProgress((prev) => ({ ...prev, [member.id]: false }));
            }
          },
        },
      ],
    );
  };

  // Handle Express Interest directly from Shortlist card
  const handleSendInterest = async (member) => {
    const uid = String(member.userId || member.id);
    const isAccepted = memberStateService.isInterestAccepted(
      member.id || member.userId || member.memberId,
    );
    if (isAccepted) {
      Alert.alert(
        "Connection Accepted 💖",
        `You and ${member.name} are already connected! Would you like to view their full profile?`,
        [
          { text: "Close", style: "cancel" },
          {
            text: "View Profile",
            onPress: () => handleViewProfile(member),
          },
        ],
      );
      return;
    }

    const isSent = Boolean(
      interestSentMap[uid] ||
      interestSentMap[String(member.id)] ||
      member.hasExpressedInterest,
    );
    if (isSent) {
      Alert.alert(
        "Withdraw Interest",
        `You have expressed interest in ${member.name}. Would you like to remove/withdraw this interest?`,
        [
          { text: "Keep Interest", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setInterestSentMap((prev) => {
                const next = { ...prev };
                delete next[uid];
                delete next[String(member.id)];
                AsyncStorage.setItem(
                  SENT_INTERESTS_KEY,
                  JSON.stringify(next),
                ).catch(() => {});
                return next;
              });
              memberStateService.setInterestStatus(member.userId, null);
              memberStateService.setInterestSent(member.userId, false);
              emitMemberAction({
                userId: member.userId,
                type: "interest",
                value: false,
              });
              Alert.alert(
                "Interest Removed",
                `Your interest in ${member.name} has been removed.`,
              );
            },
          },
        ],
      );
      return;
    }

    setActionInProgress((prev) => ({ ...prev, [member.id]: true }));
    try {
      const response = await activeMemberService.expressInterest(
        member.userId,
        token,
      );
      setInterestSentMap((prev) => {
        const next = {
          ...prev,
          [uid]: true,
          [String(member.id)]: true,
        };
        AsyncStorage.setItem(SENT_INTERESTS_KEY, JSON.stringify(next)).catch(
          () => {},
        );
        return next;
      });
      memberStateService.setInterestSent(member.userId, true);
      emitMemberAction({
        userId: member.userId,
        type: "interest",
        value: true,
      });
      Alert.alert(
        "Interest Expressed! 💖",
        response?.message || `Your interest has been sent to ${member.name}.`,
      );
    } catch (err) {
      if (
        err?.isUpgradeRequired ||
        /package|upgrade|premium|limit|free|exhaust/i.test(err?.message || "")
      ) {
        Alert.alert(
          "Premium Package Required 💎",
          err.message ||
            "Free members cannot express interest or your package interest limit has been reached. Please upgrade to a Premium package to send interests.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "View Packages 💎",
              onPress: () => navigation.navigate("Packages"),
            },
          ],
        );
      } else {
        Alert.alert(
          "Notice",
          err.message || "Could not express interest at this moment.",
        );
      }
    } finally {
      setActionInProgress((prev) => ({ ...prev, [member.id]: false }));
    }
  };

  // Open Full Member Profile
  const handleViewProfile = (member) => {
    const interestStatus = memberStateService.getInterestStatus(
      member.id || member.userId || member.memberId,
    );
    const isAccepted = interestStatus === "Accepted";
    const isRejected = interestStatus === "Rejected";
    const isSent =
      !isRejected &&
      (isAccepted ||
        Boolean(
          interestSentMap[String(member.id)] ||
          interestSentMap[String(member.userId)] ||
          member.hasExpressedInterest,
        ));

    navigation.navigate("MemberProfile", {
      userId: member.userId,
      interestStatus: isAccepted
        ? "Accepted"
        : isRejected
          ? "Rejected"
          : isSent
            ? "Pending"
            : null,
      member: {
        id: member.userId,
        name: member.name,
        memberId: member.memberId,
        photo: member.photo,
        age: member.age,
        plan: member.plan,
        interestSent: isSent,
        interestStatus: isAccepted
          ? "Accepted"
          : isRejected
            ? "Rejected"
            : isSent
              ? "Pending"
              : null,
        shortlisted: true,
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

  // Filtered shortlists by live search query
  const filteredShortlists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return shortlistedMembers;

    return shortlistedMembers.filter((m) => {
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
  }, [shortlistedMembers, searchQuery]);

  // Interest summary for the tiles (UI only, mirrors the card status logic)
  const interestSummary = useMemo(() => {
    let sent = 0;
    let accepted = 0;
    shortlistedMembers.forEach((m) => {
      const st = memberStateService.getInterestStatus(
        m.id || m.userId || m.memberId,
      );
      const acc = st === "Accepted";
      const rej = st === "Rejected";
      const snt =
        !rej &&
        (acc ||
          Boolean(
            interestSentMap[String(m.id)] ||
            interestSentMap[String(m.userId)] ||
            m.hasExpressedInterest,
          ));
      if (acc) accepted += 1;
      else if (snt) sent += 1;
    });
    return { sent, accepted };
  }, [shortlistedMembers, interestSentMap]);

  // Render individual shortlisted member card
  const renderItem = ({ item }) => {
    const interestStatus = memberStateService.getInterestStatus(
      item.id || item.userId || item.memberId,
    );
    const isAccepted = interestStatus === "Accepted";
    const isRejected = interestStatus === "Rejected";
    const isSent =
      !isRejected &&
      (isAccepted ||
        Boolean(
          interestSentMap[String(item.id)] ||
          interestSentMap[String(item.userId)] ||
          item.hasExpressedInterest,
        ));
    const busy = Boolean(actionInProgress[item.id]);

    const accentColor = isAccepted ? "#10B981" : isSent ? "#34D399" : "#F59E0B";
    const religionLine = item.religion
      ? `${item.religion}${item.caste ? ` • ${item.caste}` : ""}`
      : "";

    return (
      <View style={[styles.card, { borderLeftColor: accentColor }]}>
        {/* Card header: saved tag, interest state and remove button */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.savedTag}>
              <Ionicons
                name="star"
                size={11}
                color="#D97706"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.savedTagText}>Shortlisted</Text>
            </View>
            {isAccepted ? (
              <View style={[styles.stateTag, styles.stateTagAccepted]}>
                <Ionicons
                  name="checkmark-done"
                  size={11}
                  color="#15803D"
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.stateTagText, { color: "#15803D" }]}>
                  Connected
                </Text>
              </View>
            ) : isSent ? (
              <View style={[styles.stateTag, styles.stateTagSent]}>
                <Ionicons
                  name="paper-plane"
                  size={10}
                  color="#065F46"
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.stateTagText, { color: "#065F46" }]}>
                  Interest Sent
                </Text>
              </View>
            ) : null}
          </View>

          {/* Remove from Shortlist Button */}
          <TouchableOpacity
            style={styles.trashBtn}
            onPress={() => handleRemove(item)}
            disabled={busy}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {busy ? (
              <ActivityIndicator size="small" color={COLORS.danger} />
            ) : (
              <Ionicons name="trash-outline" size={17} color={COLORS.danger} />
            )}
          </TouchableOpacity>
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

        {/* Action Buttons Row */}
        <View style={styles.actionsGrid}>
          {/* Express Interest Button */}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              isAccepted
                ? styles.interestAcceptedBtn
                : isSent
                  ? styles.interestSentBtn
                  : styles.sendInterestBtn,
            ]}
            onPress={() => handleSendInterest(item)}
            disabled={busy}
            activeOpacity={0.8}
          >
            <Ionicons
              name={
                isAccepted
                  ? "checkmark-done"
                  : isSent
                    ? "checkmark-circle"
                    : "heart"
              }
              size={16}
              color={isAccepted ? "#15803D" : isSent ? "#065F46" : "#fff"}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.actionBtnText,
                isAccepted
                  ? styles.interestAcceptedText
                  : isSent
                    ? styles.interestSentText
                    : styles.sendInterestText,
              ]}
              numberOfLines={1}
            >
              {isAccepted
                ? "Accepted"
                : isSent
                  ? "Interest Sent"
                  : "Send Interest"}
            </Text>
          </TouchableOpacity>

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
            <Text
              style={[styles.actionBtnText, styles.viewProfileText]}
              numberOfLines={1}
            >
              View Profile
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      {/* ---------- STICKY HEADER ---------- */}
      <ScreenHeader
        title="Shortlisted"
        subtitle="Profiles you have bookmarked for partner consideration"
        badge={`${totalItems || shortlistedMembers.length} Saved`}
        badgeIcon="star"
        badgeColor="#D97706"
        badgeBgColor="#FEF3C7"
      >
        {/* Instant Search Bar */}
        {(totalItems > 0 ||
          shortlistedMembers.length > 0 ||
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
                  size={18}
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
        <ListFeedSkeleton count={4} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredShortlists}
          keyExtractor={(item, index) =>
            String(
              item?.userId ||
                item?.id ||
                item?.memberId ||
                `shortlist_${index}`,
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
            filteredShortlists.length > 0 ? (
              <View>
                {/* Summary tiles */}
                {!searchQuery.trim() ? (
                  <View style={styles.statsRow}>
                    <View style={styles.statTile}>
                      <View
                        style={[
                          styles.statIcon,
                          { backgroundColor: "#FEF3C7" },
                        ]}
                      >
                        <Ionicons name="star" size={15} color="#D97706" />
                      </View>
                      <Text style={styles.statNumber}>
                        {totalItems || shortlistedMembers.length}
                      </Text>
                      <Text style={styles.statLabel}>Saved</Text>
                    </View>
                    <View style={styles.statTile}>
                      <View
                        style={[
                          styles.statIcon,
                          { backgroundColor: "#ECFDF5" },
                        ]}
                      >
                        <Ionicons
                          name="paper-plane"
                          size={14}
                          color="#065F46"
                        />
                      </View>
                      <Text style={styles.statNumber}>
                        {interestSummary.sent}
                      </Text>
                      <Text style={styles.statLabel}>Interest Sent</Text>
                    </View>
                    <View style={styles.statTile}>
                      <View
                        style={[
                          styles.statIcon,
                          { backgroundColor: "#DCFCE7" },
                        ]}
                      >
                        <Ionicons
                          name="checkmark-done"
                          size={16}
                          color="#15803D"
                        />
                      </View>
                      <Text style={styles.statNumber}>
                        {interestSummary.accepted}
                      </Text>
                      <Text style={styles.statLabel}>Accepted</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.resultsSummaryRow}>
                  <Text style={styles.resultsSummaryText}>
                    Showing{" "}
                    <Text style={styles.resultsSummaryBold}>
                      {filteredShortlists.length}
                    </Text>{" "}
                    of {totalItems || shortlistedMembers.length} shortlisted
                    matches
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
            !loading && filteredShortlists.length > 0 && !searchQuery.trim() ? (
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
                    shortlisted profiles
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
                <Text style={styles.emptyTitle}>No Matching Profiles</Text>
                <Text style={styles.emptySubtitle}>
                  We could not find any shortlisted member matching &ldquo;
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
                  <Ionicons name="star-outline" size={44} color="#D97706" />
                </View>
                <Text style={styles.emptyTitle}>
                  No Shortlisted Profiles Yet
                </Text>
                <Text style={styles.emptySubtitle}>
                  When you browse Active Members, tap the Star icon to bookmark
                  and compare candidate profiles here.
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
    marginTop: 12,
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
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
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

  /* Results Strip */
  resultsSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  resultsSummaryText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
  },
  resultsSummaryBold: {
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  clearSearchLink: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },

  /* Content List */
  listContent: {
    padding: 16,
    paddingBottom: 110,
  },

  /* Member Card */
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
    flexWrap: "wrap",
    gap: 6,
  },
  savedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  savedTagText: {
    fontSize: 10.5,
    fontFamily: FONTS.bold,
    color: "#92400E",
  },
  stateTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  stateTagAccepted: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
  },
  stateTagSent: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  stateTagText: {
    fontSize: 10.5,
    fontFamily: FONTS.bold,
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
  trashBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FEE2E2",
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
  sendInterestBtn: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  sendInterestText: {
    color: "#fff",
    fontFamily: FONTS.bold,
  },
  interestSentBtn: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  interestSentText: {
    color: "#065F46",
    fontFamily: FONTS.semiBold,
  },
  interestAcceptedBtn: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  interestAcceptedText: {
    color: "#15803D",
    fontFamily: FONTS.bold,
  },
  viewProfileBtn: {
    backgroundColor: "#FFF5F7",
    borderWidth: 1,
    borderColor: "#FFD9E0",
  },
  viewProfileText: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
  actionBtnText: {
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
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
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
