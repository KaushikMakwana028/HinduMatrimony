import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "../theme";

/**
 * Standardized, high-end sticky header component.
 * Can be used with declarative props (title, subtitle, showBack, rightElement, badge)
 * OR with custom children.
 */
export default function ScreenHeader({
    title,
    subtitle,
    showBack = false,
    onBack,
    badge = null,
    badgeIcon = null,
    badgeColor = COLORS.primary,
    badgeBgColor = "#FFF0F5",
    rightElement = null,
    children,
    style,
    noBorder = false,
}) {
    // If explicit children are passed without a title, render children inside container
    if (children && !title) {
        return (
            <View style={[styles.wrap, noBorder && styles.noBorder, style]}>
                {children}
            </View>
        );
    }

    return (
        <View style={[styles.wrap, noBorder && styles.noBorder, style]}>
            <View style={styles.topRow}>
                {showBack && (
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={onBack}
                        activeOpacity={0.7}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Ionicons name="arrow-back" size={20} color="#1F1512" />
                    </TouchableOpacity>
                )}

                <View style={styles.titleArea}>
                    <View style={styles.titleRow}>
                        {title ? (
                            <Text style={styles.title} numberOfLines={1}>
                                {title}
                            </Text>
                        ) : null}

                        {badge ? (
                            <View style={[styles.badgePill, { backgroundColor: badgeBgColor }]}>
                                {badgeIcon ? (
                                    <Ionicons
                                        name={badgeIcon}
                                        size={11}
                                        color={badgeColor}
                                        style={{ marginRight: 3 }}
                                    />
                                ) : null}
                                <Text style={[styles.badgeText, { color: badgeColor }]}>
                                    {badge}
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    {subtitle ? (
                        <Text style={styles.subtitle} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    ) : null}
                </View>

                {rightElement ? (
                    <View style={styles.rightWrap}>{rightElement}</View>
                ) : null}
            </View>

            {children ? <View style={styles.extraContent}>{children}</View> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#F0E9E6",
        paddingHorizontal: 16,
        paddingTop: Platform.OS === "android" ? 10 : 8,
        paddingBottom: 12,
        zIndex: 10,
        ...Platform.select({
            ios: {
                shadowColor: "#2B1B17",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    noBorder: {
        borderBottomWidth: 0,
        elevation: 0,
        shadowOpacity: 0,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: 40,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "#F8F5F2",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
        borderWidth: 1,
        borderColor: "#EFE8E3",
    },
    titleArea: {
        flex: 1,
        justifyContent: "center",
        minWidth: 0,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "nowrap",
    },
    title: {
        fontSize: 18,
        fontFamily: FONTS.semiBold,
        color: "#1F1512",
        letterSpacing: -0.3,
        flexShrink: 1,
    },
    badgePill: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 12,
        marginLeft: 8,
        flexShrink: 0,
    },
    badgeText: {
        fontSize: 11,
        fontFamily: FONTS.medium,
    },
    subtitle: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: "#807068",
        marginTop: 2,
    },
    rightWrap: {
        marginLeft: 10,
        alignItems: "flex-end",
    },
    extraContent: {
        marginTop: 10,
    },
});