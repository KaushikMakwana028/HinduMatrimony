import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
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
import { COLORS, FONTS } from "../theme";

export default function ChangePasswordScreen({ navigation }) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleChangePassword = async () => {
    setErrorMsg("");

    if (!token) {
      Alert.alert("Authentication Required", "Please sign in again to change your password.");
      return;
    }

    if (!oldPassword.trim()) {
      setErrorMsg("Please enter your current password.");
      return;
    }

    if (!newPassword.trim()) {
      setErrorMsg("Please enter your new password.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword === oldPassword) {
      setErrorMsg("New password cannot be the same as your current password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("New password and confirm password do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await memberService.changePassword(
        {
          old_password: oldPassword.trim(),
          password: newPassword.trim(),
          password_confirmation: confirmPassword.trim(),
        },
        token
      );

      Alert.alert(
        "Password Updated 🎉",
        response?.message || "Your password has been changed successfully.",
        [
          {
            text: "Done",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err) {
      console.log("Change password error:", err?.message);
      setErrorMsg(err?.message || "Failed to update password. Please check your current password.");
      Alert.alert("Update Failed", err?.message || "Could not change password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordsMismatch = newPassword && confirmPassword && newPassword !== confirmPassword;

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      {/* Header */}
      <ScreenHeader
        title="Change Password"
        subtitle="Keep your account safe and secure"
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
        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={24} color={COLORS.primary || "#F9407F"} />
          </View>
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoTitle}>Protect Your Account</Text>
            <Text style={styles.infoDesc}>
              Choose a strong, unique password with letters, numbers, and symbols to keep your
              profile secure.
            </Text>
          </View>
        </View>

        {/* Error message banner */}
        {!!errorMsg && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.formCard}>
          {/* Current password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Current Password <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Enter current password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showOld}
                value={oldPassword}
                onChangeText={(t) => {
                  setOldPassword(t);
                  if (errorMsg) setErrorMsg("");
                }}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowOld((prev) => !prev)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showOld ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* New password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              New Password <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Enter new password (min. 6 chars)"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={(t) => {
                  setNewPassword(t);
                  if (errorMsg) setErrorMsg("");
                }}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowNew((prev) => !prev)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showNew ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm new password */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>
                Confirm New Password <Text style={styles.requiredStar}>*</Text>
              </Text>
              {passwordsMatch && (
                <View style={styles.matchPill}>
                  <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                  <Text style={styles.matchText}>Passwords match</Text>
                </View>
              )}
              {passwordsMismatch && (
                <Text style={styles.mismatchText}>Passwords do not match</Text>
              )}
            </View>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Confirm your new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  if (errorMsg) setErrorMsg("");
                }}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirm((prev) => !prev)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.65 }]}
            onPress={handleChangePassword}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </View>
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
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF1F5",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FCE7F3",
    marginBottom: 16,
  },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold || "System",
    color: COLORS.primary || "#F9407F",
  },
  infoDesc: {
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: "#6B7280",
    marginTop: 2,
    lineHeight: 17,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.medium || "System",
    color: "#DC2626",
    lineHeight: 17,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
    color: COLORS.text || "#374151",
    marginBottom: 6,
  },
  requiredStar: {
    color: "#EF4444",
  },
  matchPill: {
    flexDirection: "row",
    alignItems: "center",
  },
  matchText: {
    fontSize: 11,
    fontFamily: FONTS.medium || "System",
    color: "#15803D",
    marginLeft: 3,
  },
  mismatchText: {
    fontSize: 11,
    fontFamily: FONTS.medium || "System",
    color: "#DC2626",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: FONTS.regular || "System",
    color: COLORS.text || "#111827",
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    backgroundColor: COLORS.primary || "#F9407F",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    elevation: 2,
    shadowColor: COLORS.primary || "#F9407F",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONTS.semiBold || "System",
  },
});
