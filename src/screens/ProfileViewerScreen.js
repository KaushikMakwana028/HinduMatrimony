import React, { useState, useCallback, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import { useAuth } from "../contexts/AuthContext";
import profileViewerService from "../services/profileViewerService";
import { COLORS, FONTS, DEFAULT_AVATAR } from "../theme";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatViewedAt(str) {
    if (!str) return "";
    const parts = String(str).split(" ");
    const datePart = parts[0];
    const timePart = parts[1] || "";
    if (!datePart || !datePart.includes("-")) return str;
    const [dd, mm, yyyy] = datePart.split("-");
    const monthName = MONTHS[parseInt(mm, 10) - 1] || mm;
    return `${dd} ${monthName} ${yyyy}${timePart ? ` • ${timePart}` : ""}`;
}

function ViewerRow({ item, onPress }) {
    return (
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
            <Image
                source={{ uri: item.photo || DEFAULT_AVATAR }}
                style={styles.avatar}
                resizeMode="cover"
            />
            <View style={styles.rowTextWrap}>
                <Text style={styles.name} numberOfLines={1}>{item.name || "Member"}</Text>
                {item.code ? <Text style={styles.code}>ID: {item.code}</Text> : null}
                <View style={styles.viewedAtRow}>
                    <Ionicons name="eye-outline" size={12} color={COLORS.textLight} />
                    <Text style={styles.viewedAt}>{formatViewedAt(item.viewed_at)}</Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
        </TouchableOpacity>
    );
}

export default function ProfileViewerScreen({ navigation }) {
    const { token } = useAuth();

    const [viewers, setViewers] = useState([]);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);

    const isFetchingRef = useRef(false);

    const fetchPage = useCallback(
        async (page, { isRefresh = false } = {}) => {
            if (!token || isFetchingRef.current) return;
            isFetchingRef.current = true;

            if (isRefresh) setRefreshing(true);
            else if (page === 1) setLoading(true);
            else setLoadingMore(true);

            setError(null);

            try {
                const res = await profileViewerService.getProfileViewers(token, page);
                setViewers((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
                setMeta(res.meta);
            } catch (err) {
                setError(err?.message || "Could not load profile viewers.");
            } finally {
                isFetchingRef.current = false;
                setLoading(false);
                setRefreshing(false);
                setLoadingMore(false);
            }
        },
        [token]
    );

    useFocusEffect(
        useCallback(() => {
            fetchPage(1);
        }, [fetchPage])
    );

    const onRefresh = useCallback(() => {
        fetchPage(1, { isRefresh: true });
    }, [fetchPage]);

    const hasMore = meta.current_page < meta.last_page;

    const onEndReached = useCallback(() => {
        if (!hasMore || loadingMore || loading || refreshing) return;
        fetchPage(meta.current_page + 1);
    }, [hasMore, loadingMore, loading, refreshing, meta.current_page, fetchPage]);

    const handleOpenProfile = useCallback(
        (item) => {
            navigation.navigate("MemberProfile", { userId: item.id, memberId: item.id });
        },
        [navigation]
    );

    const renderEmpty = () => {
        if (loading) return null;
        if (error) {
            return (
                <View style={styles.emptyWrap}>
                    <Ionicons name="alert-circle-outline" size={36} color={COLORS.danger} />
                    <Text style={styles.emptyTitle}>Something went wrong</Text>
                    <Text style={styles.emptySubtitle}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPage(1)} activeOpacity={0.8}>
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return (
            <View style={styles.emptyWrap}>
                <Ionicons name="eye-outline" size={36} color={COLORS.primary} />
                <Text style={styles.emptyTitle}>No profile views yet</Text>
                <Text style={styles.emptySubtitle}>
                    When someone views your profile, they'll show up here.
                </Text>
            </View>
        );
    };

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            <ScreenHeader
                title="Profile Viewers"
                subtitle={meta.total ? `${meta.total} people viewed your profile` : "Who viewed your profile"}
                showBack
                onBackPress={() => navigation.goBack()}
            />

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={viewers}
                    keyExtractor={(item, idx) => String(item.id ?? idx)}
                    renderItem={({ item }) => (
                        <ViewerRow item={item} onPress={() => handleOpenProfile(item)} />
                    )}
                    contentContainerStyle={
                        viewers.length === 0 ? styles.emptyListContent : styles.listContent
                    }
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[COLORS.primary]}
                            tintColor={COLORS.primary}
                        />
                    }
                    onEndReached={onEndReached}
                    onEndReachedThreshold={0.4}
                    ListEmptyComponent={renderEmpty}
                    ListFooterComponent={renderFooter}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },
    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
    listContent: { padding: 16, paddingBottom: 32 },
    emptyListContent: { flexGrow: 1, padding: 16 },

    row: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 12,
        marginBottom: 10,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#F3F4F6",
        marginRight: 12,
    },
    rowTextWrap: { flex: 1 },
    name: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.text },
    code: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textLight, marginTop: 2 },
    viewedAtRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
    viewedAt: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textLight, marginLeft: 4 },

    footerLoader: { paddingVertical: 20, alignItems: "center" },

    emptyWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 80,
        paddingHorizontal: 30,
    },
    emptyTitle: {
        fontSize: 15,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
        marginTop: 12,
    },
    emptySubtitle: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        textAlign: "center",
        marginTop: 4,
        lineHeight: 17,
    },
    retryBtn: {
        marginTop: 16,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    retryBtnText: { color: "#fff", fontFamily: FONTS.semiBold, fontSize: 13 },
});