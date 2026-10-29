import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { COLORS, FONTS } from "../theme";

export default function LoginScreen({ navigation }) {
  const { login, loginAsDemo } = useAuth();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(
    insets.top,
    Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0
  );
  const scrollViewRef = useRef(null);
  const passwordRef = useRef(null);

  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleGuestLogin = async () => {
    setDemoLoading(true);
    try {
      if (loginAsDemo) {
        await loginAsDemo();
      }
      navigation.replace("MainTabs");
    } catch (error) {
      console.log("Demo login error:", error?.message);
      navigation.replace("MainTabs");
    } finally {
      setDemoLoading(false);
    }
  };

  const validate = () => {
    const e = {};
    const trimmed = emailOrPhone.trim();

    if (!trimmed) {
      e.emailOrPhone = "Email or phone number is required";
    } else if (trimmed.includes("@")) {
      if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
        e.emailOrPhone = "Enter a valid email address";
      }
    } else {
      const cleanPhone = trimmed.replace(/\D/g, "");
      if (cleanPhone.length < 8) {
        e.emailOrPhone = "Enter a valid phone number or email";
      }
    }

    if (!password) {
      e.password = "Password is required";
    } else if (password.length < 6) {
      e.password = "Minimum 6 characters";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await login({
        email_or_phone: emailOrPhone.trim(),
        password,
      });

      if (response && response.result !== false) {
        navigation.replace("MainTabs");
      } else {
        Alert.alert(
          "Login failed",
          response?.message || "Invalid credentials. Please try again.",
        );
      }
    } catch (error) {
      console.log("Login error:", error?.message);
      Alert.alert(
        "Login error",
        error.message || "Failed to sign in. Please check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = (name) => [
    styles.inputWrap,
    focusedField === name && styles.inputWrapFocused,
    errors[name] && styles.inputWrapError,
  ];

  return (
    <KeyboardAwareScrollView
      ref={scrollViewRef}
      style={styles.screen}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />

      {/* ---------- Brand banner ---------- */}
      <View style={[styles.banner, { paddingTop: safeTop + 24 }]}>
        <View style={[styles.bannerCircle, styles.bannerCircleA]} />
        <View style={[styles.bannerCircle, styles.bannerCircleB]} />

        <View style={styles.logoMark}>
          <Ionicons name="heart" size={30} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Hindu Matrimony</Text>
        <Text style={styles.subtitle}>
          Find your life partner with values and traditions
        </Text>
      </View>

      {/* ---------- Sign-in card ---------- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome back</Text>
        <Text style={styles.cardSubtitle}>Sign in to continue your search</Text>

        <Text style={styles.label}>Email or phone</Text>
        <View style={fieldStyle("emailOrPhone")}>
          <Ionicons
            name="person-outline"
            size={18}
            color={
              focusedField === "emailOrPhone"
                ? COLORS.primary
                : COLORS.textLight
            }
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="you@example.com or 9876543210"
            placeholderTextColor={COLORS.textLight}
            value={emailOrPhone}
            onChangeText={(t) => {
              setEmailOrPhone(t);
              setErrors((p) => ({ ...p, emailOrPhone: undefined }));
            }}
            onFocus={() => setFocusedField("emailOrPhone")}
            onBlur={() => setFocusedField(null)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>
        {errors.emailOrPhone ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={13} color={COLORS.error} />
            <Text style={styles.error}>{errors.emailOrPhone}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Password</Text>
        <View style={fieldStyle("password")}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={
              focusedField === "password" ? COLORS.primary : COLORS.textLight
            }
            style={styles.inputIcon}
          />
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor={COLORS.textLight}
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setErrors((p) => ({ ...p, password: undefined }));
            }}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={
              showPassword ? "Hide password" : "Show password"
            }
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={COLORS.textLight}
            />
          </TouchableOpacity>
        </View>
        {errors.password ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={13} color={COLORS.error} />
            <Text style={styles.error}>{errors.password}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.forgot}
          onPress={() =>
            navigation.navigate("ForgotPassword", {
              emailOrPhone: emailOrPhone.trim(),
            })
          }
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryBtnText}>Sign in</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.or}>or</Text>
          <View style={styles.line} />
        </View>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate("Signup")}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryBtnText}>Create new account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.guestBtn}
          onPress={handleGuestLogin}
          disabled={loading || demoLoading}
          activeOpacity={0.7}
        >
          {demoLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.guestBtnText}>Browse without signing in</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>
        By continuing, you agree to our Terms & Privacy Policy
      </Text>
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
    alignItems: "center",
    paddingHorizontal: 28,
    paddingBottom: 76,
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
    width: 220,
    height: 220,
    top: -90,
    right: -60,
  },
  bannerCircleB: {
    width: 130,
    height: 130,
    bottom: -50,
    left: -30,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  logoMark: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: "#fff",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 280,
  },

  /* ---------- Card ---------- */
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 22,
    marginHorizontal: 20,
    marginTop: -44,
    shadowColor: "#7A4A2B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 2,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 12,
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
  inputWrapError: {
    borderColor: COLORS.error,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  error: {
    color: COLORS.error,
    fontSize: 12,
    fontFamily: FONTS.regular,
    flex: 1,
  },
  forgot: {
    alignSelf: "flex-end",
    marginTop: 12,
    marginBottom: 20,
  },
  forgotText: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },

  /* ---------- Buttons ---------- */
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },
  or: {
    marginHorizontal: 12,
    color: COLORS.textLight,
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#FFF7FA",
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 15,
    fontFamily: FONTS.semiBold,
  },
  guestBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  guestBtnText: {
    color: COLORS.textLight,
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  footer: {
    textAlign: "center",
    marginTop: 22,
    paddingHorizontal: 30,
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    lineHeight: 17,
  },
});
