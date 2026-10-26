import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenHeader from "../components/ScreenHeader";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { useAuth } from "../contexts/AuthContext";
import memberService from "../services/memberService";
import { COLORS, FONTS, DEFAULT_AVATAR } from "../theme";

const REASONS = [
    "I found my life partner",
    "Privacy concerns",
    "Not getting relevant matches",
    "Taking a break from matrimony search",
    "Other reasons",
];

export default function DeleteAccountScreen({ navigation }) {
    const { user, token, logout } = useAuth();
    const [selectedReason, setSelectedReason] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [loading, setLoading] = useState(false);

    const fullName = user?.name || "Member";
    const userEmail = user?.email || "";
    const userPhone = user?.phone || "";
    const userAvatar = user?.avatar_original || user?.avatar || null;

    const handleDelete = async () => {
        if (!confirmed) {
            Alert.alert(
                "Confirmation Required",
                "Please confirm that you understand account deletion is permanent by checking the box."
            );
            return;
        }

        Alert.alert(
            "Final Confirmation",
            "Are you absolutely sure you want to permanently delete your Hindu Matrimony account? All your matches, interests, and profile data will be permanently wiped.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete My Account",
                    style: "destructive",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const response = await memberService.deleteAccount(token);
                            await logout();
                            Alert.alert(
                                "Account Deleted",
                                response?.message || "Your account has been permanently deleted.",
                                [
                                    {
                                        text: "OK",
                                        onPress: () => navigation.replace("Login"),
                                    },
                                ]
                            );
                        } catch (error) {
                            console.log("Delete account error:", error?.message);
                            Alert.alert(
                                "Delete Failed",
                                error?.message || "Failed to delete account. Please try again."
                            );
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
            <ScreenHeader
                title="Delete Account"
                subtitle="Permanent account deletion"
                showBack
                onBack={() => navigation.goBack()}
            />

            <KeyboardAwareScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={true}
            >
                {/* User Summary Card */}
                <View style={styles.userCard}>
                    <View style={styles.avatarWrap}>
                        <Image
                            source={{ uri: userAvatar || DEFAULT_AVATAR }}
                            style={styles.avatarImg}
                            resizeMode="cover"
                        />
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{fullName}</Text>
                        {userEmail ? <Text style={styles.userSub}>{userEmail}</Text> : null}
                        {userPhone ? <Text style={styles.userSub}>{userPhone}</Text> : null}
                    </View>
                </View>

                {/* Critical Warning Box */}
                <View style={styles.warningBox}>
                    <View style={styles.warningHeader}>
                        <Text style={styles.warningIcon}>⚠️</Text>
                        <Text style={styles.warningTitle}>Permanent Action</Text>
                    </View>
                    <Text style={styles.warningText}>
                        Deleting your account will permanently remove your profile from Hindu Matrimony.
                        This action cannot be undone.
                    </Text>

                    <View style={styles.bulletList}>
                        <Text style={styles.bulletItem}>• Your public profile will be immediately removed.</Text>
                        <Text style={styles.bulletItem}>• All sent & received interests will be erased.</Text>
                        <Text style={styles.bulletItem}>• Your uploaded photos and gallery will be deleted.</Text>
                        <Text style={styles.bulletItem}>• Active subscription packages will be forfeited.</Text>
                    </View>
                </View>

                {/* Reason Selection */}
                <Text style={styles.sectionHeading}>Why are you leaving? (Optional)</Text>
                <View style={styles.reasonCard}>
                    {REASONS.map((reason) => {
                        const selected = selectedReason === reason;
                        return (
                            <TouchableOpacity
                                key={reason}
                                style={[styles.reasonItem, selected && styles.reasonItemSelected]}
                                onPress={() => setSelectedReason(reason)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.radioCircle, selected && styles.radioCircleActive]}>
                                    {selected ? <View style={styles.radioDot} /> : null}
                                </View>
                                <Text style={[styles.reasonText, selected && styles.reasonTextActive]}>
                                    {reason}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Acknowledgment Checkbox */}
                <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setConfirmed(!confirmed)}
                    activeOpacity={0.7}
                    disabled={loading}
                >
                    <View style={[styles.checkbox, confirmed && styles.checkboxActive]}>
                        {confirmed ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                    <Text style={styles.checkboxLabel}>
                        I understand that deleting my account is permanent and all my data will be irreversibly deleted.
                    </Text>
                </TouchableOpacity>

                {/* Danger Button At End */}
                <TouchableOpacity
                    style={[styles.deleteBtn, (!confirmed || loading) && styles.deleteBtnDisabled]}
                    onPress={handleDelete}
                    disabled={!confirmed || loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.deleteBtnText}>🗑️ Delete Account Permanently</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => navigation.goBack()}
                    disabled={loading}
                >
                    <Text style={styles.cancelBtnText}>Keep My Account</Text>
                </TouchableOpacity>
            </KeyboardAwareScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },
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
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
    },
    scroll: {
        padding: 20,
        paddingBottom: 60,
    },
    userCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    avatarWrap: {
        width: 54,
        height: 54,
        borderRadius: 27,
        borderWidth: 2,
        borderColor: COLORS.primary,
        overflow: "hidden",
    },
    avatarImg: { width: "100%", height: "100%" },
    avatarPlaceholder: {
        flex: 1,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarInitial: {
        fontSize: 22,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    userInfo: { flex: 1, marginLeft: 14 },
    userName: {
        fontSize: 16,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
    },
    userSub: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginTop: 2,
    },
    warningBox: {
        backgroundColor: "#FDF2F2",
        borderWidth: 1,
        borderColor: "#FBD5D5",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    warningHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    warningIcon: { fontSize: 18, marginRight: 8 },
    warningTitle: {
        fontSize: 15,
        fontFamily: FONTS.bold,
        color: COLORS.danger,
    },
    warningText: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: "#9B1C1C",
        lineHeight: 18,
        marginBottom: 10,
    },
    bulletList: { marginTop: 4 },
    bulletItem: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: "#771D1D",
        marginBottom: 4,
        lineHeight: 16,
    },
    sectionHeading: {
        fontSize: 14,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
        marginBottom: 10,
    },
    reasonCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 12,
        marginBottom: 20,
    },
    reasonItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    reasonItemSelected: {
        backgroundColor: "#FFF5F7",
        borderRadius: 8,
    },
    radioCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: COLORS.border,
        marginRight: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    radioCircleActive: {
        borderColor: COLORS.danger,
    },
    radioDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.danger,
    },
    reasonText: {
        fontSize: 14,
        fontFamily: FONTS.regular,
        color: COLORS.text,
    },
    reasonTextActive: {
        fontFamily: FONTS.medium,
        color: COLORS.danger,
    },
    checkboxRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 24,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.border,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
        marginTop: 2,
    },
    checkboxActive: {
        backgroundColor: COLORS.danger,
        borderColor: COLORS.danger,
    },
    checkmark: {
        color: "#fff",
        fontSize: 13,
        fontFamily: FONTS.bold,
    },
    checkboxLabel: {
        flex: 1,
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.text,
        lineHeight: 18,
    },
    deleteBtn: {
        backgroundColor: COLORS.danger,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 52,
        shadowColor: COLORS.danger,
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 3,
    },
    deleteBtnDisabled: {
        opacity: 0.5,
    },
    deleteBtnText: {
        color: "#fff",
        fontSize: 16,
        fontFamily: FONTS.semiBold,
    },
    cancelBtn: {
        alignItems: "center",
        paddingVertical: 14,
        marginTop: 10,
    },
    cancelBtnText: {
        color: COLORS.textLight,
        fontFamily: FONTS.medium,
        fontSize: 14,
    },
});
