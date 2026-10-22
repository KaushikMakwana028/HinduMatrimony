import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Modal,
    RefreshControl,
    ActivityIndicator,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { useAuth } from "../contexts/AuthContext";
import activeMemberService from "../services/activeMemberService";
import profileService from "../services/profileService";
import { COLORS, FONTS } from "../theme";

const PAGE_SIZE = 10;
const CACHE_MEMBERS_KEY = "@hm_active_members_feed";
const CACHE_SETTINGS_KEY = "@hm_profile_settings_cache";

/**
 * Determine opposite gender based on user gender
 */
function resolveOppositeGender(genderValue) {
    if (!genderValue) return "Female";
    const str = String(genderValue).trim().toLowerCase();
    if (str === "male" || str === "1" || str === "m") return "Female";
    if (str === "female" || str === "2" || str === "f") return "Male";
    return "Female";
}

/**
 * Helper to resolve an ID or string to a human-readable name from lookup map
 */
function resolveName(value, map) {
    if (value === null || value === undefined || value === "") return "";
    const str = String(value).trim().replace(/,\s*$/, "");
    if (map && map[str]) return map[str];
    const num = Number(str);
    if (!isNaN(num) && map && map[num]) return map[num];
    return str;
}

/**
 * Smart Pagination Range Generator
 * Fits screen width:
 * Starting pages: [1, 2, 3, "...", totalPages]
 * Middle pages:   [1, "...", current - 1, current, current + 1, "...", totalPages]
 * Final pages:    [1, "...", totalPages - 2, totalPages - 1, totalPages]
 */
