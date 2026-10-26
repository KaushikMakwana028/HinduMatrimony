import React, { useEffect } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";

/* ------------------------------------------------------------------
 * Shared pulse animation
 * One animation drives every skeleton block on screen, so all blocks
 * breathe in sync (looks calmer and more professional) and the JS /
 * native thread only runs a single loop instead of one per block.
 * ------------------------------------------------------------------ */
const SKELETON_BASE = "#EEE7E2";
const SKELETON_SOFT = "#F4EFEB";

const sharedPulse = new Animated.Value(0.55);
let pulseUsers = 0;
let pulseAnimation = null;

function startSharedPulse() {
  pulseUsers += 1;
  if (pulseAnimation) return;
  pulseAnimation = Animated.loop(
    Animated.sequence([
      Animated.timing(sharedPulse, {
        toValue: 1,
        duration: 850,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(sharedPulse, {
        toValue: 0.55,
        duration: 850,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]),
  );
  pulseAnimation.start();
}

function stopSharedPulse() {
  pulseUsers = Math.max(0, pulseUsers - 1);
  if (pulseUsers === 0 && pulseAnimation) {
    pulseAnimation.stop();
    pulseAnimation = null;
  }
}

/**
 * Base pulsing Skeleton block component
 */
export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
  color = SKELETON_BASE,
}) {
  useEffect(() => {
    startSharedPulse();
    return () => stopSharedPulse();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: color,
          opacity: sharedPulse,
        },
        style,
      ]}
    />
  );
}

/**
 * Member card skeleton matching ActiveMembersScreen card layout
 */
export function MemberCardSkeleton() {
  return (
    <View style={styles.memberCard}>
      {/* Photo hero skeleton (full-bleed, clipped by the card) */}
      <View style={styles.memberPhotoWrap}>
        <Skeleton
          width="100%"
          height={220}
          borderRadius={0}
          color={SKELETON_BASE}
        />
        {/* Floating badge placeholders */}
        <View style={styles.memberPhotoOverlayTop}>
          <Skeleton
            width={70}
            height={24}
            borderRadius={12}
            color="rgba(255,255,255,0.7)"
          />
          <Skeleton
            width={60}
            height={24}
            borderRadius={12}
            color="rgba(255,255,255,0.7)"
          />
        </View>
        <View style={styles.memberPhotoOverlayBottom}>
          <Skeleton
            width={74}
            height={22}
            borderRadius={11}
            color="rgba(255,255,255,0.7)"
          />
          <Skeleton
            width={88}
            height={22}
            borderRadius={11}
            color="rgba(255,255,255,0.7)"
          />
        </View>
      </View>

      {/* Card Body */}
      <View style={styles.memberCardBody}>
        {/* Name & Age line */}
        <View style={styles.memberNameRow}>
          <Skeleton width="62%" height={20} borderRadius={6} />
          <Skeleton width={32} height={32} borderRadius={16} />
        </View>

        {/* Subtitle tag / badge line */}
        <Skeleton
          width="40%"
          height={14}
          borderRadius={5}
          color={SKELETON_SOFT}
          style={{ marginTop: 8 }}
        />

        {/* Attributes / Details Grid */}
        <View style={styles.memberAttributesGrid}>
          <Skeleton
            width="48%"
            height={14}
            borderRadius={5}
            color={SKELETON_SOFT}
          />
          <Skeleton
            width="48%"
            height={14}
            borderRadius={5}
            color={SKELETON_SOFT}
          />
          <Skeleton
            width="48%"
            height={14}
            borderRadius={5}
            color={SKELETON_SOFT}
          />
          <Skeleton
            width="48%"
            height={14}
            borderRadius={5}
            color={SKELETON_SOFT}
          />
        </View>

        {/* Divider */}
        <View style={styles.memberDivider} />

        {/* Action Buttons Row */}
        <View style={styles.memberActionRow}>
          <Skeleton width="48%" height={44} borderRadius={13} />
          <Skeleton width="48%" height={44} borderRadius={13} />
        </View>
      </View>
    </View>
  );
}

/**
 * Full feed skeleton for ActiveMembersScreen
 */
