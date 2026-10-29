import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar as RNStatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "../theme";

/**
 * Standardized, high-end sticky header component.
 * Can be used with declarative props (title, subtitle, showBack, rightElement, badge)
 * OR with custom children.
 *
 * Status bar handling:
 * Safe top spacing is computed as Math.max(insets.top, androidStatusBarHeight).
 * This ensures that on Android edge-to-edge / translucent windows, the header
 * never overlaps with the system status bar (time, battery, charging), while
 * also never double-counting status bar spacing.
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
  includeTopInset = true,
}) {
  const insets = useSafeAreaInsets();

  // Status bar height fallback on Android to prevent header overlap when insets.top is 0 or unmeasured
  const androidStatusBarHeight =
    Platform.OS === "android" ? (RNStatusBar.currentHeight || 24) : 0;
  const safeTop = Math.max(insets.top, androidStatusBarHeight);

  // Breathing room under the status bar.
  const computedPaddingTop = includeTopInset
    ? safeTop + (Platform.OS === "android" ? 6 : 4)
    : (Platform.OS === "android" ? 10 : 8);

  const containerStyle = [
    styles.wrap,
    { paddingTop: computedPaddingTop },
    noBorder && styles.noBorder,
    style,
  ];

  const statusBarElement = (
    <RNStatusBar
      barStyle="dark-content"
      backgroundColor="transparent"
      translucent={true}
    />
  );

  // If explicit children are passed without a title, render children inside container
  if (children && !title) {
    return (
      <View style={containerStyle}>
        {statusBarElement}
        {children}
      </View>
    );
  }

  const safeTitle =
    typeof title === "object" && title !== null
      ? (title.name || title.title || "")
      : title !== null && title !== undefined
        ? String(title)
        : "";
  const safeSubtitle =
    typeof subtitle === "object" && subtitle !== null
      ? (subtitle.name || subtitle.title || "")
      : subtitle !== null && subtitle !== undefined
        ? String(subtitle)
        : "";
  const safeBadge =
    typeof badge === "object" && badge !== null
      ? (badge.name || badge.title || badge.label || "")
      : badge !== null && badge !== undefined
        ? String(badge)
        : "";

  return (
    <View style={containerStyle}>
      {statusBarElement}
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
            {safeTitle ? (
              <Text style={styles.title} numberOfLines={1}>
                {safeTitle}
              </Text>
            ) : null}

            {safeBadge ? (
              <View
                style={[styles.badgePill, { backgroundColor: badgeBgColor }]}
              >
                {badgeIcon ? (
                  <Ionicons
                    name={badgeIcon}
                    size={11}
                    color={badgeColor}
                    style={{ marginRight: 4 }}
                  />
                ) : null}
                <Text
                  style={[styles.badgeText, { color: badgeColor }]}
                  numberOfLines={1}
                >
                  {safeBadge}
                </Text>
              </View>
            ) : null}
          </View>

          {safeSubtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {safeSubtitle}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EDE4DF",
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#2B1B17",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
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
    minHeight: 44,
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
    fontSize: 20,
    lineHeight: 26,
    fontFamily: FONTS.semiBold,
    color: "#1F1512",
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: FONTS.medium,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: FONTS.regular,
    color: "#807068",
    marginTop: 1,
  },
  rightWrap: {
    marginLeft: 10,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  extraContent: {
    marginTop: 10,
  },
});
