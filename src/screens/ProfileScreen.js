import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenHeader from "../components/ScreenHeader";
import { COLORS, FONTS } from "../theme";

const ACCOUNT_ITEMS = [
    { label: "Manage Profile", icon: "📝", route: "ManageProfile" },
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
    const handleNavigate = (route) => {
        if (navigation?.navigate) {
            try {
                navigation.navigate(route);
            } catch {
                Alert.alert("Coming soon", `${route} screen is not available yet.`);
            }
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            "Delete Account",
            "This action is permanent and cannot be undone. Are you sure you want to delete your account?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => handleNavigate("DeleteAccount") },
            ]
        );
    };

    const onMenuPress = (item) => {
        if (item.label === "Delete Account") return handleDeleteAccount();
        return handleNavigate(item.route);
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            {/* ---------- STICKY HEADER ---------- */}
            <ScreenHeader>
                <View style={styles.headerRow}>
                    <Text style={styles.headerTitle}>My Profile</Text>
                </View>
            </ScreenHeader>

            {/* ---------- SCROLLABLE CONTENT ---------- */}
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.profileCard}>
                    <View style={styles.avatarWrap}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>A</Text>
                        </View>
                        <TouchableOpacity style={styles.avatarEditBtn} onPress={() => handleNavigate("Gallery")}>
                            <Text style={styles.avatarEditIcon}>📷</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.name}>Aarav Sharma</Text>
                    <Text style={styles.meta}>28 yrs • Mumbai, Maharashtra</Text>

                    <View style={styles.badgeRow}>
                        <View style={styles.planBadge}>
                            <Text style={styles.planBadgeText}>Free Plan</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.editProfileBtn} onPress={() => handleNavigate("ManageProfile")}>
                        <Text style={styles.editProfileBtnText}>Edit Profile</Text>
                    </TouchableOpacity>
                </View>

                <Section title="Account">
                    {ACCOUNT_ITEMS.map((item, i) => (
                        <MenuRow key={item.label} item={item} isLast={i === ACCOUNT_ITEMS.length - 1} onPress={() => onMenuPress(item)} />
                    ))}
                </Section>

                <Section title="Security">
                    {SECURITY_ITEMS.map((item, i) => (
                        <MenuRow key={item.label} item={item} isLast={i === SECURITY_ITEMS.length - 1} onPress={() => onMenuPress(item)} />
                    ))}
                </Section>

                <Section title="Danger Zone">
                    {DANGER_ITEMS.map((item, i) => (
                        <MenuRow key={item.label} item={item} isLast={i === DANGER_ITEMS.length - 1} onPress={() => onMenuPress(item)} />
                    ))}
                </Section>

                <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace("Login")}>
                    <Text style={styles.logoutText}>Sign Out</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>App version 1.0.0</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },

    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerTitle: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text },
    headerIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
    headerIcon: { fontSize: 16 },

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
    avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: COLORS.primarySoft },
    avatarText: { color: "#fff", fontSize: 38, fontFamily: FONTS.bold },
    avatarEditBtn: { position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
    avatarEditIcon: { fontSize: 14 },
    name: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text },
    meta: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textLight, marginTop: 4 },
    badgeRow: { flexDirection: "row", marginTop: 10 },
    planBadge: { backgroundColor: COLORS.primarySoft, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
    planBadgeText: { fontSize: 11, fontFamily: FONTS.semiBold, color: COLORS.primary },
    editProfileBtn: { marginTop: 16, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
    editProfileBtnText: { color: COLORS.primary, fontFamily: FONTS.semiBold, fontSize: 13 },

    sectionWrap: { marginBottom: 20 },
    sectionTitle: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.textLight, marginBottom: 8, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 },
    listCard: { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
    item: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14 },
    itemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
    itemIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center", marginRight: 12 },
    itemIcon: { fontSize: 16 },
    itemLabel: { flex: 1, fontSize: 14, fontFamily: FONTS.medium, color: COLORS.text },
    itemChevron: { fontSize: 20, color: COLORS.textLight },

    logoutBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 4 },
    logoutText: { color: "#fff", fontFamily: FONTS.semiBold, fontSize: 15 },
    versionText: { textAlign: "center", color: COLORS.textLight, fontFamily: FONTS.regular, fontSize: 11, marginTop: 16 },
});