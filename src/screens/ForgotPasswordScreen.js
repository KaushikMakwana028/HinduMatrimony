import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { authService } from "../services/authService";
import { COLORS, FONTS } from "../theme";

const RESEND_SECONDS = 30;

function Notice({ type, message }) {
  if (!message) return null;
  const isError = type === "error";
  return (
    <View
      style={[
        styles.notice,
        isError ? styles.noticeError : styles.noticeSuccess,
      ]}
    >
      <Ionicons
        name={isError ? "alert-circle" : "checkmark-circle"}
        size={18}
        color={isError ? "#DC2626" : "#16A34A"}
        style={{ marginRight: 8 }}
      />
      <Text
        style={[styles.noticeText, { color: isError ? "#DC2626" : "#16A34A" }]}
      >
        {message}
      </Text>
    </View>
  );
}

function Field({
  label,
  icon,
  focused,
  onFocusChange,
  inputRef,
  right,
  style,
  inputStyle,
  ...inputProps
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <Ionicons
          name={icon}
          size={18}
          color={focused ? COLORS.primary : COLORS.textLight}
          style={styles.inputIcon}
        />
        <TextInput
          ref={inputRef}
          style={[styles.input, inputStyle]}
          placeholderTextColor={COLORS.textLight}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          {...inputProps}
        />
        {right}
      </View>
    </View>
  );
}

