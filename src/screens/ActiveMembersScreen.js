import React from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenHeader from "../components/ScreenHeader";
import { COLORS, FONTS } from "../theme";

const MEMBERS = [
    { id: "1", name: "Ruchi Patel", memberId: "2026107440", photo: "https://i.pravatar.cc/300?img=47", plan: "Free", age: 27, height: "5.6", religion: "Hindu", caste: "Patel", location: "India", maritalStatus: "Divorced", education: "Ms Obstetrics & Gynecology, MBBS", career: "" },
    { id: "2", name: "Rohit Verma", memberId: "2026107441", photo: "https://i.pravatar.cc/300?img=12", plan: "Free", age: 30, height: "5.9", religion: "Hindu", caste: "Verma", location: "Delhi, India", maritalStatus: "Never Married", education: "B.Tech Computer Science", career: "Software Engineer" },
    { id: "3", name: "Priya Iyer", memberId: "2026107442", photo: "https://i.pravatar.cc/300?img=32", plan: "Free", age: 26, height: "5.4", religion: "Hindu", caste: "Iyer", location: "Chennai, India", maritalStatus: "Never Married", education: "MBA Finance", career: "Bank Manager" },
    { id: "4", name: "Karthik Rao", memberId: "2026107443", photo: "https://i.pravatar.cc/300?img=14", plan: "Free", age: 29, height: "5.8", religion: "Hindu", caste: "Rao", location: "Bengaluru, India", maritalStatus: "Divorced", education: "M.Tech Mechanical", career: "Project Manager" },
];

function InfoRow({ left, right }) {
    return (
        <View style={styles.infoRow}>
            <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>{left.label}</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{left.value || "-"}</Text>
            </View>
            {right && (
                <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>{right.label}</Text>
                    <Text style={styles.infoValue} numberOfLines={2}>{right.value || "-"}</Text>
                </View>
            )}
        </View>
    );
}

function ActionButton({ icon, label, color = COLORS.primary, onPress }) {
    return (
        <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.6}>
            <Text style={[styles.actionIcon, { color }]}>{icon}</Text>
            <Text style={styles.actionLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

export default function ActiveMembersScreen() {
    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            {/* ---------- STICKY HEADER ---------- */}
            <ScreenHeader>
                <Text style={styles.title}>Active Members</Text>
                <Text style={styles.subtitle}>Members online and active recently</Text>
            </ScreenHeader>

            {/* ---------- SCROLLABLE CONTENT ---------- */}
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {MEMBERS.map((m) => (
                    <View key={m.id} style={styles.card}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{m.plan}</Text>
                        </View>

                        <View style={styles.photoWrap}>
                            <Image source={{ uri: m.photo }} style={styles.photo} />
                        </View>

                        <Text style={styles.name}>{m.name}</Text>
                        <View style={styles.idRow}>
                            <Text style={styles.idLabel}>Member ID: </Text>
                            <Text style={styles.idValue}>{m.memberId}</Text>
                        </View>

                        <View style={styles.detailsBlock}>
                            <InfoRow left={{ label: "age", value: m.age }} right={{ label: "Height", value: m.height }} />
                            <InfoRow left={{ label: "Religion", value: m.religion }} right={{ label: "Caste", value: m.caste }} />
                            <InfoRow left={{ label: "location", value: m.location }} right={{ label: "Marital Status", value: m.maritalStatus }} />
                            <InfoRow left={{ label: "Education", value: m.education }} right={{ label: "Career", value: m.career }} />
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.actionsRow}>
                            <ActionButton icon="👤" label="Full Profile" />
                            <ActionButton icon="♡" label="Interest" />
                            <ActionButton icon="☰" label="Shortlist" />
                            <ActionButton icon="⊘" label="Ignore" color={COLORS.textLight} />
                            <ActionButton icon="ⓘ" label="Report" color={COLORS.danger} />
                        </View>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },
    scroll: { padding: 20, paddingBottom: 40 },

    title: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text },
    subtitle: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textLight, marginTop: 2 },

    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        position: "relative",
    },
    badge: { position: "absolute", top: 14, right: 14, backgroundColor: COLORS.badge, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, zIndex: 2 },
    badgeText: { color: "#fff", fontSize: 11, fontFamily: FONTS.semiBold },
    photoWrap: { alignItems: "center", marginBottom: 14, marginTop: 4 },
    photo: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.primarySoft },
    name: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text },
    idRow: { flexDirection: "row", alignItems: "center", marginTop: 2, marginBottom: 14 },
    idLabel: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textLight },
    idValue: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.primary },
    detailsBlock: { marginBottom: 14 },
    infoRow: { flexDirection: "row", marginBottom: 10 },
    infoCol: { flex: 1, paddingRight: 8 },
    infoLabel: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.label, marginBottom: 2 },
    infoValue: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.primary },
    divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 10 },
    actionsRow: { flexDirection: "row", justifyContent: "space-between" },
    actionBtn: { alignItems: "center", flex: 1 },
    actionIcon: { fontSize: 20, marginBottom: 4 },
    actionLabel: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textLight, textAlign: "center" },
});