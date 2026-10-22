import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { COLORS } from "../theme";

/**
 * Generic sticky header container.
 * Stays fixed at the top of a screen — place it as a SIBLING
 * of the scrollable content (ScrollView/FlatList), never inside it.
 *
 * Usage:
 * <SafeAreaView style={{ flex: 1 }}>
 *   <ScreenHeader>
 *     ...custom left/title/right layout...
 *   </ScreenHeader>
 *   <ScrollView>...</ScrollView>
 * </SafeAreaView>
 */
export default function ScreenHeader({ children, style, noBorder }) {
    return (
        <View style={[styles.wrap, noBorder && styles.noBorder, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        backgroundColor: COLORS.background,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        paddingHorizontal: 20,
        // paddingTop: 14,
        paddingBottom: 14,
        zIndex: 10
    },
    noBorder: {
        borderBottomWidth: 0,
    },
});