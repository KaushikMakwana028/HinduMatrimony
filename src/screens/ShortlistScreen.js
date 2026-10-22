import React from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenHeader from "../components/ScreenHeader";
import { COLORS, FONTS } from "../theme";

const SHORTLISTED = [
    { id: "1", name: "Meera Joshi", age: 28, city: "Pune", initial: "M" },
    { id: "2", name: "Arjun Reddy", age: 31, city: "Hyderabad", initial: "A" },
];

export default function ShortlistScreen() {
    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            {/* ---------- STICKY HEADER ---------- */}
            <ScreenHeader>
                <Text style={styles.title}>Shortlisted</Text>
                <Text style={styles.subtitle}>Profiles you saved for later</Text>
            </ScreenHeader>

            <FlatList
                data={SHORTLISTED}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 20 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{item.initial}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={styles.name}>{item.name}</Text>
                            <Text style={styles.meta}>{item.age} yrs • {item.city}</Text>
                        </View>
                        <TouchableOpacity style={styles.btn} activeOpacity={0.8}>
                            <Text style={styles.btnText}>View</Text>
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={
                    <Text style={styles.empty}>No profiles shortlisted yet</Text>
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
    meta: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textLight, marginTop: 2 },
    btn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    btnText: { color: "#fff", fontFamily: FONTS.semiBold, fontSize: 13 },
    empty: { textAlign: "center", color: COLORS.textLight, fontFamily: FONTS.regular, marginTop: 40 },
});