function getPaginationRange(currentPage, totalPages) {
    if (totalPages <= 5) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
        return [1, 2, 3, "...", totalPages];
    }
    if (currentPage >= totalPages - 2) {
        return [1, "...", totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

/**
 * Normalizes member item from POST /api/member/member-listing
 */
function formatLiveMember(item, index) {
    if (!item) return null;
    const id = item.user_id || item.id || index + 1;
    const name = `${item.first_name || ""} ${item.last_name || ""}`.trim() || `Member ${item.code || id}`;
    const photoStr = String(item.photo || "");

    return {
        id: id,
        userId: id,
        name: name,
        memberId: String(item.code || `HM-${id}`),
        photo: photoStr && !photoStr.includes("place.png") ? photoStr : null,
        photoUrl: photoStr,
        plan: item.membership === 1 ? "Premium" : "Free",
        onlineStatus: "Active Now",
        verified: true,
        age: item.age || 26,
        height: item.height ? `${item.height} ft` : null,
        rawReligion: item.religion,
        rawCaste: item.caste,
        rawMaritalStatus: item.marital_status,
        rawCountry: item.country,
        rawMotherTongue: item.mothere_tongue || item.mother_tongue,
        career: item.profession || "Professional",
        about: "Looking for an educated, caring life partner with strong cultural values and mutual respect.",
        interestSent: item.interest_status === 1,
        shortlisted: item.shortlist_status === 1,
        ignored: false,
    };
}

export default function ActiveMembersScreen() {
    const { user, token } = useAuth();
    const scrollRef = useRef(null);

    // Detected logged-in user gender & opposite gender
    const [detectedUserGender, setDetectedUserGender] = useState(() => {
        return user?.gender ? (String(user.gender).toLowerCase().includes("fem") ? "Female" : "Male") : "Male";
    });

    const targetOppositeGender = useMemo(() => {
        return resolveOppositeGender(detectedUserGender);
    }, [detectedUserGender]);

    // Live Member List
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(() => Boolean(token));
    const [refreshing, setRefreshing] = useState(false);

    // Filter Settings from GET /member/profile-settings
    const [serverFilterSettings, setServerFilterSettings] = useState(null);
    const [syncingFilter, setSyncingFilter] = useState(false);

    // Search Query
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    // Modal Filters (aligned with POST /member/member-listing payload)
    const [filterAgeFrom, setFilterAgeFrom] = useState("");
    const [filterAgeTo, setFilterAgeTo] = useState("");
    const [filterMaritalStatusId, setFilterMaritalStatusId] = useState("");
    const [filterReligionId, setFilterReligionId] = useState("");
    const [filterCasteId, setFilterCasteId] = useState("");
    const [filterCountryId, setFilterCountryId] = useState("");
    const [filterMotherTongue, setFilterMotherTongue] = useState("");
    const [filterProfession, setFilterProfession] = useState("");
    const [filterMinHeight, setFilterMinHeight] = useState("");
    const [filterMaxHeight, setFilterMaxHeight] = useState("");

    // Modals
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);
    const [detailProfileData, setDetailProfileData] = useState(null);

    // Member Action State (Interest, Shortlist, Ignore)
    const [interestSentMap, setInterestSentMap] = useState({});
    const [shortlistMap, setShortlistMap] = useState({});
    const [ignoredMap, setIgnoredMap] = useState({});

    // Build lookup maps from server profile-settings (ID -> Name)
    const lookupMaps = useMemo(() => {
        const religions = {};
        const castes = {};
        const maritalStatuses = {};
        const countries = {};
        const languages = {};

        if (serverFilterSettings) {
            (serverFilterSettings.religions || []).forEach((r) => {
                religions[r.id] = r.name;
            });
            (serverFilterSettings.castes || []).forEach((c) => {
                castes[c.id] = c.name;
            });
            (serverFilterSettings.marital_statuses || []).forEach((m) => {
                maritalStatuses[m.id] = m.name;
            });
            (serverFilterSettings.countries || []).forEach((co) => {
                countries[co.id] = co.name;
            });
            (serverFilterSettings.languages || []).forEach((l) => {
                languages[l.id] = l.name;
            });
        }

        return { religions, castes, maritalStatuses, countries, languages };
    }, [serverFilterSettings]);

    // 1. Initial Load: Instant AsyncStorage Cache + Background Live Sync
    useEffect(() => {
        let isMounted = true;
        if (!token) return;

        (async () => {
            // STEP A: Read from Cache for Instant 0ms Load
            try {
                const [cachedMembersRaw, cachedSettingsRaw] = await Promise.all([
                    AsyncStorage.getItem(CACHE_MEMBERS_KEY),
                    AsyncStorage.getItem(CACHE_SETTINGS_KEY),
                ]);

                if (isMounted) {
                    if (cachedSettingsRaw) {
                        const parsedSettings = JSON.parse(cachedSettingsRaw);
                        setServerFilterSettings(parsedSettings);
                        if (parsedSettings.member?.gender) {
                            const g = String(parsedSettings.member.gender).toLowerCase().includes("fem") ? "Female" : "Male";
                            setDetectedUserGender(g);
                        }
                    }

                    if (cachedMembersRaw) {
                        const parsedMembers = JSON.parse(cachedMembersRaw);
                        if (Array.isArray(parsedMembers) && parsedMembers.length > 0) {
                            setMembers(parsedMembers);
                            setLoading(false); // Instantly ready!
                        }
                    }
                }
            } catch {
                // Non-blocking cache error
            }

            // STEP B: Fetch Live Data in background (send religion_id: 1 for fast 10s query instead of 30s)
            try {
                const [settingsRes, listingRes] = await Promise.allSettled([
                    activeMemberService.getProfileSettings(token),
                    activeMemberService.getMemberList({ religion_id: 1 }, token),
                ]);

                if (isMounted) {
                    if (settingsRes.status === "fulfilled" && settingsRes.value?.result !== false) {
                        const s = settingsRes.value;
                        setServerFilterSettings(s);
                        AsyncStorage.setItem(CACHE_SETTINGS_KEY, JSON.stringify(s)).catch(() => {});
                        if (s.member?.gender) {
                            const g = String(s.member.gender).toLowerCase().includes("fem") ? "Female" : "Male";
                            setDetectedUserGender(g);
                        }
                    }

                    if (listingRes.status === "fulfilled" && listingRes.value?.result !== false && listingRes.value.data) {
                        const rawList = listingRes.value.data.members || (Array.isArray(listingRes.value.data) ? listingRes.value.data : []);
                        const formatted = rawList.map(formatLiveMember).filter(Boolean);
                        setMembers(formatted);
                        AsyncStorage.setItem(CACHE_MEMBERS_KEY, JSON.stringify(formatted)).catch(() => {});
                    }
                }
            } catch {
                // If network fails and no cached members, set empty
                if (isMounted) setMembers((prev) => (prev.length === 0 ? [] : prev));
            } finally {
                if (isMounted) setLoading(false);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [token]);

    // Pull to refresh handler
    const onRefresh = useCallback(async () => {
        if (!token) return;
        setRefreshing(true);
        try {
            const [settingsRes, listingRes] = await Promise.allSettled([
                activeMemberService.getProfileSettings(token),
                activeMemberService.getMemberList({ religion_id: 1 }, token),
            ]);

            if (settingsRes.status === "fulfilled" && settingsRes.value?.result !== false) {
                const s = settingsRes.value;
                setServerFilterSettings(s);
                AsyncStorage.setItem(CACHE_SETTINGS_KEY, JSON.stringify(s)).catch(() => {});
                if (s.member?.gender) {
                    const g = String(s.member.gender).toLowerCase().includes("fem") ? "Female" : "Male";
                    setDetectedUserGender(g);
                }
            }

            if (listingRes.status === "fulfilled" && listingRes.value?.result !== false && listingRes.value.data) {
                const rawList = listingRes.value.data.members || (Array.isArray(listingRes.value.data) ? listingRes.value.data : []);
                const formatted = rawList.map(formatLiveMember).filter(Boolean);
                setMembers(formatted);
                AsyncStorage.setItem(CACHE_MEMBERS_KEY, JSON.stringify(formatted)).catch(() => {});
            }
        } finally {
            setRefreshing(false);
        }
    }, [token]);

    // Client-side search filtering
    const filteredMembers = useMemo(() => {
        return members.filter((m) => {
            if (ignoredMap[m.id]) return false;

            const resolvedReligion = resolveName(m.rawReligion, lookupMaps.religions);
            const resolvedCaste = resolveName(m.rawCaste, lookupMaps.castes);
            const resolvedCountry = resolveName(m.rawCountry, lookupMaps.countries);

            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matches =
                    m.name.toLowerCase().includes(q) ||
                    m.memberId.toLowerCase().includes(q) ||
                    resolvedCaste.toLowerCase().includes(q) ||
                    resolvedReligion.toLowerCase().includes(q) ||
                    resolvedCountry.toLowerCase().includes(q) ||
                    m.career.toLowerCase().includes(q);
                if (!matches) return false;
            }

            return true;
        });
    }, [members, ignoredMap, searchQuery, lookupMaps]);

    // Total pages calculation
    const totalPages = useMemo(() => {
        return Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
    }, [filteredMembers.length]);

    // Safe current page within valid bounds
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

    // Paginated 10 members per page
    const paginatedMembers = useMemo(() => {
        const start = (safeCurrentPage - 1) * PAGE_SIZE;
        return filteredMembers.slice(start, start + PAGE_SIZE);
    }, [filteredMembers, safeCurrentPage]);

    // Handle Page Change with smooth scroll to top
    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > totalPages || newPage === safeCurrentPage) return;
        setCurrentPage(newPage);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
    };

    // Calculate active filter count for the badge
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filterAgeFrom || filterAgeTo) count += 1;
        if (filterMaritalStatusId) count += 1;
        if (filterReligionId) count += 1;
        if (filterCasteId) count += 1;
        if (filterCountryId) count += 1;
        if (filterMotherTongue) count += 1;
        if (filterProfession) count += 1;
        if (filterMinHeight || filterMaxHeight) count += 1;
        return count;
    }, [filterAgeFrom, filterAgeTo, filterMaritalStatusId, filterReligionId, filterCasteId, filterCountryId, filterMotherTongue, filterProfession, filterMinHeight, filterMaxHeight]);

    // Search Query change
    const handleSearchChange = (text) => {
        setSearchQuery(text);
        setCurrentPage(1);
    };

    // Apply Filter & Send Payload to POST /api/member/member-listing using real IDs from profile-settings
    const handleApplyFilters = async () => {
        setSyncingFilter(true);
        setCurrentPage(1);
        try {
            if (token) {
                const payload = {};
                if (filterAgeFrom.trim()) payload.age_from = Number(filterAgeFrom);
                if (filterAgeTo.trim()) payload.age_to = Number(filterAgeTo);
                if (filterMaritalStatusId) payload.marital_status = Number(filterMaritalStatusId);
                if (filterReligionId) payload.religion_id = Number(filterReligionId);
                if (filterCasteId) payload.caste_id = Number(filterCasteId);
                if (filterCountryId) payload.country_id = Number(filterCountryId);
                if (filterMotherTongue.trim()) payload.mother_tongue = filterMotherTongue.trim();
                if (filterProfession.trim()) payload.profession = filterProfession.trim();
                if (filterMinHeight.trim()) payload.min_height = Number(filterMinHeight);
                if (filterMaxHeight.trim()) payload.max_height = Number(filterMaxHeight);

                const response = await activeMemberService.getMemberList(payload, token);
                if (response && response.result !== false && response.data) {
                    const rawList = response.data.members || (Array.isArray(response.data) ? response.data : []);
                    const formatted = rawList.map(formatLiveMember).filter(Boolean);
                    setMembers(formatted);
                    AsyncStorage.setItem(CACHE_MEMBERS_KEY, JSON.stringify(formatted)).catch(() => {});
                }
            }
        } catch (err) {
            Alert.alert("Filter notice", err.message || "Failed to filter members");
        } finally {
            setSyncingFilter(false);
            setFilterModalVisible(false);
        }
    };

    // Reset All Filters
    const handleResetFilters = async () => {
        setFilterAgeFrom("");
        setFilterAgeTo("");
        setFilterMaritalStatusId("");
        setFilterReligionId("");
        setFilterCasteId("");
        setFilterCountryId("");
        setFilterMotherTongue("");
        setFilterProfession("");
        setFilterMinHeight("");
        setFilterMaxHeight("");
        setSearchQuery("");
        setCurrentPage(1);
        setFilterModalVisible(false);

        if (token) {
            try {
                const response = await activeMemberService.getMemberList({ religion_id: 1 }, token);
                if (response && response.result !== false && response.data) {
                    const rawList = response.data.members || (Array.isArray(response.data) ? response.data : []);
                    const formatted = rawList.map(formatLiveMember).filter(Boolean);
                    setMembers(formatted);
                    AsyncStorage.setItem(CACHE_MEMBERS_KEY, JSON.stringify(formatted)).catch(() => {});
                }
            } catch {
                // Non-blocking
            }
        }
    };

    // Handle Express Interest (POST /api/member/express-interest)
    const handleSendInterest = async (member) => {
        const isSent = interestSentMap[member.id] || member.interestSent;
        if (isSent) {
            Alert.alert("Already Sent", `You have already expressed interest in ${member.name}.`);
            return;
        }

        try {
            const response = await activeMemberService.expressInterest(member.id, token);
            setInterestSentMap((prev) => ({ ...prev, [member.id]: true }));
            Alert.alert("Interest Expressed! 💖", response?.message || `Your interest has been sent to ${member.name}.`);
        } catch (err) {
            Alert.alert("Notice", err.message || "Could not express interest at this moment.");
        }
    };

    // Handle Shortlist (POST /api/member/add-to-shortlist & /remove-from-shortlist)
    const handleToggleShortlist = async (member) => {
        const isShortlisted = shortlistMap[member.id] !== undefined
            ? shortlistMap[member.id]
            : member.shortlisted;

        try {
            if (isShortlisted) {
                const res = await activeMemberService.removeFromShortlist(member.id, token);
                setShortlistMap((prev) => ({ ...prev, [member.id]: false }));
                Alert.alert("Shortlist Updated", res?.message || "Removed from shortlist.");
            } else {
                const res = await activeMemberService.addToShortlist(member.id, token);
                setShortlistMap((prev) => ({ ...prev, [member.id]: true }));
                Alert.alert("Shortlisted! ⭐", res?.message || "Member added to your shortlist.");
            }
        } catch (err) {
            Alert.alert("Notice", err.message || "Could not update shortlist.");
        }
    };

    // Handle Ignore Member (POST /api/member/add-to-ignore-list)
    const handleIgnoreMember = (member) => {
        Alert.alert(
            "Ignore Profile",
            `Are you sure you want to add ${member.name} to your ignored list?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Ignore",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await activeMemberService.addToIgnoreList(member.id, token);
                            setIgnoredMap((prev) => ({ ...prev, [member.id]: true }));
                            Alert.alert("Ignored", `${member.name} has been added to your ignore list.`);
                        } catch (err) {
                            Alert.alert("Notice", err.message || "Could not ignore this member.");
                        }
                    },
                },
            ]
        );
    };

    // Handle Report Member (POST /api/member/report-member)
    const handleReportMember = (member) => {
        Alert.alert(
            "Report Profile",
            `Would you like to report ${member.name} (ID: ${member.memberId}) for admin safety review?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Submit Report",
                    onPress: async () => {
                        try {
                            const res = await activeMemberService.reportMember(member.id, "Inappropriate profile", token);
                            Alert.alert("Reported", res?.message || "Your report has been submitted to our safety team.");
                        } catch (err) {
                            Alert.alert("Notice", err.message || "Could not submit report.");
                        }
                    },
                },
            ]
        );
    };

    // Open Full Profile Modal (GET /api/member/public-profile/{id})
    const handleViewFullProfile = async (member) => {
        setSelectedMember(member);
        setDetailModalVisible(true);
        setDetailLoading(true);
        setDetailProfileData(null);

        try {
            const res = await profileService.getProfile(member.id, token);
            if (res && res.result !== false && res.data) {
                setDetailProfileData(res.data);
            }
        } catch {
            // Non-blocking
        } finally {
            setDetailLoading(false);
        }
    };

    // Extract detail fields from public profile response
    const detailBasic = detailProfileData?.basic_info;
    const detailEducation = detailProfileData?.education;
    const detailCareer = detailProfileData?.career;
    const detailPhysical = detailProfileData?.physical_attributes;
    const detailSpiritual = detailProfileData?.spiritual_backgrounds;
    const detailLifestyle = detailProfileData?.lifestyles;
    const detailExpectation = detailProfileData?.partner_expectation;

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            {/* ---------- STICKY APP HEADER ---------- */}
            <ScreenHeader>
                <View style={styles.headerTopRow}>
                    <View style={styles.headerTitleGroup}>
                        <View style={styles.titleWithBadge}>
                            <Text style={styles.title}>Active Members</Text>
                            <View style={styles.livePulseContainer}>
                                <View style={styles.pulseDot} />
                                <Text style={styles.livePulseText}>
                                    {filteredMembers.length > 0 ? `${filteredMembers.length} Active` : "Active Now"}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.subtitle}>
                            Showing verified <Text style={styles.genderHighlight}>{targetOppositeGender}</Text> profiles
                        </Text>
                    </View>

                    {/* Filter Icon Button with Active Badge */}
                    <TouchableOpacity
                        style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
                        onPress={() => setFilterModalVisible(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name="options-outline"
                            size={20}
                            color={activeFilterCount > 0 ? "#fff" : COLORS.text}
                        />
                        {activeFilterCount > 0 && (
                            <View style={styles.filterBadge}>
                                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Instant Search Bar */}
                <View style={styles.searchBarContainer}>
                    <Ionicons name="search" size={18} color={COLORS.textLight} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={`Search ${targetOppositeGender.toLowerCase()}s by name, ID, caste, city...`}
                        placeholderTextColor={COLORS.textLight}
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                        clearButtonMode="while-editing"
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearchChange("")} style={styles.clearSearchBtn}>
                            <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
                        </TouchableOpacity>
                    )}
                </View>
            </ScreenHeader>

            {/* ---------- SCROLLABLE ACTIVE MEMBERS FEED ---------- */}
            <KeyboardAwareScrollView
                ref={scrollRef}
                contentContainerStyle={styles.scroll}
                bottomPadding={120}
                showsVerticalScrollIndicator={true}
                persistentScrollbar={true}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
            >
                {/* Results Count & Match Pill */}
                <View style={styles.resultsHeaderRow}>
                    <View style={styles.matchTagPill}>
                        <Ionicons
                            name={targetOppositeGender === "Female" ? "woman" : "man"}
                            size={14}
                            color={COLORS.primary}
                        />
                        <Text style={styles.matchTagText}>
                            {targetOppositeGender} Matches ({filteredMembers.length})
                        </Text>
                    </View>

                    {activeFilterCount > 0 && (
                        <TouchableOpacity onPress={handleResetFilters}>
                            <Text style={styles.clearFilterLink}>Clear Filters</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Loading Indicator */}
                {loading && members.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loadingText}>Fetching active members...</Text>
                    </View>
                ) : filteredMembers.length === 0 ? (
                    /* Clean Empty State */
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name="people-outline" size={44} color={COLORS.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>No Active Members Available</Text>
                        <Text style={styles.emptySubtitle}>
                            There are currently no active profiles matching your filters. Try clearing your filters or pull down to refresh.
                        </Text>
                        <TouchableOpacity style={styles.refreshEmptyBtn} onPress={onRefresh} activeOpacity={0.8}>
                            <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.refreshEmptyBtnText}>Refresh Now</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    /* Paginated Member Cards (10 per page) */
                    paginatedMembers.map((m) => {
                        const isSent = interestSentMap[m.id] || m.interestSent;
                        const isShortlisted = shortlistMap[m.id] !== undefined ? shortlistMap[m.id] : m.shortlisted;

                        const displayReligion = resolveName(m.rawReligion, lookupMaps.religions);
                        const displayCaste = resolveName(m.rawCaste, lookupMaps.castes);
                        const displayMarital = resolveName(m.rawMaritalStatus, lookupMaps.maritalStatuses);
                        const displayCountry = resolveName(m.rawCountry, lookupMaps.countries);
                        const displayMotherTongue = resolveName(m.rawMotherTongue, lookupMaps.languages);

                        return (
                            <View key={m.id} style={styles.card}>
                                {/* Hero Photo with Badges */}
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={() => handleViewFullProfile(m)}
                                    style={styles.photoContainer}
                                >
                                    {m.photo ? (
                                        <Image source={{ uri: m.photo }} style={styles.cardPhoto} resizeMode="cover" />
                                    ) : (
                                        <View style={styles.photoFallback}>
                                            <Ionicons name="person" size={56} color={COLORS.primary} />
                                        </View>
                                    )}

                                    {/* Top Overlay Badges */}
                                    <View style={styles.photoOverlayTop}>
                                        <View style={[styles.planBadge, m.plan === "Premium" ? styles.planPremium : styles.planFree]}>
                                            <Ionicons
                                                name={m.plan === "Premium" ? "ribbon" : "sparkles"}
                                                size={11}
                                                color="#fff"
                                                style={{ marginRight: 3 }}
                                            />
                                            <Text style={styles.planBadgeText}>{m.plan}</Text>
                                        </View>

                                        <View style={styles.onlineBadge}>
                                            <View style={styles.onlineDot} />
                                            <Text style={styles.onlineBadgeText}>{m.onlineStatus}</Text>
                                        </View>
                                    </View>

                                    {/* Bottom Overlays on Photo */}
                                    <View style={styles.photoOverlayBottom}>
                                        <View style={styles.verifiedBadge}>
                                            <Ionicons name="checkmark-circle" size={13} color="#fff" />
                                            <Text style={styles.verifiedText}>Verified</Text>
                                        </View>
                                        <View style={styles.memberIdBadge}>
                                            <Text style={styles.memberIdText}>{m.memberId}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>

                                {/* Card Details Body */}
                                <View style={styles.cardBody}>
                                    {/* Name and Report Button Header */}
                                    <View style={styles.nameRow}>
                                        <TouchableOpacity
                                            onPress={() => handleViewFullProfile(m)}
                                            activeOpacity={0.7}
                                            style={{ flex: 1, marginRight: 8 }}
                                        >
                                            <Text style={styles.cardName} numberOfLines={1}>
                                                {m.name}, <Text style={styles.cardAge}>{m.age} yrs</Text>
                                            </Text>
                                        </TouchableOpacity>

                                        {/* Subtle Report Button on Card Header */}
                                        <TouchableOpacity
                                            style={styles.reportBadgeBtn}
                                            onPress={() => handleReportMember(m)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="flag-outline" size={12} color="#DC2626" />
                                            <Text style={styles.reportBadgeText}>Report</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Attribute Chips with Names Resolved from Server IDs */}
                                    <View style={styles.chipsContainer}>
                                        {m.height ? (
                                            <View style={styles.chip}>
                                                <Ionicons name="resize-outline" size={12} color={COLORS.primary} />
                                                <Text style={styles.chipText}>{m.height}</Text>
                                            </View>
                                        ) : null}
                                        {displayReligion ? (
                                            <View style={styles.chip}>
                                                <Ionicons name="flower-outline" size={12} color={COLORS.primary} />
                                                <Text style={styles.chipText}>
                                                    {displayReligion} {displayCaste ? `• ${displayCaste}` : ""}
                                                </Text>
                                            </View>
                                        ) : null}
                                        {displayMarital ? (
                                            <View style={styles.chip}>
                                                <Ionicons name="heart-outline" size={12} color={COLORS.primary} />
                                                <Text style={styles.chipText}>{displayMarital}</Text>
                                            </View>
                                        ) : null}
                                        {displayCountry ? (
                                            <View style={styles.chip}>
                                                <Ionicons name="location-outline" size={12} color={COLORS.primary} />
                                                <Text style={styles.chipText}>{displayCountry}</Text>
                                            </View>
                                        ) : null}
                                        {displayMotherTongue ? (
                                            <View style={styles.chip}>
                                                <Ionicons name="chatbubbles-outline" size={12} color={COLORS.primary} />
                                                <Text style={styles.chipText}>{displayMotherTongue}</Text>
                                            </View>
                                        ) : null}
                                    </View>

                                    <View style={styles.cardDivider} />

                                    {/* ---------- 4 CLEAN MODERN ACTION BUTTONS ---------- */}
                                    <View style={styles.cardActionGrid}>
                                        {/* Row 1: Primary Actions */}
                                        <View style={styles.actionRow}>
                                            {/* 1. Send Interest / Interest Sent */}
                                            <TouchableOpacity
                                                style={[styles.primaryActionBtn, isSent ? styles.interestBtnSent : styles.interestBtnActive]}
                                                onPress={() => handleSendInterest(m)}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons
                                                    name={isSent ? "checkmark-circle" : "heart"}
                                                    size={16}
                                                    color={isSent ? "#065F46" : "#fff"}
                                                    style={styles.btnIcon}
                                                />
                                                <Text style={[styles.btnText, isSent ? styles.interestTextSent : styles.interestTextActive]}>
                                                    {isSent ? "Interest Sent" : "Send Interest"}
                                                </Text>
                                            </TouchableOpacity>

                                            {/* 2. View Profile */}
                                            <TouchableOpacity
                                                style={[styles.primaryActionBtn, styles.viewProfileBtn]}
                                                onPress={() => handleViewFullProfile(m)}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="person-outline" size={15} color={COLORS.primary} style={styles.btnIcon} />
                                                <Text style={[styles.btnText, styles.viewProfileText]}>View Profile</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Row 2: Secondary Actions */}
                                        <View style={styles.actionRow}>
                                            {/* 3. Shortlist */}
                                            <TouchableOpacity
                                                style={[styles.secondaryActionBtn, isShortlisted && styles.shortlistBtnActive]}
                                                onPress={() => handleToggleShortlist(m)}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons
                                                    name={isShortlisted ? "star" : "star-outline"}
                                                    size={15}
                                                    color={isShortlisted ? "#B45309" : "#64748B"}
                                                    style={styles.btnIcon}
                                                />
                                                <Text style={[styles.btnText, isShortlisted ? styles.shortlistTextActive : styles.secondaryBtnText]}>
                                                    {isShortlisted ? "Shortlisted" : "Shortlist"}
                                                </Text>
                                            </TouchableOpacity>

                                            {/* 4. Ignore */}
                                            <TouchableOpacity
                                                style={[styles.secondaryActionBtn, styles.ignoreBtn]}
                                                onPress={() => handleIgnoreMember(m)}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="ban-outline" size={15} color="#64748B" style={styles.btnIcon} />
                                                <Text style={[styles.btnText, styles.secondaryBtnText]}>Ignore</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    })
                )}

                {/* ---------- RESPONSIVE PAGINATION CONTROLS (NEVER OUT OF BOUNDS) ---------- */}
                {!loading && filteredMembers.length > 0 && totalPages > 1 && (
                    <View style={styles.paginationCard}>
                        {/* Page info subtitle */}
                        <Text style={styles.paginationInfoText}>
                            Showing <Text style={styles.paginationInfoBold}>{(safeCurrentPage - 1) * PAGE_SIZE + 1}–{Math.min(safeCurrentPage * PAGE_SIZE, filteredMembers.length)}</Text> of <Text style={styles.paginationInfoBold}>{filteredMembers.length}</Text> profiles
                        </Text>

                        {/* Centered Pagination Row */}
                        <View style={styles.paginationRow}>
                            {/* Previous Button */}
                            <TouchableOpacity
                                style={[styles.navPageBtn, safeCurrentPage === 1 && styles.navPageBtnDisabled]}
                                onPress={() => handlePageChange(safeCurrentPage - 1)}
                                disabled={safeCurrentPage === 1}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="chevron-back"
                                    size={14}
                                    color={safeCurrentPage === 1 ? "#CBD5E1" : COLORS.text}
                                />
                                <Text style={[styles.navPageBtnText, safeCurrentPage === 1 && styles.navPageBtnTextDisabled]}>
                                    Prev
                                </Text>
                            </TouchableOpacity>

                            {/* Numbers & Ellipses */}
                            <View style={styles.pagePillsGroup}>
                                {getPaginationRange(safeCurrentPage, totalPages).map((p, idx) => {
                                    if (p === "...") {
                                        return (
                                            <View key={`ellipsis_${idx}`} style={styles.ellipsisWrap}>
                                                <Text style={styles.ellipsisText}>•••</Text>
                                            </View>
                                        );
                                    }

                                    const isCurrent = p === safeCurrentPage;
                                    return (
                                        <TouchableOpacity
                                            key={`page_${p}`}
                                            style={[styles.pageNumberBtn, isCurrent && styles.pageNumberBtnActive]}
                                            onPress={() => handlePageChange(p)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.pageNumberText, isCurrent && styles.pageNumberTextActive]}>
                                                {p}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Next Button */}
                            <TouchableOpacity
                                style={[styles.navPageBtn, safeCurrentPage === totalPages && styles.navPageBtnDisabled]}
                                onPress={() => handlePageChange(safeCurrentPage + 1)}
                                disabled={safeCurrentPage === totalPages}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.navPageBtnText, safeCurrentPage === totalPages && styles.navPageBtnTextDisabled]}>
                                    Next
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={14}
                                    color={safeCurrentPage === totalPages ? "#CBD5E1" : COLORS.text}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </KeyboardAwareScrollView>

            {/* ---------- COMPREHENSIVE SEARCH & FILTER MODAL ---------- */}
            <Modal
                visible={filterModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setFilterModalVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalContainer}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Active Member Filter</Text>
                                <Text style={styles.modalSubtitle}>Filter matches directly via Hindumatrimony API</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setFilterModalVisible(false)}
                                style={styles.modalCloseBtn}
                            >
                                <Ionicons name="close" size={22} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Modal Filter Fields */}
                        <ScrollView
                            style={styles.modalScroll}
                            contentContainerStyle={styles.modalScrollContent}
                            showsVerticalScrollIndicator={true}
                        >
                            {/* Marital Status (Using real IDs from Server Profile Settings) */}
                            <Text style={styles.filterSectionTitle}>Marital Status</Text>
                            <View style={styles.optionRow}>
                                <TouchableOpacity
                                    style={[styles.optionPill, !filterMaritalStatusId && styles.optionPillActive]}
                                    onPress={() => setFilterMaritalStatusId("")}
                                >
                                    <Text style={[styles.optionPillText, !filterMaritalStatusId && styles.optionPillTextActive]}>
                                        All Statuses
                                    </Text>
                                </TouchableOpacity>
                                {(serverFilterSettings?.marital_statuses || [
                                    { id: 4, name: "Never Married" },
                                    { id: 1, name: "Divorced" },
                                    { id: 2, name: "Awaiting Divorce" },
                                    { id: 3, name: "Widower" },
                                ]).map((ms) => (
                                    <TouchableOpacity
                                        key={ms.id}
                                        style={[styles.optionPill, String(filterMaritalStatusId) === String(ms.id) && styles.optionPillActive]}
                                        onPress={() => setFilterMaritalStatusId(String(ms.id))}
                                    >
                                        <Text style={[styles.optionPillText, String(filterMaritalStatusId) === String(ms.id) && styles.optionPillTextActive]}>
                                            {ms.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Religion (Using real IDs from Server Profile Settings) */}
                            <Text style={styles.filterSectionTitle}>Religion</Text>
                            <View style={styles.optionRow}>
                                <TouchableOpacity
                                    style={[styles.optionPill, !filterReligionId && styles.optionPillActive]}
                                    onPress={() => setFilterReligionId("")}
                                >
                                    <Text style={[styles.optionPillText, !filterReligionId && styles.optionPillTextActive]}>
                                        All Religions
                                    </Text>
                                </TouchableOpacity>
                                {(serverFilterSettings?.religions || [
                                    { id: 1, name: "Hindu" },
                                ]).map((rel) => (
                                    <TouchableOpacity
                                        key={rel.id}
                                        style={[styles.optionPill, String(filterReligionId) === String(rel.id) && styles.optionPillActive]}
                                        onPress={() => setFilterReligionId(String(rel.id))}
                                    >
                                        <Text style={[styles.optionPillText, String(filterReligionId) === String(rel.id) && styles.optionPillTextActive]}>
                                            {rel.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Caste Filter (Using real IDs from Server Profile Settings) */}
                            {serverFilterSettings?.castes?.length > 0 && (
                                <>
                                    <Text style={styles.filterSectionTitle}>Caste</Text>
                                    <View style={styles.optionRow}>
                                        <TouchableOpacity
                                            style={[styles.optionPill, !filterCasteId && styles.optionPillActive]}
                                            onPress={() => setFilterCasteId("")}
                                        >
                                            <Text style={[styles.optionPillText, !filterCasteId && styles.optionPillTextActive]}>
                                                All Castes
                                            </Text>
                                        </TouchableOpacity>
                                        {serverFilterSettings.castes.map((c) => (
                                            <TouchableOpacity
                                                key={c.id}
                                                style={[styles.optionPill, String(filterCasteId) === String(c.id) && styles.optionPillActive]}
                                                onPress={() => setFilterCasteId(String(c.id))}
                                            >
                                                <Text style={[styles.optionPillText, String(filterCasteId) === String(c.id) && styles.optionPillTextActive]}>
                                                    {c.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}

                            {/* Age Range Input */}
                            <Text style={styles.filterSectionTitle}>Age Range (Years)</Text>
                            <View style={styles.inputRangeRow}>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder="Age From (e.g. 21)"
                                    placeholderTextColor={COLORS.textLight}
                                    keyboardType="numeric"
                                    value={filterAgeFrom}
                                    onChangeText={setFilterAgeFrom}
                                />
                                <Text style={styles.rangeSeparator}>to</Text>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder="Age To (e.g. 35)"
                                    placeholderTextColor={COLORS.textLight}
                                    keyboardType="numeric"
                                    value={filterAgeTo}
                                    onChangeText={setFilterAgeTo}
                                />
                            </View>

                            {/* Height Range Input */}
                            <Text style={styles.filterSectionTitle}>Height Range (Feet)</Text>
                            <View style={styles.inputRangeRow}>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder="Min Height (e.g. 5.0)"
                                    placeholderTextColor={COLORS.textLight}
                                    keyboardType="numeric"
                                    value={filterMinHeight}
                                    onChangeText={setFilterMinHeight}
                                />
                                <Text style={styles.rangeSeparator}>to</Text>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder="Max Height (e.g. 6.0)"
                                    placeholderTextColor={COLORS.textLight}
                                    keyboardType="numeric"
                                    value={filterMaxHeight}
                                    onChangeText={setFilterMaxHeight}
                                />
                            </View>

                            {/* Mother Tongue Languages */}
                            <Text style={styles.filterSectionTitle}>Mother Tongue</Text>
                            <View style={styles.optionRow}>
                                <TouchableOpacity
                                    style={[styles.optionPill, !filterMotherTongue && styles.optionPillActive]}
                                    onPress={() => setFilterMotherTongue("")}
                                >
                                    <Text style={[styles.optionPillText, !filterMotherTongue && styles.optionPillTextActive]}>
                                        All Languages
                                    </Text>
                                </TouchableOpacity>
                                {(serverFilterSettings?.languages || [
                                    { id: 1, name: "Gujrati" },
                                    { id: 2, name: "Hindi" },
                                    { id: 3, name: "Marathi" },
                                    { id: 4, name: "Marwari" },
                                    { id: 5, name: "English" },
                                ]).map((l) => (
                                    <TouchableOpacity
                                        key={l.id}
                                        style={[styles.optionPill, filterMotherTongue === l.name && styles.optionPillActive]}
                                        onPress={() => setFilterMotherTongue(l.name)}
                                    >
                                        <Text style={[styles.optionPillText, filterMotherTongue === l.name && styles.optionPillTextActive]}>
                                            {l.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Country (Using real IDs from Server Profile Settings) */}
                            {serverFilterSettings?.countries?.length > 0 && (
                                <>
                                    <Text style={styles.filterSectionTitle}>Country</Text>
                                    <View style={styles.optionRow}>
                                        <TouchableOpacity
                                            style={[styles.optionPill, !filterCountryId && styles.optionPillActive]}
                                            onPress={() => setFilterCountryId("")}
                                        >
                                            <Text style={[styles.optionPillText, !filterCountryId && styles.optionPillTextActive]}>
                                                All Countries
                                            </Text>
                                        </TouchableOpacity>
                                        {serverFilterSettings.countries.slice(0, 10).map((co) => (
                                            <TouchableOpacity
                                                key={co.id}
                                                style={[styles.optionPill, String(filterCountryId) === String(co.id) && styles.optionPillActive]}
                                                onPress={() => setFilterCountryId(String(co.id))}
                                            >
                                                <Text style={[styles.optionPillText, String(filterCountryId) === String(co.id) && styles.optionPillTextActive]}>
                                                    {co.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}

                            {/* Profession input */}
                            <Text style={styles.filterSectionTitle}>Profession / Occupation</Text>
                            <TextInput
                                style={styles.filterTextInput}
                                placeholder="e.g. Engineer, Doctor, CA"
                                placeholderTextColor={COLORS.textLight}
                                value={filterProfession}
                                onChangeText={setFilterProfession}
                            />
                        </ScrollView>

                        {/* Modal Action Footer */}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.modalResetBtn}
                                onPress={handleResetFilters}
                            >
                                <Text style={styles.modalResetBtnText}>Reset</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalApplyBtn}
                                onPress={handleApplyFilters}
                                disabled={syncingFilter}
                                activeOpacity={0.8}
                            >
                                {syncingFilter ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalApplyBtnText}>Apply API Filters</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ---------- FULL PROFILE DETAIL MODAL ---------- */}
            <Modal
                visible={detailModalVisible}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setDetailModalVisible(false)}
            >
                <SafeAreaView style={styles.modalDetailSafe}>
                    {/* Detail Modal Top Nav */}
                    <View style={styles.detailNavRow}>
                        <TouchableOpacity
                            onPress={() => setDetailModalVisible(false)}
                            style={styles.detailBackBtn}
                        >
                            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                        <Text style={styles.detailNavTitle}>Member Profile</Text>
                        <TouchableOpacity
                            onPress={() => {
                                if (selectedMember) handleReportMember(selectedMember);
                            }}
                            style={styles.detailFlagBtn}
                        >
                            <Ionicons name="flag-outline" size={20} color={COLORS.danger} />
                        </TouchableOpacity>
                    </View>

                    {detailLoading ? (
                        <View style={styles.detailLoadingCenter}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                            <Text style={styles.detailLoadingText}>Fetching verified member profile...</Text>
                        </View>
                    ) : (
                        <ScrollView
                            contentContainerStyle={styles.detailScrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Profile Header Card */}
                            <View style={styles.detailHeroCard}>
                                {selectedMember?.photo ? (
                                    <Image
                                        source={{ uri: selectedMember.photo }}
                                        style={styles.detailHeroPhoto}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View style={styles.detailHeroPlaceholder}>
                                        <Ionicons name="person" size={80} color={COLORS.primary} />
                                    </View>
                                )}

                                <View style={styles.detailHeroInfo}>
                                    <Text style={styles.detailHeroName}>
                                        {selectedMember?.name}, {detailBasic?.age || selectedMember?.age} yrs
                                    </Text>
                                    <Text style={styles.detailHeroCode}>
                                        Member Code: {detailBasic?.code || selectedMember?.memberId}
                                    </Text>
                                    <View style={styles.verifiedRow}>
                                        <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                                        <Text style={styles.verifiedBadgeLabel}>Verified Account</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Basic Details Section */}
                            <View style={styles.detailSectionCard}>
                                <Text style={styles.sectionHeaderTitle}>Basic Information</Text>
                                <View style={styles.detailRowItem}>
                                    <Text style={styles.detailItemKey}>Gender:</Text>
                                    <Text style={styles.detailItemVal}>{detailBasic?.gender || "Not specified"}</Text>
                                </View>
                                <View style={styles.detailRowItem}>
                                    <Text style={styles.detailItemKey}>Date of Birth:</Text>
                                    <Text style={styles.detailItemVal}>{detailBasic?.date_of_birth || "Not specified"}</Text>
                                </View>
                                <View style={styles.detailRowItem}>
                                    <Text style={styles.detailItemKey}>Religion:</Text>
                                    <Text style={styles.detailItemVal}>{resolveName(detailBasic?.religion, lookupMaps.religions) || selectedMember?.rawReligion || "Hindu"}</Text>
                                </View>
                                <View style={styles.detailRowItem}>
                                    <Text style={styles.detailItemKey}>Caste:</Text>
                                    <Text style={styles.detailItemVal}>{resolveName(detailBasic?.caste, lookupMaps.castes) || selectedMember?.rawCaste || "Not specified"}</Text>
                                </View>
                                <View style={styles.detailRowItem}>
                                    <Text style={styles.detailItemKey}>Marital Status:</Text>
                                    <Text style={styles.detailItemVal}>{resolveName(detailBasic?.maritial_status, lookupMaps.maritalStatuses) || selectedMember?.rawMaritalStatus || "Not specified"}</Text>
                                </View>
                                <View style={styles.detailRowItem}>
                                    <Text style={styles.detailItemKey}>Children:</Text>
                                    <Text style={styles.detailItemVal}>{detailBasic?.no_of_children || "None"}</Text>
                                </View>
                            </View>

                            {/* Physical Attributes Section */}
                            {detailPhysical && (
                                <View style={styles.detailSectionCard}>
                                    <Text style={styles.sectionHeaderTitle}>Physical Attributes</Text>
                                    <View style={styles.detailRowItem}>
                                        <Text style={styles.detailItemKey}>Height:</Text>
                                        <Text style={styles.detailItemVal}>{detailPhysical.height ? `${detailPhysical.height} ft` : "Not specified"}</Text>
                                    </View>
                                    <View style={styles.detailRowItem}>
                                        <Text style={styles.detailItemKey}>Weight:</Text>
                                        <Text style={styles.detailItemVal}>{detailPhysical.weight ? `${detailPhysical.weight} kg` : "Not specified"}</Text>
                                    </View>
                                    <View style={styles.detailRowItem}>
                                        <Text style={styles.detailItemKey}>Complexion:</Text>
                                        <Text style={styles.detailItemVal}>{detailPhysical.complexion || "Not specified"}</Text>
                                    </View>
                                    <View style={styles.detailRowItem}>
                                        <Text style={styles.detailItemKey}>Blood Group:</Text>
                                        <Text style={styles.detailItemVal}>{detailPhysical.blood_group || "Not specified"}</Text>
                                    </View>
                                </View>
                            )}

                            {/* Education & Career Section */}
                            <View style={styles.detailSectionCard}>
                                <Text style={styles.sectionHeaderTitle}>Education & Career</Text>
                                {Array.isArray(detailEducation) && detailEducation.length > 0 ? (
                                    detailEducation.map((edu, idx) => (
                                        <View key={idx} style={styles.subItemBlock}>
                                            <Text style={styles.subItemTitle}>{edu.degree || "Degree"}</Text>
                                            <Text style={styles.subItemSub}>{edu.institution || "University"}</Text>
                                        </View>
                                    ))
                                ) : (
                                    <Text style={styles.emptyDetailText}>Graduate / Professional</Text>
                                )}

                                {Array.isArray(detailCareer) && detailCareer.length > 0 ? (
                                    detailCareer.map((car, idx) => (
                                        <View key={idx} style={styles.subItemBlock}>
                                            <Text style={styles.subItemTitle}>{car.designation || "Profession"}</Text>
                                            <Text style={styles.subItemSub}>{car.company || "Private Sector"}</Text>
                                        </View>
                                    ))
                                ) : null}
                            </View>

                            {/* Lifestyle Section */}
                            {detailLifestyle && (
                                <View style={styles.detailSectionCard}>
                                    <Text style={styles.sectionHeaderTitle}>Lifestyle & Values</Text>
                                    <View style={styles.detailRowItem}>
                                        <Text style={styles.detailItemKey}>Diet:</Text>
                                        <Text style={styles.detailItemVal}>{detailLifestyle.diet || "Vegetarian"}</Text>
                                    </View>
                                    <View style={styles.detailRowItem}>
                                        <Text style={styles.detailItemKey}>Drink:</Text>
                                        <Text style={styles.detailItemVal}>{detailLifestyle.drink || "No"}</Text>
                                    </View>
                                    <View style={styles.detailRowItem}>
                                        <Text style={styles.detailItemKey}>Smoke:</Text>
                                        <Text style={styles.detailItemVal}>{detailLifestyle.smoke || "No"}</Text>
                                    </View>
                                </View>
                            )}

                            {/* Spiritual Background */}
                            {detailSpiritual && (
                                <View style={styles.detailSectionCard}>
                                    <Text style={styles.sectionHeaderTitle}>Spiritual Background</Text>
                                    <View style={styles.detailRowItem}>
                                        <Text style={styles.detailItemKey}>Family Value:</Text>
                                        <Text style={styles.detailItemVal}>{detailSpiritual.family_value || "Traditional"}</Text>
                                    </View>
                                    <View style={styles.detailRowItem}>
                                        <Text style={styles.detailItemKey}>Manglik:</Text>
                                        <Text style={styles.detailItemVal}>{detailSpiritual.manglik || "No"}</Text>
                                    </View>
                                </View>
                            )}

                            {/* Partner Expectation */}
                            {detailExpectation && (
                                <View style={styles.detailSectionCard}>
                                    <Text style={styles.sectionHeaderTitle}>Partner Expectations</Text>
                                    <Text style={styles.expectationText}>
                                        {detailExpectation.general_requirement || "Looking for a compatible, educated life partner with good family values."}
                                    </Text>
                                </View>
                            )}

                            {/* Bottom CTA in Modal */}
                            <View style={styles.detailModalFooter}>
                                <TouchableOpacity
                                    style={[styles.modalInterestBtn, selectedMember && (interestSentMap[selectedMember.id] || selectedMember.interestSent) && styles.modalInterestBtnSent]}
                                    onPress={() => {
                                        if (selectedMember) handleSendInterest(selectedMember);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name={selectedMember && (interestSentMap[selectedMember.id] || selectedMember.interestSent) ? "checkmark-circle" : "heart"}
                                        size={18}
                                        color="#fff"
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={styles.modalInterestBtnText}>
                                        {selectedMember && (interestSentMap[selectedMember.id] || selectedMember.interestSent) ? "Interest Sent" : "Express Interest"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    )}
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    headerTopRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    headerTitleGroup: {
        flex: 1,
    },
    titleWithBadge: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
    },
    title: {
        fontSize: 22,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        letterSpacing: -0.3,
    },
    livePulseContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ECFDF5",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#A7F3D0",
    },
    pulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#10B981",
        marginRight: 4,
    },
    livePulseText: {
        fontSize: 11,
        fontFamily: FONTS.semiBold,
        color: "#059669",
    },
    subtitle: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginTop: 2,
    },
    genderHighlight: {
        fontFamily: FONTS.semiBold,
        color: COLORS.primary,
    },
    filterButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    filterButtonActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    filterBadge: {
        position: "absolute",
        top: -4,
        right: -4,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "#10B981",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: "#fff",
    },
    filterBadgeText: {
        fontSize: 10,
        fontFamily: FONTS.bold,
        color: "#fff",
    },
    searchBarContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 42,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
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
    scroll: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    resultsHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    matchTagPill: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#FBCFE8",
        gap: 6,
    },
    matchTagText: {
        fontSize: 12,
        fontFamily: FONTS.semiBold,
        color: COLORS.primary,
    },
    clearFilterLink: {
        fontSize: 12,
        fontFamily: FONTS.semiBold,
        color: COLORS.primary,
        textDecorationLine: "underline",
    },
    loadingContainer: {
        paddingVertical: 60,
        alignItems: "center",
        justifyContent: "center",
    },
    loadingText: {
        marginTop: 12,
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.textLight,
    },
    emptyContainer: {
        paddingVertical: 50,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
        borderRadius: 18,
        paddingHorizontal: 24,
        marginTop: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    emptyIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "#FFF1F2",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
    },
    emptyTitle: {
        fontSize: 17,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        marginBottom: 6,
        textAlign: "center",
    },
    emptySubtitle: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        textAlign: "center",
        lineHeight: 19,
        marginBottom: 18,
    },
    refreshEmptyBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.primary,
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
    },
    refreshEmptyBtnText: {
        fontSize: 13,
        fontFamily: FONTS.semiBold,
        color: "#fff",
    },

    /* Card Styling */
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#F1E8E2",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    photoContainer: {
        width: "100%",
        height: 230,
        backgroundColor: "#FFF1F2",
        position: "relative",
    },
    cardPhoto: {
        width: "100%",
        height: "100%",
    },
    photoFallback: {
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FCE7F3",
    },
    photoOverlayTop: {
        position: "absolute",
        top: 10,
        left: 10,
        right: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    planBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    planPremium: {
        backgroundColor: "#E11D48",
    },
    planFree: {
        backgroundColor: "rgba(0,0,0,0.55)",
    },
    planBadgeText: {
        fontSize: 10,
        fontFamily: FONTS.bold,
        color: "#fff",
        textTransform: "uppercase",
    },
    onlineBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    onlineDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#10B981",
        marginRight: 4,
    },
    onlineBadgeText: {
        fontSize: 10,
        fontFamily: FONTS.semiBold,
        color: "#fff",
    },
    photoOverlayBottom: {
        position: "absolute",
        bottom: 10,
        left: 10,
        right: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    verifiedBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#15803D",
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 3,
    },
    verifiedText: {
        fontSize: 10,
        fontFamily: FONTS.semiBold,
        color: "#fff",
    },
    memberIdBadge: {
        backgroundColor: "rgba(255,255,255,0.92)",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    memberIdText: {
        fontSize: 10,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    cardBody: {
        padding: 14,
    },
    nameRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    cardName: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    cardAge: {
        fontSize: 14,
        fontFamily: FONTS.medium,
        color: COLORS.textLight,
    },
    reportBadgeBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: "#FEF2F2",
        borderWidth: 1,
        borderColor: "#FECACA",
        gap: 3,
    },
    reportBadgeText: {
        fontSize: 11,
        fontFamily: FONTS.semiBold,
        color: "#DC2626",
    },
    chipsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 10,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FAF5F2",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#F1E8E2",
        gap: 4,
    },
    chipText: {
        fontSize: 11,
        fontFamily: FONTS.medium,
        color: "#475569",
    },
    cardDivider: {
        height: 1,
        backgroundColor: "#F1E8E2",
        marginVertical: 10,
    },

    /* 4-Button Clean Grid Layout */
    cardActionGrid: {
        gap: 8,
    },
    actionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    primaryActionBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 38,
        borderRadius: 10,
        borderWidth: 1,
    },
    secondaryActionBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 36,
        borderRadius: 10,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    btnIcon: {
        marginRight: 5,
    },
    btnText: {
        fontSize: 12.5,
        fontFamily: FONTS.semiBold,
    },
    interestBtnActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    interestBtnSent: {
        backgroundColor: "#F0FDF4",
        borderColor: "#BBF7D0",
    },
    interestTextActive: {
        color: "#fff",
    },
    interestTextSent: {
        color: "#15803D",
    },
    viewProfileBtn: {
        backgroundColor: "#fff",
        borderColor: "#FBCFE8",
    },
    viewProfileText: {
        color: COLORS.primary,
    },
    shortlistBtnActive: {
        backgroundColor: "#FEF3C7",
        borderColor: "#FCD34D",
    },
    shortlistTextActive: {
        color: "#B45309",
    },
    secondaryBtnText: {
        color: "#475569",
    },
    ignoreBtn: {
        backgroundColor: "#F8FAFC",
        borderColor: "#E2E8F0",
    },

    /* Responsive Centered Pagination (Never out of bounds) */
    paginationCard: {
        backgroundColor: "#fff",
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        marginTop: 6,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#F1E8E2",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    paginationInfoText: {
        fontSize: 11.5,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginBottom: 8,
    },
    paginationInfoBold: {
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    paginationRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
        flexWrap: "nowrap",
        gap: 3,
    },
    navPageBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 7,
        height: 30,
        borderRadius: 7,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    navPageBtnDisabled: {
        backgroundColor: "#F1F5F9",
        borderColor: "#E2E8F0",
        opacity: 0.6,
    },
    navPageBtnText: {
        fontSize: 11.5,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
        marginHorizontal: 2,
    },
    navPageBtnTextDisabled: {
        color: "#94A3B8",
    },
    pagePillsGroup: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
    },
    pageNumberBtn: {
        minWidth: 28,
        height: 28,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        paddingHorizontal: 3,
    },
    pageNumberBtnActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    pageNumberText: {
        fontSize: 11.5,
        fontFamily: FONTS.semiBold,
        color: "#334155",
    },
    pageNumberTextActive: {
        color: "#fff",
    },
    ellipsisWrap: {
        width: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    ellipsisText: {
        fontSize: 10,
        color: "#94A3B8",
        letterSpacing: 0.5,
    },

    /* Filter Modal */
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "flex-end",
    },
    modalContainer: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: "85%",
        paddingTop: 16,
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F1E8E2",
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    modalSubtitle: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginTop: 2,
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalScroll: {
        paddingHorizontal: 20,
    },
    modalScrollContent: {
        paddingVertical: 14,
        paddingBottom: 30,
    },
    filterSectionTitle: {
        fontSize: 13.5,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        marginTop: 12,
        marginBottom: 8,
    },
    optionRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 6,
    },
    optionPill: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: "#FAF5F2",
        borderWidth: 1,
        borderColor: "#EAE0DA",
    },
    optionPillActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    optionPillText: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: COLORS.text,
    },
    optionPillTextActive: {
        color: "#fff",
        fontFamily: FONTS.bold,
    },
    inputRangeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    rangeInput: {
        flex: 1,
        height: 40,
        backgroundColor: "#FAF5F2",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#EAE0DA",
        paddingHorizontal: 12,
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.text,
    },
    rangeSeparator: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.textLight,
    },
    filterTextInput: {
        height: 40,
        backgroundColor: "#FAF5F2",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#EAE0DA",
        paddingHorizontal: 12,
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.text,
        marginBottom: 10,
    },
    modalFooter: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: "#F1E8E2",
        gap: 12,
        backgroundColor: "#fff",
    },
    modalResetBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: "#FAF5F2",
        borderWidth: 1,
        borderColor: "#EAE0DA",
        alignItems: "center",
        justifyContent: "center",
    },
    modalResetBtnText: {
        fontSize: 14,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
    },
    modalApplyBtn: {
        flex: 2,
        height: 44,
        borderRadius: 12,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    modalApplyBtnText: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        color: "#fff",
    },

    /* Full Profile Modal */
    modalDetailSafe: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    detailNavRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    detailBackBtn: {
        padding: 4,
    },
    detailNavTitle: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    detailFlagBtn: {
        padding: 4,
    },
    detailLoadingCenter: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    detailLoadingText: {
        marginTop: 12,
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.textLight,
    },
    detailScrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    detailHeroCard: {
        backgroundColor: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 16,
    },
    detailHeroPhoto: {
        width: "100%",
        height: 260,
    },
    detailHeroPlaceholder: {
        width: "100%",
        height: 220,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFF1F2",
    },
    detailHeroInfo: {
        padding: 16,
    },
    detailHeroName: {
        fontSize: 18,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        marginBottom: 4,
    },
    detailHeroCode: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: COLORS.textLight,
        marginBottom: 8,
    },
    verifiedRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    verifiedBadgeLabel: {
        fontSize: 12,
        fontFamily: FONTS.semiBold,
        color: "#15803D",
    },
    detailSectionCard: {
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 14,
    },
    sectionHeaderTitle: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        paddingBottom: 6,
    },
    detailRowItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 5,
    },
    detailItemKey: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.textLight,
    },
    detailItemVal: {
        fontSize: 13,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
    },
    subItemBlock: {
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: "#F8FAFC",
    },
    subItemTitle: {
        fontSize: 13,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
    },
    subItemSub: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
    },
    emptyDetailText: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        fontStyle: "italic",
    },
    expectationText: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: "#334155",
        lineHeight: 19,
    },
    detailModalFooter: {
        marginTop: 10,
    },
    modalInterestBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.primary,
        height: 46,
        borderRadius: 12,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 3,
    },
    modalInterestBtnSent: {
        backgroundColor: "#15803D",
        shadowColor: "#15803D",
    },
    modalInterestBtnText: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        color: "#fff",
    },
});
