import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Image,
    ActivityIndicator,
    RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenHeader from "../components/ScreenHeader";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { useAuth } from "../contexts/AuthContext";
import profileService from "../services/profileService";
import { COLORS, FONTS } from "../theme";

const ACCOUNT_ITEMS = [
    { label: "Edit / Manage Profile", icon: "📝", route: "EditProfile" },
    { label: "Gallery", icon: "🖼️", route: "Gallery" },
    { label: "Packages", icon: "💎", route: "Packages" },
    { label: "Ignored User List", icon: "🚫", route: "IgnoredUsers" },
    { label: "Profile Viewer", icon: "👁️", route: "ProfileViewer" },
];

const SECURITY_ITEMS = [
    { label: "Change Password", icon: "🔑", route: "ChangePassword" },
];

const DANGER_ITEMS = [
    { label: "Deactivate Account", icon: "⏸️", route: "DeactivateAccount" },
    { label: "Delete Account", icon: "🗑️", route: "DeleteAccount", destructive: true },
];

function MenuRow({ item, isLast, onPress }) {
    const destructive = item.destructive;
    return (
        <TouchableOpacity
            style={[styles.item, !isLast && styles.itemBorder]}
            onPress={onPress}
            activeOpacity={0.6}
        >
            <View style={[styles.itemIconWrap, destructive && { backgroundColor: COLORS.dangerSoft }]}>
                <Text style={styles.itemIcon}>{item.icon}</Text>
            </View>
            <Text style={[styles.itemLabel, destructive && { color: COLORS.danger }]}>{item.label}</Text>
            <Text style={[styles.itemChevron, destructive && { color: COLORS.danger }]}>›</Text>
        </TouchableOpacity>
    );
}

function Section({ title, children }) {
    return (
        <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.listCard}>{children}</View>
        </View>
    );
}

