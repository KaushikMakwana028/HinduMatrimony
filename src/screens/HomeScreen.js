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
import ScreenHeader from "../components/ScreenHeader";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { useAuth } from "../contexts/AuthContext";
import homeService from "../services/homeService";
import planService from "../services/planService";
import { subscribeMemberAction } from "../services/memberEvents";
import { COLORS, FONTS, DEFAULT_AVATAR } from "../theme";

// Returns the first usable value; treats undefined, null and "" as missing
const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== "");

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
    }, [token, user?.id]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        loadData().finally(() => {
            if (active) setLoading(false);
        });
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
            if (event?.type === "contact_viewed" && event?.remainingContacts !== undefined) {
                setPlanInfo((prev) => (prev ? { ...prev, remainingContacts: event.remainingContacts } : prev));
                setDashboardData((prev) => (prev ? { ...prev, remaining_contact_view: event.remainingContacts } : prev));
            }
            if ((event?.type === "profile_updated" || event?.type === "profile_photo_updated") && event?.photo) {
                setDashboardData((prev) => (prev ? { ...prev, member_photo: event.photo } : prev));
            }
        });
        return () => unsub();
    }, []);

    // "…" while loading, "—" when the API has no value
    const show = (v) => (v === undefined ? (loading ? "…" : "—") : v);

    // ---------- Derived fields ----------
    const rawName = pick(dashboardData?.member_name, user?.name) || "Welcome back";
    const firstName = String(rawName).split(" ")[0];
    const memberPhoto = pick(dashboardData?.member_photo, user?.avatar_original, user?.avatar);

    const packageInfo = dashboardData?.current_package_info;
    const packageName =
        pick(packageInfo?.package_name, planInfo?.name) || (loading ? "Loading…" : "Free Package");
    const packageExpiry = packageInfo?.package_expiry;

    const remainingInterest = pick(dashboardData?.remaining_interest, planInfo?.remainingInterests);
    const remainingContact = pick(dashboardData?.remaining_contact_view, planInfo?.remainingContacts);
    const remainingGallery = pick(dashboardData?.remaining_photo_gallery, planInfo?.maxGallery);
    const remainingProfileView = pick(
        dashboardData?.remaining_profile_viewer_view
    );

    const stats = [
        {
            key: "interest",
            label: "Remaining Interest",
            value: show(remainingInterest),
            icon: "💖",
            subtitle: "Interests you can send",
        },
        {
            key: "contact",
            label: "Remaining Contact View",
            value: show(remainingContact),
            icon: "📞",
            subtitle: "Contacts you can view",
        },
        {
            key: "profileViewer",
            label: "Remaining Profile Viewer",
            value: show(remainingProfileView),
            icon: "👁️",
            subtitle: "Profiles you can view",
        },
        {
            key: "gallery",
            label: "Remaining Gallery Upload",
            value: show(remainingGallery),
            icon: "🖼️",
            subtitle: "Gallery images to upload",
        },
    ];

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            {/* ---------- STICKY HEADER ---------- */}
            <ScreenHeader>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.greeting}>Namaste 🙏</Text>
                        <Text style={styles.name}>{firstName}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.avatarWrap}
                        onPress={() => navigation.navigate("Profile")}
                        activeOpacity={0.8}
                    >
                        <Image
                            source={{ uri: memberPhoto || DEFAULT_AVATAR }}
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
                            <Text style={styles.verificationIcon}>✉️</Text>
                        </View>
                        <View style={styles.verificationTextWrap}>
                            <Text style={styles.verificationTitle}>Email Verification Pending</Text>
                            <Text style={styles.verificationSubtitle}>
                                Please verify your email on hindumatrimony.org.in to unlock live statistics and premium dashboard features.
                            </Text>
                        </View>
                    </View>
                )}

                {/* Active Package Banner */}
                <View style={styles.packageBanner}>
                    <View style={styles.packageBadge}>
                        <Text style={styles.packageBadgeText}>Active Plan</Text>
                    </View>
                    <Text style={styles.packageNameText}>{packageName}</Text>
                    {packageExpiry ? (
                        <Text style={styles.packageExpiryText}>
                            Valid until {packageExpiry}
                        </Text>
                    ) : null}
                </View>

                <Text style={styles.sectionTitle}>Your Plan Usage</Text>
                <Text style={styles.sectionSubtitle}>
                    {"Track what's left in your current membership"}
                </Text>

                <View style={styles.statsGrid}>
                    {stats.map((stat) => (
                        <View key={stat.key} style={styles.statCard}>
                            <View style={styles.statIconWrap}>
                                <Text style={styles.statIcon}>{stat.icon}</Text>
                            </View>
                            <Text style={styles.statValue}>{stat.value}</Text>
                            <Text style={styles.statLabel}>{stat.label}</Text>
                            <Text style={styles.statSubtitle}>{stat.subtitle}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.promoCard}>
                    <Text style={styles.promoTitle}>Upgrade your plan</Text>
                    <Text style={styles.promoSubtitle}>
                        Get more interests, contacts and gallery uploads.
                    </Text>
                    <TouchableOpacity
                        style={styles.promoBtn}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate("Packages")}
                    >
                        <Text style={styles.promoBtnText}>View Plans</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAwareScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },

    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    greeting: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textLight },
    name: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text, marginTop: 2 },
    avatarWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: COLORS.primarySoft,
    },
    avatarImg: {
        width: "100%",
        height: "100%",
    },

    scroll: { padding: 20, paddingBottom: 40 },

    packageBanner: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    packageBadge: {
        alignSelf: "flex-start",
        backgroundColor: COLORS.primarySoft,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 8,
    },
    packageBadgeText: {
        fontSize: 11,
        fontFamily: FONTS.semiBold,
        color: COLORS.primary,
    },
    packageNameText: {
        fontSize: 17,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    packageExpiryText: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginTop: 4,
    },

    sectionTitle: {
        fontSize: 18,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginBottom: 16,
    },

    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    statCard: {
        width: "48%",
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    statIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
    },
    statIcon: { fontSize: 20 },
    statValue: {
        fontSize: 26,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
        lineHeight: 30,
    },
    statLabel: {
        fontSize: 13,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
        marginTop: 4,
    },
    statSubtitle: {
        fontSize: 11,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginTop: 2,
    },

    promoCard: {
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        padding: 20,
        marginTop: 8,
    },
    promoTitle: {
        color: "#fff",
        fontSize: 18,
        fontFamily: FONTS.semiBold,
        marginBottom: 6,
    },
    promoSubtitle: {
        color: "#FFE6EF",
        fontSize: 13,
        fontFamily: FONTS.regular,
        marginBottom: 14,
        lineHeight: 20,
    },
    promoBtn: {
        backgroundColor: "#fff",
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
        alignSelf: "flex-start",
    },
    promoBtnText: {
        color: COLORS.primary,
        fontSize: 14,
        fontFamily: FONTS.semiBold,
    },
    verificationBanner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF9E6",
        borderWidth: 1,
        borderColor: "#FFE082",
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
    },
    verificationIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#FFF0B3",
        alignItems: "center",
        justifyContent: "center",
    },
    verificationIcon: { fontSize: 18 },
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
});