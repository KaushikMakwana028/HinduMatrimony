import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import ScreenHeader from "../components/ScreenHeader";
import { useAuth } from "../contexts/AuthContext";
import memberService from "../services/memberService";
import { emitMemberAction } from "../services/memberEvents";
import { COLORS, FONTS } from "../theme";

const DEACTIVATE_REASONS = [
  "Taking a temporary break",
  "Busy with work or exams",
  "Already speaking with a potential match",
  "Receiving too many calls or messages",
  "Other personal reasons",
];

export default function DeactivateAccountScreen({ navigation }) {
  const { user, token, updateUser } = useAuth();
  const insets = useSafeAreaInsets();

  const isDeactivated = Boolean(
    user?.deactivated === 1 ||
      user?.deactivation_status === 1 ||
      user?.is_deactivated === 1
  );

  const [selectedReason, setSelectedReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Activate Account
  const handleActivate = async () => {
    Alert.alert(
      "Activate Account",
      "Are you sure you want to activate your account? Your profile will be visible to potential matches again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Activate Account",
          onPress: async () => {
            setLoading(true);
            try {
              const response = await memberService.deactivateAccount(token, {
                deacticvation_status: 0,
                deactivation_status: 0,
              });

              if (updateUser) {
                await updateUser({
                  deactivated: 0,
                  deactivation_status: 0,
                  is_deactivated: 0,
                });
              }
              emitMemberAction({ type: "profile_updated" });

              Alert.alert(
                "Account Activated 🎉",
                response?.message ||
                  "Your profile is now active and visible to matches.",
                [
                  {
                    text: "View Profile",
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (err) {
              console.log("Activate account error:", err?.message);
              Alert.alert(
                "Activation Failed",
                err?.message || "Could not activate account. Please try again."
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Deactivate Account
  const handleDeactivate = async () => {
    if (!confirmed) {
      Alert.alert(
        "Confirmation Required",
        "Please check the box confirming you understand your profile will be hidden."
      );
      return;
    }

    Alert.alert(
      "Confirm Deactivation",
      "Are you sure you want to deactivate your account? Your profile will be hidden from matches, but all your data remains safe. You can activate it anytime.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const response = await memberService.deactivateAccount(token, {
                deacticvation_status: 1,
                deactivation_status: 1,
              });

              if (updateUser) {
                await updateUser({
                  deactivated: 1,
                  deactivation_status: 1,
                  is_deactivated: 1,
                });
              }
              emitMemberAction({ type: "profile_updated" });

              Alert.alert(
                "Account Deactivated",
                response?.message ||
                  "Your account is now paused. You can activate your profile anytime.",
                [
                  {
                    text: "OK",
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (err) {
              console.log("Deactivate account error:", err?.message);
              Alert.alert(
                "Deactivation Failed",
                err?.message || "Could not deactivate account. Please try again."
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      {/* Header */}
      <ScreenHeader
        title={isDeactivated ? "Activate Account" : "Deactivate Account"}
        subtitle={
          isDeactivated
            ? "Resume your profile visibility"
            : "Pause your profile temporarily"
        }
        showBack
        onBack={() => navigation.goBack()}
      />

      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 24) + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isDeactivated ? (
          <>
            {/* Green Activate Banner */}
            <View style={[styles.pauseCard, styles.activePauseCard]}>
              <View style={[styles.pauseIconCircle, styles.activeIconCircle]}>
                <Ionicons name="play-circle" size={28} color="#10B981" />
              </View>
              <Text style={styles.pauseTitle}>Your Profile is Currently Paused</Text>
              <Text style={styles.pauseSubtitle}>
                Your profile is currently hidden from matches. Activate your profile
                anytime to start receiving interests and appearing in searches again.
              </Text>
            </View>

            {/* Benefits of Activating */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>
                When you activate your account:
              </Text>

              <View style={styles.factRow}>
                <View style={styles.checkIconWrap}>
                  <Ionicons name="checkmark" size={14} color="#15803D" />
                </View>
                <Text style={styles.factText}>
                  Your profile will immediately appear in active member searches and recommendations.
                </Text>
              </View>

              <View style={styles.factRow}>
                <View style={styles.checkIconWrap}>
                  <Ionicons name="checkmark" size={14} color="#15803D" />
                </View>
                <Text style={styles.factText}>
                  Other members can view your profile and express interest in you.
                </Text>
              </View>

              <View style={styles.factRow}>
                <View style={styles.checkIconWrap}>
                  <Ionicons name="checkmark" size={14} color="#15803D" />
                </View>
                <Text style={styles.factText}>
                  All your uploaded photos, saved shortlists, and chats remain 100% saved.
                </Text>
              </View>
            </View>

            {/* Activate Button */}
            <TouchableOpacity
              style={[styles.deactivateBtn, { backgroundColor: "#10B981" }]}
              onPress={handleActivate}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons
                    name="play-circle-outline"
                    size={20}
                    color="#FFFFFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.deactivateBtnText}>Activate My Account</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Keep Account Paused</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Amber Pause Banner */}
            <View style={styles.pauseCard}>
              <View style={styles.pauseIconCircle}>
                <Ionicons name="pause" size={26} color="#D97706" />
              </View>
              <Text style={styles.pauseTitle}>Need a Temporary Break?</Text>
              <Text style={styles.pauseSubtitle}>
                Deactivation is temporary. Your profile is paused, not deleted.
              </Text>
            </View>

            {/* Benefits/Facts Card */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>
                What happens when you deactivate:
              </Text>

              <View style={styles.factRow}>
                <View style={styles.checkIconWrap}>
                  <Ionicons name="checkmark" size={14} color="#15803D" />
                </View>
                <Text style={styles.factText}>
                  Your profile will be hidden from searches and match listings immediately.
                </Text>
              </View>

              <View style={styles.factRow}>
                <View style={styles.checkIconWrap}>
                  <Ionicons name="checkmark" size={14} color="#15803D" />
                </View>
                <Text style={styles.factText}>
                  Members will not be able to send you new interests or view your contact.
                </Text>
              </View>

              <View style={styles.factRow}>
                <View style={styles.checkIconWrap}>
                  <Ionicons name="checkmark" size={14} color="#15803D" />
                </View>
                <Text style={styles.factText}>
                  Your uploaded photos, shortlist, and profile details remain 100% saved.
                </Text>
              </View>

              <View style={styles.factRow}>
                <View style={styles.checkIconWrap}>
                  <Ionicons name="checkmark" size={14} color="#15803D" />
                </View>
                <Text style={styles.factText}>
                  You can reactivate and restore your profile anytime by simply activating your account.
                </Text>
              </View>
            </View>

            {/* Reasons */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>Please tell us why you are leaving:</Text>
              {DEACTIVATE_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonRow,
                      isSelected && styles.reasonRowSelected,
                    ]}
                    onPress={() => setSelectedReason(reason)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                    <Text
                      style={[
                        styles.reasonText,
                        isSelected && styles.reasonTextSelected,
                      ]}
                    >
                      {reason}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Confirmation Checkbox */}
            <TouchableOpacity
              style={styles.confirmBox}
              onPress={() => setConfirmed((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, confirmed && styles.checkboxActive]}>
                {confirmed && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
              </View>
              <Text style={styles.confirmText}>
                I understand that my profile will be hidden from everyone until I reactivate it.
              </Text>
            </TouchableOpacity>

            {/* Deactivate Button */}
            <TouchableOpacity
              style={[
                styles.deactivateBtn,
                (!confirmed || loading) && { opacity: 0.6 },
              ]}
              onPress={handleDeactivate}
              disabled={!confirmed || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons
                    name="pause-circle-outline"
                    size={18}
                    color="#FFFFFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.deactivateBtnText}>Deactivate My Account</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Keep My Account Active</Text>
            </TouchableOpacity>
          </>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background || "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
  },
  scroll: {
    padding: 16,
  },
  pauseCard: {
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 16,
  },
  pauseIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  pauseTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold || "System",
    color: "#B45309",
    textAlign: "center",
  },
  pauseSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: "#78350F",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  cardHeading: {
    fontSize: 14,
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
    marginBottom: 12,
  },
  factRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  checkIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 1,
  },
  factText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: "#374151",
    lineHeight: 18,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "transparent",
  },
  reasonRowSelected: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  radioCircleSelected: {
    borderColor: "#D97706",
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D97706",
  },
  reasonText: {
    fontSize: 13,
    fontFamily: FONTS.medium || "System",
    color: "#4B5563",
    flex: 1,
  },
  reasonTextSelected: {
    color: "#92400E",
    fontFamily: FONTS.semiBold || "System",
  },
  confirmBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: "#D97706",
    borderColor: "#D97706",
  },
  confirmText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.medium || "System",
    color: COLORS.text || "#111827",
    lineHeight: 17,
  },
  deactivateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D97706",
    borderRadius: 12,
    paddingVertical: 14,
    elevation: 2,
    shadowColor: "#D97706",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  deactivateBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONTS.semiBold || "System",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 6,
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: FONTS.medium || "System",
    color: COLORS.textSecondary || "#6B7280",
  },
});
