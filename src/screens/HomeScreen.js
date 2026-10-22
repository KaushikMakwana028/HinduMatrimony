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
import { COLORS, FONTS } from "../theme";

export default function HomeScreen({ navigation }) {
    const { user, token } = useAuth();
    const [dashboardData, setDashboardData] = useState(null);
    const [emailUnverified, setEmailUnverified] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        let isMounted = true;
        if (!token) return;

        (async () => {
            try {
                const response = await homeService.getDashboardData(token);
                if (isMounted && response && response.result !== false && response.data) {
                    setDashboardData(response.data);
                    setEmailUnverified(false);
                }
            } catch (err) {
                if (/not verified/i.test(err?.message)) {
                    if (isMounted) setEmailUnverified(true);
                    console.log("Dashboard: Account email pending verification.");
                } else {
                    console.log("Could not fetch dashboard data:", err.message);
                }
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [token]);

    const onRefresh = useCallback(async () => {
        if (!token) return;
        setRefreshing(true);
        try {
            const response = await homeService.getDashboardData(token);
            if (response && response.result !== false && response.data) {
                setDashboardData(response.data);
                setEmailUnverified(false);
            }
        } catch (err) {
            if (/not verified/i.test(err?.message)) {
                setEmailUnverified(true);
                console.log("Dashboard: Account email pending verification.");
            } else {
                console.log("Could not refresh dashboard data:", err.message);
            }
        } finally {
            setRefreshing(false);
        }
    }, [token]);

    // Extract dynamic fields with fallback
    const rawName = dashboardData?.member_name || user?.name || "Welcome back";
    const firstName = rawName.split(" ")[0];
    const initial = rawName.charAt(0).toUpperCase() || "A";
    const memberPhoto = dashboardData?.member_photo || user?.avatar_original || user?.avatar;

    const packageInfo = dashboardData?.current_package_info;
    const packageName = packageInfo?.package_name || (user?.membership ? "Premium Member" : "Free Member");
    const packageExpiry = packageInfo?.package_expiry;

    const remainingInterest = dashboardData?.remaining_interest !== undefined
        ? dashboardData.remaining_interest
        : 25;

    const remainingContact = dashboardData?.remaining_contact_view !== undefined
        ? dashboardData.remaining_contact_view
        : 10;

    const remainingGallery = dashboardData?.remaining_photo_gallery !== undefined
        ? dashboardData.remaining_photo_gallery
        : 5;

    const remainingProfileView = (dashboardData?.remaining_profile_image_view !== undefined && dashboardData.remaining_profile_image_view !== "")
        ? dashboardData.remaining_profile_image_view
        : (dashboardData?.remaining_gallery_image_view !== undefined && dashboardData.remaining_gallery_image_view !== ""
            ? dashboardData.remaining_gallery_image_view
            : 15);

    const stats = [
        {
            key: "interest",
            label: "Remaining Interest",
            value: remainingInterest,
            icon: "💖",
            subtitle: "Interests you can send",
        },
        {
            key: "contact",
            label: "Remaining Contact View",
            value: remainingContact,
            icon: "📞",
            subtitle: "Contacts you can view",
        },
        {
            key: "profileViewer",
            label: "Remaining Profile Viewer",
            value: remainingProfileView,
            icon: "👁️",
            subtitle: "Profiles you can view",
        },
        {
            key: "gallery",
            label: "Remaining Gallery Upload",
            value: remainingGallery,
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
                        {memberPhoto ? (
                            <Image source={{ uri: memberPhoto }} style={styles.avatarImg} />
                        ) : (
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{initial}</Text>
                            </View>
                        )}
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
                    <TouchableOpacity style={styles.promoBtn} activeOpacity={0.85}>
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
    avatar: {
        width: "100%",
        height: "100%",
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarImg: {
        width: "100%",
        height: "100%",
    },
    avatarText: { color: "#fff", fontSize: 17, fontFamily: FONTS.bold },

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