export default function ForgotPasswordScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(
    insets.top,
    Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0
  );
  const initialValue = route?.params?.emailOrPhone || "";
  const initialMode = initialValue.includes("@") ? "email" : "phone";

  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const [sendCodeBy, setSendCodeBy] = useState(initialMode);
  const [emailOrPhone, setEmailOrPhone] = useState(initialValue);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focused, setFocused] = useState(null);

  const [step, setStep] = useState(1); // 1 = Request Code, 2 = Enter Code & Reset
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const focusProps = (name) => ({
    focused: focused === name,
    onFocusChange: (isFocused) => setFocused(isFocused ? name : null),
  });

  // Resend countdown
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const goBackStep = () => {
    if (step === 2) {
      setStep(1);
      setError("");
    } else {
      navigation.goBack();
    }
  };

  // Step 1: Send Code
  const handleSendCode = async () => {
    setError("");
    const trimmed = emailOrPhone.trim();
    if (!trimmed) {
      setError(
        sendCodeBy === "email"
          ? "Please enter your registered email address"
          : "Please enter your registered phone number",
      );
      return;
    }

    if (sendCodeBy === "email" && !/\S+@\S+\.\S+/.test(trimmed)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const response = await authService.forgotPassword({
        send_code_by: sendCodeBy,
        email_or_phone: trimmed,
      });

      setSuccessMessage(
        response?.message ||
          `A verification code has been sent to your ${sendCodeBy}.`,
      );
      setCooldown(RESEND_SECONDS);
      setStep(2);
    } catch (err) {
      setError(
        err?.message ||
          "Failed to send verification code. Please check your input.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Resend Code
  const handleResendCode = async () => {
    if (cooldown > 0 || resending) return;
    setError("");
    setResending(true);
    try {
      const response = await authService.forgotPassword({
        send_code_by: sendCodeBy,
        email_or_phone: emailOrPhone.trim(),
      });
      setCooldown(RESEND_SECONDS);
      setCode("");
      setSuccessMessage(
        response?.message ||
          `A new code has been sent to your ${sendCodeBy}. Please enter the latest code from your inbox.`,
      );
      Alert.alert(
        "Code resent",
        response?.message || `A new code has been sent to your ${sendCodeBy}.`,
      );
    } catch (err) {
      Alert.alert("Notice", err?.message || "Could not resend code.");
    } finally {
      setResending(false);
    }
  };

  // Step 2: Reset Password
  const handleResetPassword = async () => {
    setError("");
    setSuccessMessage("");
    const cleanCode = code.replace(/\s+/g, "").trim();
    if (!cleanCode) {
      setError("Please enter the verification code sent to you");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await authService.resetPassword({
        send_code_by: sendCodeBy,
        email_or_phone: emailOrPhone.trim(),
        code: cleanCode,
        verification_code: cleanCode,
        password: newPassword,
        password_confirmation: confirmPassword,
      });

      Alert.alert(
        "Password reset",
        response?.message ||
          "Your password has been changed. You can now sign in with your new password.",
        [
          {
            text: "Sign in",
            onPress: () =>
              navigation.navigate("Login", { email: emailOrPhone.trim() }),
          },
        ],
      );
    } catch (err) {
      setError(
        err?.message ||
          "Failed to reset password. Please check your verification code.",
      );
    } finally {
      setLoading(false);
    }
  };

  const passwordLongEnough = newPassword.length >= 8;
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  const eyeButton = (visible, toggle) => (
    <TouchableOpacity
      onPress={toggle}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel={visible ? "Hide password" : "Show password"}
    >
      <Ionicons
        name={visible ? "eye-off-outline" : "eye-outline"}
        size={20}
        color={COLORS.textLight}
      />
    </TouchableOpacity>
  );

  return (
    <KeyboardAwareScrollView
      style={styles.screen}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />

      {/* ---------- Banner ---------- */}
      <View style={[styles.banner, { paddingTop: safeTop + 14 }]}>
        <View style={[styles.bannerCircle, styles.bannerCircleA]} />
        <View style={[styles.bannerCircle, styles.bannerCircleB]} />

        <View style={styles.bannerTopRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={goBackStep}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.stepWrap}>
            <Text style={styles.stepText}>Step {step} of 2</Text>
            <View style={styles.stepBars}>
              <View style={[styles.stepBar, styles.stepBarOn]} />
              <View style={[styles.stepBar, step === 2 && styles.stepBarOn]} />
            </View>
          </View>
        </View>

        <View style={styles.iconBadge}>
          <Ionicons
            name={step === 1 ? "lock-closed" : "key"}
            size={26}
            color={COLORS.primary}
          />
        </View>
        <Text style={styles.title}>
          {step === 1 ? "Forgot your password?" : "Create a new password"}
        </Text>
        <Text style={styles.subtitle}>
          {step === 1
            ? "No worries. Choose where to receive a verification code and we will help you get back in."
            : `Enter the code we sent to ${emailOrPhone.trim()} and choose a new password.`}
        </Text>
      </View>

      {/* ---------- Card ---------- */}
      <View style={styles.card}>
        <Notice type="error" message={error} />
        {step === 2 ? <Notice type="success" message={successMessage} /> : null}

        {step === 1 ? (
          <>
            {/* Delivery method */}
            <View style={styles.segmentContainer}>
              {[
                { key: "email", label: "Email", icon: "mail-outline" },
                { key: "phone", label: "Phone", icon: "call-outline" },
              ].map((opt) => {
                const active = sendCodeBy === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.segmentBtn,
                      active && styles.segmentBtnActive,
                    ]}
                    onPress={() => {
                      setSendCodeBy(opt.key);
                      setError("");
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={active ? COLORS.primary : COLORS.textLight}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Field
              label={
                sendCodeBy === "email"
                  ? "Registered email address"
                  : "Registered phone number"
              }
              icon={
                sendCodeBy === "email"
                  ? "mail-outline"
                  : "phone-portrait-outline"
              }
              placeholder={
                sendCodeBy === "email" ? "name@example.com" : "9876543210"
              }
              value={emailOrPhone}
              onChangeText={(t) => {
                setEmailOrPhone(t);
                setError("");
              }}
              keyboardType={
                sendCodeBy === "email" ? "email-address" : "phone-pad"
              }
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleSendCode}
              right={
                emailOrPhone ? (
                  <TouchableOpacity
                    onPress={() => setEmailOrPhone("")}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Clear"
                  >
                    <Ionicons name="close-circle" size={18} color="#C4B8AF" />
                  </TouchableOpacity>
                ) : null
              }
              {...focusProps("identifier")}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleSendCode}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.primaryBtnText}>
                    Send verification code
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={17}
                    color="#fff"
                    style={{ marginLeft: 8 }}
                  />
                </View>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Destination */}
            <View style={styles.destRow}>
              <View style={styles.destIcon}>
                <Ionicons
                  name={sendCodeBy === "email" ? "mail" : "call"}
                  size={14}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.destValue} numberOfLines={1}>
                {emailOrPhone}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setStep(1);
                  setCode("");
                  setError("");
                }}
                style={styles.changeLink}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.changeLinkText}>Change</Text>
              </TouchableOpacity>
            </View>

            <Field
              label="Verification code"
              icon="shield-checkmark-outline"
              placeholder="Enter code"
              value={code}
              onChangeText={(t) => {
                setCode(t.replace(/\s/g, ""));
                setError("");
              }}
              keyboardType="number-pad"
              maxLength={8}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              inputStyle={styles.codeInput}
              {...focusProps("code")}
            />

            <Field
              label="New password"
              icon="lock-closed-outline"
              placeholder="At least 8 characters"
              inputRef={passwordRef}
              secureTextEntry={!showPassword}
              value={newPassword}
              onChangeText={(t) => {
                setNewPassword(t);
                setError("");
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => confirmRef.current?.focus()}
              right={eyeButton(showPassword, () => setShowPassword((p) => !p))}
              {...focusProps("password")}
            />
            <View style={styles.hintRow}>
              <Ionicons
                name={
                  passwordLongEnough ? "checkmark-circle" : "ellipse-outline"
                }
                size={14}
                color={passwordLongEnough ? "#059669" : COLORS.textLight}
              />
              <Text
                style={[
                  styles.hintText,
                  passwordLongEnough && { color: "#059669" },
                ]}
              >
                At least 8 characters
              </Text>
            </View>

            <Field
              label="Confirm new password"
              icon="shield-checkmark-outline"
              placeholder="Re-enter password"
              inputRef={confirmRef}
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                setError("");
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleResetPassword}
              right={eyeButton(showConfirmPassword, () =>
                setShowConfirmPassword((p) => !p),
              )}
              {...focusProps("confirm")}
            />
            {passwordsMatch ? (
              <View style={styles.hintRow}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={[styles.hintText, { color: "#059669" }]}>
                  Passwords match
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Reset password</Text>
              )}
            </TouchableOpacity>

            <View style={styles.resendRow}>
              <Text style={styles.resendText}>
                {"Didn't receive the code? "}
              </Text>
              {cooldown > 0 ? (
                <Text style={styles.resendWait}>Resend in {cooldown}s</Text>
              ) : (
                <TouchableOpacity
                  onPress={handleResendCode}
                  disabled={resending}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resendLink}>
                    {resending ? "Sending..." : "Resend code"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.backToLoginBtn}
        onPress={() => navigation.navigate("Login")}
        activeOpacity={0.7}
      >
        <Ionicons
          name="arrow-back"
          size={15}
          color={COLORS.primary}
          style={{ marginRight: 6 }}
        />
        <Text style={styles.backToLoginText}>Back to sign in</Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 32,
  },

  /* ---------- Banner ---------- */
  banner: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingBottom: 64,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: "hidden",
  },
  bannerCircle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  bannerCircleA: {
    width: 200,
    height: 200,
    top: -80,
    right: -50,
  },
  bannerCircleB: {
    width: 120,
    height: 120,
    bottom: -50,
    left: -30,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  bannerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepWrap: {
    alignItems: "flex-end",
  },
  stepText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 6,
  },
  stepBars: {
    flexDirection: "row",
    gap: 5,
  },
  stepBar: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  stepBarOn: {
    backgroundColor: "#fff",
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 26,
    fontFamily: FONTS.bold,
    color: "#fff",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "rgba(255,255,255,0.9)",
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 320,
  },

  /* ---------- Card ---------- */
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 16,
    marginTop: -36,
    shadowColor: "#7A4A2B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  noticeError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  noticeSuccess: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: FONTS.medium,
    lineHeight: 17,
  },

  /* ---------- Segment ---------- */
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#F3EDE8",
    borderRadius: 16,
    padding: 4,
    marginBottom: 18,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  segmentTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },

  /* ---------- Fields ---------- */
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginBottom: 7,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#FFFCF9",
  },
  inputWrapFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  codeInput: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    letterSpacing: 4,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -4,
    marginBottom: 12,
  },
  hintText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
  },

  /* ---------- Destination ---------- */
  destRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7FA",
    borderWidth: 1,
    borderColor: "#FCE7F3",
    padding: 10,
    borderRadius: 14,
    marginBottom: 16,
  },
  destIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFE4EE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  destValue: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  changeLink: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  changeLinkText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },

  /* ---------- Buttons ---------- */
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.2,
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
  },
  resendText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
  },
  resendLink: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  resendWait: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  backToLoginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 14,
  },
  backToLoginText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
});
