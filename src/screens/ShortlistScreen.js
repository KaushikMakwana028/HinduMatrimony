import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import { useAuth } from "../contexts/AuthContext";
import activeMemberService from "../services/activeMemberService";
import { COLORS, FONTS } from "../theme";

export default function ShortlistScreen() {
    const { token } = useAuth();
    const [shortlistedMembers, setShortlistedMembers] = useState([]);
    const [loading, setLoading] = useState(() => Boolean(token));
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        let isMounted = true;
        if (!token) return;

        (async () => {
            try {
                const res = await activeMemberService.getMyShortlists(token);
                if (isMounted) {
                    if (res && res.result !== false && res.data) {
                        const list = Array.isArray(res.data) ? res.data : [];
                        setShortlistedMembers(list);
                    } else {
                        setShortlistedMembers([]);
                    }
                }
            } catch {
                if (isMounted) setShortlistedMembers([]);
            } finally {
                if (isMounted) setLoading(false);
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
            const res = await activeMemberService.getMyShortlists(token);
            if (res && res.result !== false && res.data) {
                const list = Array.isArray(res.data) ? res.data : [];
                setShortlistedMembers(list);
            } else {
                setShortlistedMembers([]);
            }
        } catch {
            setShortlistedMembers([]);
        } finally {
            setRefreshing(false);
        }
    }, [token]);

    const handleRemove = async (item) => {
        Alert.alert(
            "Remove Shortlist",
            `Remove ${item.name || "this member"} from your shortlisted profiles?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await activeMemberService.removeFromShortlist(item.user_id, token);
                            setShortlistedMembers((prev) => prev.filter((m) => m.user_id !== item.user_id));
                        } catch (err) {
                            Alert.alert("Notice", err.message || "Failed to remove member");
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            {/* ---------- STICKY HEADER ---------- */}
            <ScreenHeader>
                <Text style={styles.title}>Shortlisted</Text>
                <Text style={styles.subtitle}>Profiles you saved for later</Text>
            </ScreenHeader>

            {loading ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading shortlisted profiles...</Text>
                </View>
            ) : (
                <FlatList
                    data={shortlistedMembers}
                    keyExtractor={(item) => String(item.user_id || item.code || Math.random())}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[COLORS.primary]}
                            tintColor={COLORS.primary}
                        />
                    }
                    renderItem={({ item }) => {
                        const name = item.name || "Member";
                        const initial = name.charAt(0).toUpperCase();

                        return (
                            <View style={styles.card}>
                                {item.photo && !item.photo.includes("place.png") ? (
                                    <Image source={{ uri: item.photo }} style={styles.avatarImg} />
                                ) : (
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>{initial}</Text>
                                    </View>
                                )}

                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text style={styles.name}>{name}</Text>
                                    <Text style={styles.meta}>
                                        {item.age ? `${item.age} yrs • ` : ""}
                                        {item.country || "Active Member"}
                                    </Text>
                                    {item.code ? (
                                        <Text style={styles.codeText}>ID: {item.code}</Text>
                                    ) : null}
                                </View>

                                <TouchableOpacity
                                    style={styles.removeBtn}
                                    onPress={() => handleRemove(item)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                                </TouchableOpacity>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="star-outline" size={44} color={COLORS.primary} />
                            </View>
                            <Text style={styles.emptyTitle}>No Shortlisted Profiles</Text>
                            <Text style={styles.emptySubtitle}>
                                Profiles you shortlist from Active Members will appear here.
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },
    title: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text },
    subtitle: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textLight, marginTop: 2 },

    centerBox: { flex: 1, alignItems: "center", justifyContent: "center" },
    loadingText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textLight, marginTop: 10 },

    card: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarImg: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primarySoft },
    avatarText: { color: COLORS.primary, fontFamily: FONTS.bold, fontSize: 18 },
    name: { fontSize: 15, fontFamily: FONTS.semiBold, color: COLORS.text },
    meta: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textLight, marginTop: 2 },
    codeText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.primary, marginTop: 2 },

    removeBtn: {
        padding: 8,
        backgroundColor: "#FDF2F2",
        borderRadius: 10,
        marginLeft: 10,
    },

    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
        paddingHorizontal: 20,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    emptyTitle: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 8 },
    emptySubtitle: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        textAlign: "center",
        lineHeight: 20,
    },
});
