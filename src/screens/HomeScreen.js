import React from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenHeader from "../components/ScreenHeader";
import { COLORS, FONTS } from "../theme";

const STATS = [
    { key: "interest", label: "Remaining Interest", value: 25, icon: "💖", subtitle: "Interests you can send" },
    { key: "contact", label: "Remaining Contact View", value: 10, icon: "📞", subtitle: "Contacts you can view" },
    { key: "profileViewer", label: "Remaining Profile Viewer", value: 15, icon: "👁️", subtitle: "Profiles you can view" },
    { key: "gallery", label: "Remaining Gallery Upload", value: 5, icon: "🖼️", subtitle: "Gallery images to upload" },
];

export default function HomeScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            {/* ---------- STICKY HEADER ---------- */}
            <ScreenHeader>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.greeting}>Namaste 🙏</Text>
                        <Text style={styles.name}>Welcome back</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.avatar}
                        onPress={() => navigation.navigate("Profile")}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.avatarText}>A</Text>
                    </TouchableOpacity>
                </View>
            </ScreenHeader>

            {/* ---------- SCROLLABLE CONTENT ---------- */}
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.sectionTitle}>Your Plan Usage</Text>
                <Text style={styles.sectionSubtitle}>
                    Track what's left in your current membership
                </Text>

                <View style={styles.statsGrid}>
                    {STATS.map((stat) => (
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
            </ScrollView>
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
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: COLORS.primarySoft,
    },
    avatarText: { color: "#fff", fontSize: 17, fontFamily: FONTS.bold },

    scroll: { padding: 20, paddingBottom: 40 },

    sectionTitle: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text, marginBottom: 4, marginTop: 4 },
    sectionSubtitle: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textLight, marginBottom: 16 },

    statsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 20 },
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
    statValue: { fontSize: 26, fontFamily: FONTS.bold, color: COLORS.primary, lineHeight: 30 },
    statLabel: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.text, marginTop: 4 },
    statSubtitle: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textLight, marginTop: 2 },

    promoCard: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 20, marginTop: 8 },
    promoTitle: { color: "#fff", fontSize: 18, fontFamily: FONTS.semiBold, marginBottom: 6 },
    promoSubtitle: { color: "#FFE6EF", fontSize: 13, fontFamily: FONTS.regular, marginBottom: 14, lineHeight: 20 },
    promoBtn: { backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, alignSelf: "flex-start" },
    promoBtnText: { color: COLORS.primary, fontSize: 14, fontFamily: FONTS.semiBold },
});