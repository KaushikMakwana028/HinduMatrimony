import React from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenHeader from "../components/ScreenHeader";
import { COLORS, FONTS } from "../theme";

const INTERESTS = [
    { id: "1", name: "Sneha Kulkarni", status: "Pending", initial: "S" },
    { id: "2", name: "Vikram Nair", status: "Accepted", initial: "V" },
    { id: "3", name: "Divya Menon", status: "Pending", initial: "D" },
];

export default function MyInterestScreen() {
    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            {/* ---------- STICKY HEADER ---------- */}
            <ScreenHeader>
                <Text style={styles.title}>My Interests</Text>
                <Text style={styles.subtitle}>Interests you have sent</Text>
            </ScreenHeader>

            <FlatList
                data={INTERESTS}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 20 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                    const accepted = item.status === "Accepted";
                    return (
                        <View style={styles.card}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{item.initial}</Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <Text style={styles.name}>{item.name}</Text>
                                <View style={[styles.badge, accepted ? styles.badgeAccepted : styles.badgePending]}>
                                    <Text style={[styles.badgeText, accepted ? styles.badgeTextAccepted : styles.badgeTextPending]}>
                                        {item.status}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.btn} activeOpacity={0.8}>
                                <Text style={styles.btnText}>View</Text>
                            </TouchableOpacity>
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <Text style={styles.empty}>No interests sent yet</Text>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },
    title: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text },
    subtitle: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textLight, marginTop: 2 },

    card: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center" },
    avatarText: { color: COLORS.primary, fontFamily: FONTS.bold, fontSize: 18 },
    name: { fontSize: 15, fontFamily: FONTS.semiBold, color: COLORS.text },
    badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 6 },
    badgePending: { backgroundColor: "#FFF2CC" },
    badgeAccepted: { backgroundColor: "#DCFCE7" },
    badgeText: { fontSize: 11, fontFamily: FONTS.semiBold },
    badgeTextPending: { color: "#B45309" },
    badgeTextAccepted: { color: "#15803D" },
    btn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    btnText: { color: "#fff", fontFamily: FONTS.semiBold, fontSize: 13 },
    empty: { textAlign: "center", color: COLORS.textLight, fontFamily: FONTS.regular, marginTop: 40 },
});