export function ActiveMembersSkeleton({ count = 3 }) {
  return (
    <View style={styles.feedContainer}>
      {/* Results header pill skeleton */}
      <View style={styles.resultsPillWrap}>
        <Skeleton width={150} height={30} borderRadius={15} />
      </View>

      {/* Repeating member card skeletons */}
      {Array.from({ length: count }).map((_, idx) => (
        <MemberCardSkeleton key={`active_skeleton_${idx}`} />
      ))}
    </View>
  );
}

/**
 * Single stat tile skeleton (icon + number + label)
 */
function StatTileSkeleton() {
  return (
    <View style={styles.homeStatBox}>
      <Skeleton width={30} height={30} borderRadius={10} />
      <Skeleton
        width={36}
        height={18}
        borderRadius={6}
        style={{ marginTop: 9 }}
      />
      <Skeleton
        width="58%"
        height={10}
        borderRadius={4}
        color={SKELETON_SOFT}
        style={{ marginTop: 7 }}
      />
    </View>
  );
}

/**
 * Skeleton for HomeScreen
 */
export function HomeScreenSkeleton() {
  return (
    <View style={styles.homeContainer}>
      {/* Quick stats grid skeleton (3 stat cards) */}
      <View style={styles.homeStatsRow}>
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
      </View>

      {/* Banner / Upgrade Promo skeleton */}
      <View style={styles.homePromoBox}>
        <Skeleton width="68%" height={22} borderRadius={7} />
        <Skeleton
          width="90%"
          height={13}
          borderRadius={5}
          color={SKELETON_SOFT}
          style={{ marginTop: 10 }}
        />
        <Skeleton
          width="72%"
          height={13}
          borderRadius={5}
          color={SKELETON_SOFT}
          style={{ marginTop: 6 }}
        />
        <Skeleton
          width={124}
          height={38}
          borderRadius={19}
          style={{ marginTop: 16 }}
        />
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeaderRow}>
        <Skeleton width={160} height={20} borderRadius={6} />
        <Skeleton
          width={56}
          height={14}
          borderRadius={5}
          color={SKELETON_SOFT}
        />
      </View>

      {/* Member cards */}
      <MemberCardSkeleton />
    </View>
  );
}

/**
 * Icon + text bar row used inside the list card skeleton
 */
function InfoLineSkeleton({ textWidth = "70%" }) {
  return (
    <View style={styles.infoLineRow}>
      <Skeleton width={20} height={20} borderRadius={7} />
      <Skeleton
        width={textWidth}
        height={11}
        borderRadius={4}
        color={SKELETON_SOFT}
        style={{ marginLeft: 7 }}
      />
    </View>
  );
}

/**
 * List card skeleton for Interests, Shortlist, Profile Viewers.
 * Mirrors the real card: header strip, portrait photo + details, 2 buttons.
 */
export function ListItemSkeleton() {
  return (
    <View style={styles.listItemCard}>
      {/* Header strip */}
      <View style={styles.listItemHeader}>
        <View style={styles.listItemHeaderLeft}>
          <Skeleton width={14} height={14} borderRadius={7} />
          <Skeleton
            width={112}
            height={11}
            borderRadius={4}
            color={SKELETON_SOFT}
            style={{ marginLeft: 6 }}
          />
        </View>
        <Skeleton width={86} height={24} borderRadius={10} />
      </View>

      {/* Photo + details */}
      <View style={styles.listItemTop}>
        <Skeleton width={92} height={120} borderRadius={16} />
        <View style={styles.listItemBody}>
          <Skeleton width="62%" height={17} borderRadius={6} />
          <Skeleton
            width={86}
            height={18}
            borderRadius={7}
            color={SKELETON_SOFT}
            style={{ marginTop: 7 }}
          />
          <View style={styles.listItemChips}>
            <Skeleton width={58} height={22} borderRadius={9} />
            <Skeleton width={74} height={22} borderRadius={9} />
          </View>
          <View style={styles.listItemLines}>
            <InfoLineSkeleton textWidth="72%" />
            <InfoLineSkeleton textWidth="58%" />
            <InfoLineSkeleton textWidth="46%" />
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.listItemActions}>
        <View style={{ flex: 1 }}>
          <Skeleton width="100%" height={44} borderRadius={13} />
        </View>
        <View style={{ flex: 1 }}>
          <Skeleton width="100%" height={44} borderRadius={13} />
        </View>
      </View>
    </View>
  );
}