export default function ProfileScreen({ navigation }) {
    const { user, token, logout } = useAuth();
    const [profileData, setProfileData] = useState(null);
    const [emailUnverified, setEmailUnverified] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const userId = user?.id;
        if (!userId || !token) return;

        (async () => {
            try {
                const response = await profileService.getProfile(userId, token);
                if (isMounted && response && response.result !== false && response.data) {
                    setProfileData(response.data);
                    setEmailUnverified(false);
                }
            } catch (err) {
                if (/not verified/i.test(err?.message)) {
                    if (isMounted) setEmailUnverified(true);
                    console.log("Profile: Account email pending verification.");
                } else {
                    console.log("Could not fetch profile data:", err.message);
                }
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [user?.id, token]);

    const onRefresh = useCallback(async () => {
        const userId = user?.id;
        if (!userId || !token) return;

        setRefreshing(true);
        try {
            const response = await profileService.getProfile(userId, token);
            if (response && response.result !== false && response.data) {
                setProfileData(response.data);
                setEmailUnverified(false);
            }
        } catch (err) {
            if (/not verified/i.test(err?.message)) {
                setEmailUnverified(true);
                console.log("Profile: Account email pending verification.");
            } else {
                console.log("Could not refresh profile data:", err.message);
            }
        } finally {
            setRefreshing(false);
        }
    }, [user?.id, token]);

    const handleNavigate = (route) => {
        if (route === "ManageProfile" || route === "EditProfile") {
            return navigation.navigate("EditProfile");
        }
        if (route === "DeleteAccount") {
            return navigation.navigate("DeleteAccount");
        }
        if (navigation?.navigate) {
            try {
                navigation.navigate(route);
            } catch {
                Alert.alert("Coming soon", `${route} screen is not available yet.`);
            }
        }
    };


    const handleLogout = () => {
        Alert.alert(
            "Sign Out",
            "Are you sure you want to sign out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: async () => {
                        setLoggingOut(true);
                        try {
                            await logout();
                        } finally {
                            setLoggingOut(false);
                            navigation.replace("Login");
                        }
                    },
                },
            ]
        );
    };

    const onMenuPress = (item) => {
        if (item.route === "DeleteAccount") {
            return navigation.navigate("DeleteAccount");
        }
        return handleNavigate(item.route);
    };

    // Extract dynamic fields from profileData or fallback to user
    const basicInfo = profileData?.basic_info;
    const contactDetails = profileData?.contact_details;

    const fullName = basicInfo
        ? `${basicInfo.firs_name || ""} ${basicInfo.last_name || ""}`.trim()
        : user?.name || "Member Profile";

    const memberCode = basicInfo?.code;
    const memberAge = basicInfo?.age;
    const memberGender = basicInfo?.gender;
    const onBehalfName = basicInfo?.onbehalf?.name;

    const userInitial = fullName.charAt(0).toUpperCase() || "M";
    const userPhoto = basicInfo?.photo || user?.avatar_original || user?.avatar || null;
    const userPhone = contactDetails?.phone || user?.phone || "";
    const userEmail = contactDetails?.email || user?.email || "";
    const planName = user?.membership ? "Premium Member" : "Free Plan";

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            {/* ---------- STICKY HEADER ---------- */}
            <ScreenHeader>
                <View style={styles.headerRow}>
                    <Text style={styles.headerTitle}>My Profile</Text>
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
                                Please verify your email on hindumatrimony.org.in to unlock your full profile details and gallery.
                            </Text>
                        </View>
                    </View>
                )}

                <View style={styles.profileCard}>
                    <View style={styles.avatarWrap}>
                        {userPhoto ? (
                            <Image source={{ uri: userPhoto }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{userInitial}</Text>
                            </View>
                        )}
                        <TouchableOpacity
                            style={styles.avatarEditBtn}
                            onPress={() => navigation.navigate("EditProfile")}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.avatarEditIcon}>📷</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.name}>{fullName}</Text>

                    {memberCode ? (
                        <View style={styles.codeBadge}>
                            <Text style={styles.codeText}>ID: {memberCode}</Text>
                        </View>
                    ) : null}

                    {memberAge || memberGender ? (
                        <Text style={styles.meta}>
                            {[memberAge ? `${memberAge} yrs` : null, memberGender]
                                .filter(Boolean)
                                .join(" • ")}
                        </Text>
                    ) : (
                        <Text style={styles.meta}>{userEmail || userPhone || "Welcome"}</Text>
                    )}

                    <View style={styles.badgeRow}>
                        <View style={styles.planBadge}>
                            <Text style={styles.planBadgeText}>{planName}</Text>
                        </View>
                        {onBehalfName ? (
                            <View style={styles.onBehalfBadge}>
                                <Text style={styles.onBehalfBadgeText}>
                                    For {onBehalfName}
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    <TouchableOpacity
                        style={styles.editProfileBtn}
                        onPress={() => navigation.navigate("EditProfile")}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.editProfileBtnText}>Edit Profile</Text>
                    </TouchableOpacity>
                </View>

                {/* Profile Overview Card if available */}
                {(userEmail || userPhone) ? (
                    <View style={styles.overviewCard}>
                        <Text style={styles.overviewTitle}>Contact Information</Text>
                        {userEmail ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Email</Text>
                                <Text style={styles.overviewValue}>{userEmail}</Text>
                            </View>
                        ) : null}
                        {userPhone ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Phone</Text>
                                <Text style={styles.overviewValue}>{userPhone}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                <Section title="Account">
                    {ACCOUNT_ITEMS.map((item, i) => (
                        <MenuRow
                            key={item.label}
                            item={item}
                            isLast={i === ACCOUNT_ITEMS.length - 1}
                            onPress={() => onMenuPress(item)}
                        />
                    ))}
                </Section>

                <Section title="Security">
                    {SECURITY_ITEMS.map((item, i) => (
                        <MenuRow
                            key={item.label}
                            item={item}
                            isLast={i === SECURITY_ITEMS.length - 1}
                            onPress={() => onMenuPress(item)}
                        />
                    ))}
                </Section>

                <Section title="Danger Zone">
                    {DANGER_ITEMS.map((item, i) => (
                        <MenuRow
                            key={item.label}
                            item={item}
                            isLast={i === DANGER_ITEMS.length - 1}
                            onPress={() => onMenuPress(item)}
                        />
                    ))}
                </Section>

                <TouchableOpacity
                    style={[styles.logoutBtn, loggingOut && { opacity: 0.7 }]}
                    onPress={handleLogout}
                    disabled={loggingOut}
                    activeOpacity={0.85}
                >
                    {loggingOut ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.logoutText}>Sign Out</Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.versionText}>App version 1.0.0</Text>
            </KeyboardAwareScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },

    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerTitle: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text },

    scroll: { padding: 20, paddingBottom: 40 },

    profileCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: "center",
        paddingVertical: 24,
        paddingHorizontal: 16,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    avatarWrap: { position: "relative", marginBottom: 12 },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: COLORS.primarySoft,
    },
    avatarImage: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 3,
        borderColor: COLORS.primarySoft,
    },
    avatarText: { color: "#fff", fontSize: 38, fontFamily: FONTS.bold },
    avatarEditBtn: {
        position: "absolute",
        bottom: 0,
        right: 0,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarEditIcon: { fontSize: 14 },
    name: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text },
    codeBadge: {
        backgroundColor: "#F0EEEC",
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
        marginTop: 4,
    },
    codeText: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: COLORS.textLight,
    },
    meta: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textLight, marginTop: 4 },
    badgeRow: { flexDirection: "row", marginTop: 10, gap: 8 },
    planBadge: {
        backgroundColor: COLORS.primarySoft,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    planBadgeText: { fontSize: 11, fontFamily: FONTS.semiBold, color: COLORS.primary },
    onBehalfBadge: {
        backgroundColor: "#E8F4FD",
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    onBehalfBadgeText: { fontSize: 11, fontFamily: FONTS.semiBold, color: "#1976D2" },
    editProfileBtn: {
        marginTop: 16,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        borderRadius: 10,
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    editProfileBtnText: { color: COLORS.primary, fontFamily: FONTS.semiBold, fontSize: 13 },

    overviewCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    overviewTitle: {
        fontSize: 13,
        fontFamily: FONTS.semiBold,
        color: COLORS.textLight,
        marginBottom: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    overviewRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6,
    },
    overviewLabel: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
    },
    overviewValue: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.text,
    },

    sectionWrap: { marginBottom: 20 },
    sectionTitle: {
        fontSize: 13,
        fontFamily: FONTS.semiBold,
        color: COLORS.textLight,
        marginBottom: 8,
        marginLeft: 4,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    listCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: "hidden",
    },
    item: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14 },
    itemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
    itemIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    itemIcon: { fontSize: 16 },
    itemLabel: { flex: 1, fontSize: 14, fontFamily: FONTS.medium, color: COLORS.text },
    itemChevron: { fontSize: 20, color: COLORS.textLight },

    logoutBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 4,
        minHeight: 52,
    },
    logoutText: { color: "#fff", fontFamily: FONTS.semiBold, fontSize: 15 },
    versionText: {
        textAlign: "center",
        color: COLORS.textLight,
        fontFamily: FONTS.regular,
        fontSize: 11,
        marginTop: 16,
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
