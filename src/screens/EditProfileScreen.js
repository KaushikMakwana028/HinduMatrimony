import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenHeader from "../components/ScreenHeader";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { useAuth } from "../contexts/AuthContext";
import profileService from "../services/profileService";
import { COLORS, FONTS } from "../theme";

export default function EditProfileScreen({ navigation }) {
    const { user, token } = useAuth();

    const [expandedSection, setExpandedSection] = useState("personal");
    const [loading, setLoading] = useState(false);
    const [memberCode, setMemberCode] = useState(user?.code || "");

    const [profile, setProfile] = useState(() => {
        const parts = (user?.name || "").split(" ");
        return {
            firstName: parts[0] || "",
            lastName: parts.slice(1).join(" ") || "",
            email: user?.email || "",
            phone: user?.phone || "",
            gender: user?.gender || "",
            age: "",
            dob: "",
            maritalStatus: "",
            religion: "",
            caste: "",
            location: "",
        };
    });

    // Load actual server profile data
    useEffect(() => {
        let isMounted = true;
        const userId = user?.id;

        if (!userId || !token) return;

        (async () => {
            setLoading(true);
            try {
                const response = await profileService.getProfile(userId, token);
                if (isMounted && response?.data) {
                    const d = response.data;
                    const b = d.basic_info;

                    if (b) {
                        setProfile((prev) => ({
                            ...prev,
                            firstName: b.firs_name || prev.firstName,
                            lastName: b.last_name || prev.lastName,
                            gender: b.gender || prev.gender,
                            age: b.age ? String(b.age) : prev.age,
                            dob: b.date_of_birth || prev.dob,
                            phone: b.phone || prev.phone,
                            maritalStatus: b.maritial_status || prev.maritalStatus,
                            religion: b.religion || prev.religion,
                            caste: b.caste || prev.caste,
                        }));

                        if (b.code) {
                            setMemberCode(String(b.code));
                        }
                    }

                    if (d.contact_details) {
                        setProfile((prev) => ({
                            ...prev,
                            email: d.contact_details.email || prev.email,
                            phone: d.contact_details.phone || prev.phone,
                        }));
                    }
                }
            } catch (err) {
                console.log("EditProfile fetch note:", err.message);
            } finally {
                if (isMounted) setLoading(false);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [user, token]);

    const toggleSection = (sec) => {
        setExpandedSection((curr) => (curr === sec ? null : sec));
    };

    const fullName = `${profile.firstName} ${profile.lastName}`.trim() || user?.name || "Member Profile";
    const userEmail = profile.email || user?.email || "";
    const userPhone = profile.phone || user?.phone || "";
    const userAvatar = user?.avatar_original || user?.avatar || null;
    const userInitial = fullName.charAt(0).toUpperCase() || "M";

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            <ScreenHeader>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.backText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <View style={{ width: 38 }} />
                </View>
            </ScreenHeader>

            <KeyboardAwareScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={true}
            >
                {/* Top Summary Card (Matching design reference) */}
                <View style={styles.userCard}>
                    <View style={styles.userCardTop}>
                        <View style={styles.avatarWrap}>
                            {userAvatar ? (
                                <Image source={{ uri: userAvatar }} style={styles.avatarImg} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Text style={styles.avatarInitial}>{userInitial}</Text>
                                </View>
                            )}
                            <View style={styles.cameraIconWrap}>
                                <Text style={styles.cameraIcon}>📷</Text>
                            </View>
                        </View>

                        <View style={styles.userInfoCol}>
                            <Text style={styles.userName}>{fullName}</Text>
                            {userEmail ? <Text style={styles.userEmail}>{userEmail}</Text> : null}
                            {userPhone ? <Text style={styles.userPhone}>{userPhone}</Text> : null}
                            {memberCode ? (
                                <View style={styles.badgePill}>
                                    <Text style={styles.badgeText}>🎁 {memberCode}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Progress Bar */}
                    <View style={styles.progressRow}>
                        <Text style={styles.progressLabel}>Overall Profile Completion</Text>
                        <Text style={styles.progressPercent}>
                            {profile.firstName && profile.gender ? "80%" : "50%"}
                        </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                        <View
                            style={[
                                styles.progressBarFill,
                                { width: profile.firstName && profile.gender ? "80%" : "50%" },
                            ]}
                        />
                    </View>

                    <View style={styles.tagRow}>
                        <Text style={styles.tagItem}>✔ Personal</Text>
                        <Text style={styles.tagItem}>✔ Contact</Text>
                        <Text style={styles.tagItem}>✔ Verification</Text>
                    </View>
                </View>

                {loading && (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator color={COLORS.primary} size="small" />
                        <Text style={styles.loadingText}>Loading details...</Text>
                    </View>
                )}

                {/* 1. Personal Details Accordion */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("personal")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#FFE8EE" }]}>
                            <Text style={styles.sectionIcon}>👤</Text>
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Personal Details</Text>
                            <Text style={styles.sectionStatus}>✔ Completed</Text>
                        </View>
                        <View style={styles.badgePillCompleted}>
                            <Text style={styles.badgePillCompletedText}>5/5</Text>
                        </View>
                        <Text style={styles.accordionChevron}>{expandedSection === "personal" ? "▴" : "▾"}</Text>
                    </TouchableOpacity>

                    {expandedSection === "personal" && (
                        <View style={styles.accordionBody}>
                            <Text style={styles.inputLabel}>First Name</Text>
                            <TextInput
                                style={styles.input}
                                value={profile.firstName}
                                onChangeText={(t) => setProfile((p) => ({ ...p, firstName: t }))}
                                placeholder="First Name"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <Text style={styles.inputLabel}>Last Name</Text>
                            <TextInput
                                style={styles.input}
                                value={profile.lastName}
                                onChangeText={(t) => setProfile((p) => ({ ...p, lastName: t }))}
                                placeholder="Last Name"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <Text style={styles.inputLabel}>Gender</Text>
                            <TextInput
                                style={styles.input}
                                value={profile.gender}
                                onChangeText={(t) => setProfile((p) => ({ ...p, gender: t }))}
                                placeholder="e.g. Male / Female"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <Text style={styles.inputLabel}>Date of Birth</Text>
                            <TextInput
                                style={styles.input}
                                value={profile.dob}
                                onChangeText={(t) => setProfile((p) => ({ ...p, dob: t }))}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <Text style={styles.inputLabel}>Marital Status</Text>
                            <TextInput
                                style={styles.input}
                                value={profile.maritalStatus}
                                onChangeText={(t) => setProfile((p) => ({ ...p, maritalStatus: t }))}
                                placeholder="e.g. Never Married"
                                placeholderTextColor={COLORS.textLight}
                            />
                        </View>
                    )}
                </View>

                {/* 2. Contact Details Accordion */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("contact")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#EBF9F5" }]}>
                            <Text style={styles.sectionIcon}>📞</Text>
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Contact Information</Text>
                            <Text style={styles.sectionStatus}>✔ Completed</Text>
                        </View>
                        <View style={styles.badgePillCompleted}>
                            <Text style={styles.badgePillCompletedText}>2/2</Text>
                        </View>
                        <Text style={styles.accordionChevron}>{expandedSection === "contact" ? "▴" : "▾"}</Text>
                    </TouchableOpacity>

                    {expandedSection === "contact" && (
                        <View style={styles.accordionBody}>
                            <Text style={styles.inputLabel}>Email Address</Text>
                            <TextInput
                                style={styles.input}
                                value={profile.email}
                                onChangeText={(t) => setProfile((p) => ({ ...p, email: t }))}
                                placeholder="Email Address"
                                placeholderTextColor={COLORS.textLight}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                value={profile.phone}
                                onChangeText={(t) => setProfile((p) => ({ ...p, phone: t }))}
                                placeholder="Phone Number"
                                placeholderTextColor={COLORS.textLight}
                                keyboardType="phone-pad"
                            />
                        </View>
                    )}
                </View>

                {/* 3. Community & Religion Details Accordion */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("religion")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#FFF8E6" }]}>
                            <Text style={styles.sectionIcon}>🕉️</Text>
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Religious & Community Background</Text>
                            <Text style={styles.sectionStatus}>
                                {profile.religion ? "✔ Completed" : "Pending"}
                            </Text>
                        </View>
                        <Text style={styles.accordionChevron}>{expandedSection === "religion" ? "▴" : "▾"}</Text>
                    </TouchableOpacity>

                    {expandedSection === "religion" && (
                        <View style={styles.accordionBody}>
                            <Text style={styles.inputLabel}>Religion</Text>
                            <TextInput
                                style={styles.input}
                                value={profile.religion}
                                onChangeText={(t) => setProfile((p) => ({ ...p, religion: t }))}
                                placeholder="e.g. Hindu"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <Text style={styles.inputLabel}>Caste</Text>
                            <TextInput
                                style={styles.input}
                                value={profile.caste}
                                onChangeText={(t) => setProfile((p) => ({ ...p, caste: t }))}
                                placeholder="e.g. Patel, Brahmin, etc."
                                placeholderTextColor={COLORS.textLight}
                            />
                        </View>
                    )}
                </View>

                {/* Informative Banner */}
                <View style={styles.infoBanner}>
                    <Text style={styles.infoBannerIcon}>💡</Text>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.infoBannerTitle}>Profile Filters & Settings</Text>
                        <Text style={styles.infoBannerText}>
                            Looking for partner match preferences and search filters? Use the newly enhanced Active Members filter to find your ideal match.
                        </Text>
                    </View>
                </View>

                {/* Danger / Account Delete Button */}
                <View style={styles.dangerSection}>
                    <TouchableOpacity
                        style={styles.deleteNavBtn}
                        onPress={() => navigation.navigate("DeleteAccount")}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.deleteNavIcon}>🗑️</Text>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.deleteNavTitle}>Delete Account</Text>
                            <Text style={styles.deleteNavSub}>Permanently erase profile & all data</Text>
                        </View>
                        <Text style={styles.chevronRight}>›</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAwareScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#F7F5F4" },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 8,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: COLORS.surface,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    backText: {
        fontSize: 20,
        color: COLORS.primary,
        fontFamily: FONTS.bold,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    scroll: {
        padding: 16,
        paddingBottom: 70,
    },
    userCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    userCardTop: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatarWrap: {
        position: "relative",
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 2.5,
        borderColor: "#E5C07B",
        padding: 2,
    },
    avatarImg: { width: "100%", height: "100%", borderRadius: 34 },
    avatarPlaceholder: {
        flex: 1,
        backgroundColor: "#2B2D42",
        borderRadius: 34,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarInitial: {
        color: "#fff",
        fontSize: 26,
        fontFamily: FONTS.bold,
    },
    cameraIconWrap: {
        position: "absolute",
        bottom: -2,
        right: -2,
        backgroundColor: COLORS.primary,
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#fff",
    },
    cameraIcon: { fontSize: 13 },
    userInfoCol: { flex: 1, marginLeft: 16 },
    userName: {
        fontSize: 18,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    userEmail: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginTop: 2,
    },
    userPhone: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.text,
        marginTop: 2,
    },
    badgePill: {
        backgroundColor: "#FFF8E6",
        borderWidth: 1,
        borderColor: "#F3DC9B",
        borderRadius: 12,
        paddingVertical: 3,
        paddingHorizontal: 8,
        alignSelf: "flex-start",
        marginTop: 6,
    },
    badgeText: {
        fontSize: 11,
        fontFamily: FONTS.bold,
        color: "#B37D14",
    },
    divider: {
        height: 1,
        backgroundColor: "#F0ECE9",
        marginVertical: 14,
    },
    progressRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    progressLabel: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.textLight,
    },
    progressPercent: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        color: "#00A86B",
    },
    progressBarTrack: {
        height: 6,
        backgroundColor: "#E8E5E2",
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 10,
    },
    progressBarFill: {
        height: "100%",
        backgroundColor: "#00A86B",
        borderRadius: 3,
    },
    tagRow: {
        flexDirection: "row",
        gap: 12,
        marginTop: 4,
    },
    tagItem: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: "#00A86B",
    },
    loadingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginVertical: 10,
    },
    loadingText: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginLeft: 8,
    },
    accordionCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        marginBottom: 12,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#F0ECE9",
    },
    accordionHeader: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
    },
    sectionIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    sectionIcon: { fontSize: 20 },
    sectionTitleCol: { flex: 1, marginLeft: 14 },
    sectionTitle: {
        fontSize: 15,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    sectionStatus: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: "#00A86B",
        marginTop: 2,
    },
    badgePillCompleted: {
        backgroundColor: "#00A86B",
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginRight: 10,
    },
    badgePillCompletedText: {
        color: "#fff",
        fontSize: 11,
        fontFamily: FONTS.bold,
    },
    accordionChevron: {
        fontSize: 18,
        color: COLORS.textLight,
        fontFamily: FONTS.bold,
    },
    accordionBody: {
        paddingHorizontal: 16,
        paddingBottom: 18,
        borderTopWidth: 1,
        borderTopColor: "#F4F0ED",
        backgroundColor: "#FFFCFB",
    },
    inputLabel: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.text,
        marginTop: 12,
        marginBottom: 6,
    },
    input: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 14,
        fontFamily: FONTS.regular,
        color: COLORS.text,
    },
    infoBanner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F0F7FF",
        borderWidth: 1,
        borderColor: "#CCE4FF",
        borderRadius: 14,
        padding: 14,
        marginVertical: 12,
    },
    infoBannerIcon: { fontSize: 22 },
    infoBannerTitle: {
        fontSize: 14,
        fontFamily: FONTS.semiBold,
        color: "#0B5CA3",
    },
    infoBannerText: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: "#2C4C6E",
        marginTop: 2,
        lineHeight: 16,
    },
    dangerSection: {
        marginTop: 4,
        marginBottom: 20,
    },
    deleteNavBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF5F5",
        borderWidth: 1,
        borderColor: "#FED7D7",
        borderRadius: 16,
        padding: 16,
    },
    deleteNavIcon: { fontSize: 20 },
    deleteNavTitle: {
        fontSize: 15,
        fontFamily: FONTS.bold,
        color: COLORS.danger,
    },
    deleteNavSub: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: "#C53030",
        marginTop: 2,
    },
    chevronRight: {
        fontSize: 22,
        fontFamily: FONTS.bold,
        color: COLORS.danger,
    },
});