/**
 * Summary tiles + results line skeleton shown above list cards
 */
function ListSummarySkeleton() {
  return (
    <View>
      <View style={styles.homeStatsRow}>
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
      </View>
      <Skeleton
        width={180}
        height={12}
        borderRadius={5}
        color={SKELETON_SOFT}
        style={{ marginBottom: 12, marginLeft: 4 }}
      />
    </View>
  );
}

/**
 * Interests / Shortlist feed skeleton
 */
export function ListFeedSkeleton({ count = 4, showSummary = true }) {
  return (
    <View style={styles.listFeedContainer}>
      {showSummary ? <ListSummarySkeleton /> : null}
      {Array.from({ length: count }).map((_, idx) => (
        <ListItemSkeleton key={`list_skeleton_${idx}`} />
      ))}
    </View>
  );
}

/**
 * Package plan card skeleton for PackagesScreen
 */
export function PackageCardSkeleton() {
  return (
    <View style={styles.packageCard}>
      <View style={styles.packageCardHeader}>
        <View style={{ flex: 1 }}>
          <Skeleton width={130} height={20} borderRadius={6} />
          <Skeleton
            width={86}
            height={12}
            borderRadius={4}
            color={SKELETON_SOFT}
            style={{ marginTop: 7 }}
          />
        </View>
        <Skeleton width={74} height={32} borderRadius={10} />
      </View>

      <View style={styles.packageDivider} />

      <View style={styles.packageFeatures}>
        {["85%", "74%", "80%", "62%"].map((w, i) => (
          <View key={`pkg_feat_${i}`} style={styles.packageFeatureRow}>
            <Skeleton width={16} height={16} borderRadius={8} />
            <Skeleton
              width={w}
              height={13}
              borderRadius={5}
              color={SKELETON_SOFT}
              style={{ marginLeft: 10 }}
            />
          </View>
        ))}
      </View>

      <Skeleton width="100%" height={46} borderRadius={14} />
    </View>
  );
}

/**
 * Full feed skeleton for PackagesScreen
 */
export function PackagesSkeleton({ count = 3 }) {
  return (
    <View style={styles.packagesContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <PackageCardSkeleton key={`pkg_skeleton_${idx}`} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  /* Active members feed */
  feedContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  resultsPillWrap: {
    marginBottom: 12,
  },
  memberCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EFE8E3",
    overflow: "hidden",
  },
  memberPhotoWrap: {
    width: "100%",
    height: 220,
    position: "relative",
  },
  memberPhotoOverlayTop: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  memberPhotoOverlayBottom: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  memberCardBody: {
    padding: 14,
  },
  memberNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberAttributesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
  },
  memberDivider: {
    height: 1,
    backgroundColor: "#F3EEEA",
    marginVertical: 12,
  },
  memberActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  /* Home */
  homeContainer: {
    padding: 16,
  },
  homeStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  homeStatBox: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#EFE8E3",
  },
  homePromoBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EFE8E3",
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  /* List cards (Interests / Shortlist / Viewers) */
  listFeedContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listItemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EFE8E3",
    borderLeftWidth: 4,
    borderLeftColor: "#E6DDD7",
  },
  listItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 11,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3EEEA",
  },
  listItemHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  listItemTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  listItemBody: {
    flex: 1,
    marginLeft: 14,
  },
  listItemChips: {
    flexDirection: "row",
    gap: 5,
    marginTop: 10,
  },
  listItemLines: {
    marginTop: 9,
    gap: 6,
  },
  infoLineRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  listItemActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },

  /* Packages */
  packagesContainer: {
    padding: 16,
  },
  packageCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EFE8E3",
  },
  packageCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  packageDivider: {
    height: 1,
    backgroundColor: "#F3EEEA",
    marginVertical: 14,
  },
  packageFeatures: {
    gap: 11,
    marginBottom: 16,
  },
  packageFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});

export default Skeleton;
