import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { COLORS, FONTS } from "../theme";

const ON_BEHALF_LIST = [
  { label: "My Self", id: "1", icon: "person-outline" },
  { label: "My Daughter", id: "2", icon: "flower-outline" },
  { label: "My Son", id: "3", icon: "happy-outline" },
  { label: "My Sister", id: "4", icon: "people-outline" },
  { label: "My Brother", id: "5", icon: "people-outline" },
  { label: "My Relative", id: "6", icon: "home-outline" },
  { label: "My Friend", id: "7", icon: "heart-outline" },
];

const GENDER_OPTIONS = [
  { value: "Male", icon: "male-outline" },
  { value: "Female", icon: "female-outline" },
];

function formatDobForApi(dob) {
  if (!dob) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) return dob;
  const parts = dob.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return dob;
}

/* ------------------------------------------------------------------ */
/* Reusable pieces                                                     */
/* ------------------------------------------------------------------ */

function FormSection({ icon, title, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={15} color={COLORS.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle" size={13} color={COLORS.error} />
      <Text style={styles.error}>{message}</Text>
    </View>
  );
}

function Field({
  label,
  icon,
  error,
  focused,
  onFocusChange,
  inputRef,
  prefix,
  right,
  style,
  ...inputProps
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          focused && styles.inputWrapFocused,
          error && styles.inputWrapError,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? COLORS.primary : COLORS.textLight}
            style={styles.inputIcon}
          />
        ) : null}
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholderTextColor={COLORS.textLight}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          {...inputProps}
        />
        {right}
      </View>
      <FieldError message={error} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function SignupScreen({ navigation }) {
  const { register } = useAuth();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(
    insets.top,
    Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0
  );
  const scrollViewRef = useRef(null);

  const lastNameRef = useRef(null);
  const dobRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const [form, setForm] = useState({
    onBehalf: "",
    onBehalfId: "1",
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreed: false,
  });
  const [errors, setErrors] = useState({});
  const [picker, setPicker] = useState(null); // "onBehalf"
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const update = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const focusProps = (name) => ({
    focused: focused === name,
    onFocusChange: (isFocused) => setFocused(isFocused ? name : null),
  });

  const validate = () => {
    const e = {};
    if (!form.onBehalf) e.onBehalf = "Please select profile relation";
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";
    if (!form.gender) e.gender = "Please select gender";
    if (!form.dob.trim()) {
      e.dob = "Date of birth is required";
    } else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(form.dob)) {
      e.dob = "Use format DD/MM/YYYY";
    }

    const emailTrimmed = form.email.trim();
    if (!emailTrimmed) {
      e.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(emailTrimmed)) {
      e.email = "Invalid email address";
    }

    const cleanPhone = form.phone.replace(/\D/g, "");
    if (!cleanPhone) {
      e.phone = "Phone number is required";
    } else if (cleanPhone.length < 10) {
      e.phone = "Enter a valid 10-digit phone number";
    }

    if (!form.password) {
      e.password = "Password is required";
    } else if (form.password.length < 8) {
      e.password = "Password must be at least 8 characters";
    }

    if (!form.confirmPassword) {
      e.confirmPassword = "Please confirm your password";
    } else if (form.password !== form.confirmPassword) {
      e.confirmPassword = "Passwords do not match";
    }

    if (!form.agreed) {
      e.agreed = "You must accept the terms & conditions";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/\D/g, ""),
        password: form.password,
        password_confirmation: form.confirmPassword,
        gender: form.gender.toLowerCase(),
        date_of_birth: formatDobForApi(form.dob),
        on_behalf: form.onBehalfId || "1",
      };

      const response = await register(payload);

      if (response && response.result !== false) {
        Alert.alert(
          "Welcome",
          response?.message || "Account created successfully!",
          [
            {
              text: "Continue",
              onPress: () => navigation.replace("MainTabs"),
            },
          ],
        );
      } else {
        Alert.alert(
          "Signup failed",
          response?.message || "Failed to create account. Please try again.",
        );
      }
    } catch (error) {
      console.log("Registration error:", error?.message);
      const msg = error.message || "";
      const fieldErrors = {};
      if (/phone/i.test(msg)) {
        fieldErrors.phone = "An user exists with this phone number";
      }
      if (/email/i.test(msg)) {
        fieldErrors.email = "An user exists with this email address";
      }
      if (Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      }
      Alert.alert(
        "Registration error",
        msg || "Failed to register. Please check your details.",
      );
    } finally {
      setLoading(false);
    }
  };

  const passwordLongEnough = form.password.length >= 8;
  const passwordsMatch =
    form.confirmPassword.length > 0 && form.password === form.confirmPassword;

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

      {/* ---------- Banner ---------- */}
      <View style={[styles.banner, { paddingTop: safeTop + 14 }]}>
        <View style={[styles.bannerCircle, styles.bannerCircleA]} />
        <View style={[styles.bannerCircle, styles.bannerCircleB]} />

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          disabled={loading}
          activeOpacity={0.8}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Join us and find your perfect match. It only takes a minute.
        </Text>
      </View>

      {/* ---------- Form card ---------- */}
      <View style={styles.card}>
        {/* Profile for */}
        <FormSection
          icon="people-circle-outline"
          title="Who is this profile for?"
        >
          <TouchableOpacity
            style={[styles.select, errors.onBehalf && styles.inputWrapError]}
            onPress={() => !loading && setPicker("onBehalf")}
            activeOpacity={0.7}
            disabled={loading}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={form.onBehalf ? COLORS.primary : COLORS.textLight}
              style={styles.inputIcon}
            />
            <Text
              style={[
                styles.selectText,
                !form.onBehalf && { color: COLORS.textLight },
              ]}
            >
              {form.onBehalf || "Select profile for"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
          <FieldError message={errors.onBehalf} />
        </FormSection>

        {/* Personal details */}
        <FormSection icon="person-circle-outline" title="Personal details">
          <View style={styles.twoCol}>
            <Field
              style={styles.col}
              label="First name"
              placeholder="John"
              value={form.firstName}
              onChangeText={(t) => update("firstName", t)}
              error={errors.firstName}
              editable={!loading}
              autoCapitalize="words"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => lastNameRef.current?.focus()}
              {...focusProps("firstName")}
            />
            <Field
              style={styles.col}
              label="Last name"
              placeholder="Doe"
              inputRef={lastNameRef}
              value={form.lastName}
              onChangeText={(t) => update("lastName", t)}
              error={errors.lastName}
              editable={!loading}
              autoCapitalize="words"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => dobRef.current?.focus()}
              {...focusProps("lastName")}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((g) => {
                const selected = form.gender === g.value;
                return (
                  <TouchableOpacity
                    key={g.value}
                    style={[
                      styles.genderBtn,
                      selected && styles.genderBtnActive,
                    ]}
                    onPress={() => !loading && update("gender", g.value)}
                    disabled={loading}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={g.icon}
                      size={18}
                      color={selected ? COLORS.primary : COLORS.textLight}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.genderText,
                        selected && styles.genderTextActive,
                      ]}
                    >
                      {g.value}
                    </Text>
                    {selected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={COLORS.primary}
                        style={{ marginLeft: "auto" }}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            <FieldError message={errors.gender} />
          </View>

          <Field
            label="Date of birth"
            icon="calendar-outline"
            placeholder="DD/MM/YYYY"
            inputRef={dobRef}
            value={form.dob}
            onChangeText={(t) => {
              const digits = t.replace(/[^0-9]/g, "").slice(0, 8);
              let formatted = digits;
              if (digits.length > 4) {
                formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
              } else if (digits.length > 2) {
                formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
              }
              update("dob", formatted);
            }}
            keyboardType="number-pad"
            maxLength={10}
            error={errors.dob}
            editable={!loading}
            {...focusProps("dob")}
          />
        </FormSection>

        {/* Contact */}
        <FormSection icon="call-outline" title="Contact details">
          <Field
            label="Email address"
            icon="mail-outline"
            placeholder="you@example.com"
            inputRef={emailRef}
            value={form.email}
            onChangeText={(t) => update("email", t)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
            editable={!loading}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => phoneRef.current?.focus()}
            {...focusProps("email")}
          />
          <Field
            label="Phone number"
            icon="phone-portrait-outline"
            prefix="+91"
            placeholder="9876543210"
            inputRef={phoneRef}
            value={form.phone}
            onChangeText={(t) =>
              update("phone", t.replace(/\D/g, "").slice(0, 10))
            }
            keyboardType="phone-pad"
            maxLength={10}
            error={errors.phone}
            editable={!loading}
            {...focusProps("phone")}
          />
        </FormSection>

        {/* Security */}
        <FormSection icon="lock-closed-outline" title="Set a password">
          <Field
            label="Password"
            icon="lock-closed-outline"
            placeholder="Minimum 8 characters"
            inputRef={passwordRef}
            value={form.password}
            onChangeText={(t) => update("password", t)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.password}
            editable={!loading}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => confirmRef.current?.focus()}
            right={
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
            }
            {...focusProps("password")}
          />
          {!errors.password ? (
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
          ) : null}

          <Field
            label="Confirm password"
            icon="shield-checkmark-outline"
            placeholder="Re-enter password"
            inputRef={confirmRef}
            value={form.confirmPassword}
            onChangeText={(t) => update("confirmPassword", t)}
            secureTextEntry={!showConfirm}
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.confirmPassword}
            editable={!loading}
            returnKeyType="go"
            onSubmitEditing={handleSignup}
            right={
              <TouchableOpacity
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={
                  showConfirm ? "Hide password" : "Show password"
                }
              >
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={COLORS.textLight}
                />
              </TouchableOpacity>
            }
            {...focusProps("confirmPassword")}
          />
          {passwordsMatch && !errors.confirmPassword ? (
            <View style={styles.hintRow}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={[styles.hintText, { color: "#059669" }]}>
                Passwords match
              </Text>
            </View>
          ) : null}
        </FormSection>

        {/* Terms */}
        <TouchableOpacity
          style={[styles.termsRow, errors.agreed && styles.termsRowError]}
          onPress={() => !loading && update("agreed", !form.agreed)}
          activeOpacity={0.7}
          disabled={loading}
        >
          <View style={[styles.checkbox, form.agreed && styles.checkboxActive]}>
            {form.agreed ? (
              <Ionicons name="checkmark" size={15} color="#fff" />
            ) : null}
          </View>
          <Text style={styles.checkboxLabel}>
            I agree to the{" "}
            <Text style={styles.checkboxLink}>terms and conditions</Text>
          </Text>
        </TouchableOpacity>
        <FieldError message={errors.agreed} />

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryBtnText}>Create account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.row}>
          <Text style={styles.mutedText}>Already have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.link}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ---------- Picker sheet ---------- */}
      <Modal
        visible={!!picker}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPicker(null)}
        >
          <View
            style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Profile created for</Text>

            {ON_BEHALF_LIST.map((opt, i) => {
              const selected = form.onBehalf === opt.label;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.modalItem,
                    i === ON_BEHALF_LIST.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => {
                    setForm((p) => ({
                      ...p,
                      onBehalf: opt.label,
                      onBehalfId: opt.id,
                    }));
                    setErrors((p) => ({ ...p, onBehalf: undefined }));
                    setPicker(null);
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.modalItemIcon,
                      selected && styles.modalItemIconActive,
                    ]}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={17}
                      color={selected ? "#fff" : COLORS.primary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.modalItemText,
                      selected && styles.modalItemTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={COLORS.primary}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setPicker(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAwareScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 27,
    fontFamily: FONTS.bold,
    color: "#fff",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "rgba(255,255,255,0.88)",
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 300,
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

  /* ---------- Sections ---------- */
  section: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },

  /* ---------- Fields ---------- */
  field: {
    marginBottom: 12,
  },
  twoCol: {
    flexDirection: "row",
    gap: 10,
  },
  col: {
    flex: 1,
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
  inputWrapError: {
    borderColor: COLORS.error,
  },
  inputIcon: {
    marginRight: 10,
  },
  prefix: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginRight: 8,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
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

  /* ---------- Select ---------- */
  select: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 15,
    backgroundColor: "#FFFCF9",
  },
  selectText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },

  /* ---------- Gender ---------- */
  genderRow: {
    flexDirection: "row",
    gap: 10,
  },
  genderBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: "#FFFCF9",
  },
  genderBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#FFF0F5",
  },
  genderText: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  genderTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },

  /* ---------- Terms ---------- */
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFF7FA",
    borderWidth: 1,
    borderColor: "#FCE7F3",
  },
  termsRowError: {
    borderColor: COLORS.error,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    lineHeight: 19,
  },
  checkboxLink: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },

  /* ---------- Buttons ---------- */
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
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
  row: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
  },
  mutedText: {
    color: COLORS.textLight,
    fontFamily: FONTS.regular,
    fontSize: 14,
  },
  link: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },

  /* ---------- Picker sheet ---------- */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  modalItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  modalItemIconActive: {
    backgroundColor: COLORS.primary,
  },
  modalItemText: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  modalItemTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },
  modalCancel: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#F5EEEA",
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
});
