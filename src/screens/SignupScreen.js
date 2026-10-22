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
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { COLORS, FONTS } from "../theme";

const ON_BEHALF_LIST = [
    { label: "My Self", id: "1" },
    { label: "My Daughter", id: "2" },
    { label: "My Son", id: "3" },
    { label: "My Sister", id: "4" },
    { label: "My Brother", id: "5" },
    { label: "My Relative", id: "6" },
    { label: "My Friend", id: "7" },
];

const GENDER_OPTIONS = ["Male", "Female"];

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

export default function SignupScreen({ navigation }) {
    const { register } = useAuth();
    const scrollViewRef = useRef(null);

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
    const [picker, setPicker] = useState(null); // "onBehalf" | "gender"
    const [loading, setLoading] = useState(false);

    const update = (key, value) => {
        setForm((p) => ({ ...p, [key]: value }));
        setErrors((p) => ({ ...p, [key]: undefined }));
    };

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
                    ]
                );
            } else {
                Alert.alert(
                    "Signup Failed",
                    response?.message || "Failed to create account. Please try again."
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
                "Registration Error",
                msg || "Failed to register. Please check your details."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAwareScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={true}
        >
            <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.goBack()}
                disabled={loading}
            >
                <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.header}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join us to find your perfect match</Text>
            </View>

            <View style={styles.card}>
                {/* On Behalf */}
                <Text style={styles.label}>On Behalf</Text>
                <TouchableOpacity
                    style={[styles.select, errors.onBehalf && styles.inputError]}
                    onPress={() => !loading && setPicker("onBehalf")}
                    activeOpacity={0.7}
                    disabled={loading}
                >
                    <Text
                        style={[
                            styles.selectText,
                            !form.onBehalf && { color: COLORS.textLight },
                        ]}
                    >
                        {form.onBehalf || "Select profile for"}
                    </Text>
                    <Text style={styles.caret}>▾</Text>
                </TouchableOpacity>
                {errors.onBehalf && (
                    <Text style={styles.error}>{errors.onBehalf}</Text>
                )}

                {/* First Name */}
                <Text style={styles.label}>First Name</Text>
                <TextInput
                    style={[styles.input, errors.firstName && styles.inputError]}
                    placeholder="e.g. John"
                    placeholderTextColor={COLORS.textLight}
                    value={form.firstName}
                    onChangeText={(t) => update("firstName", t)}
                    editable={!loading}
                />
                {errors.firstName && (
                    <Text style={styles.error}>{errors.firstName}</Text>
                )}

                {/* Last Name */}
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                    style={[styles.input, errors.lastName && styles.inputError]}
                    placeholder="e.g. Doe"
                    placeholderTextColor={COLORS.textLight}
                    value={form.lastName}
                    onChangeText={(t) => update("lastName", t)}
                    editable={!loading}
                />
                {errors.lastName && (
                    <Text style={styles.error}>{errors.lastName}</Text>
                )}

                {/* Gender */}
                <Text style={styles.label}>Gender</Text>
                <View style={styles.genderRow}>
                    {GENDER_OPTIONS.map((g) => {
                        const selected = form.gender === g;
                        return (
                            <TouchableOpacity
                                key={g}
                                style={[
                                    styles.genderBtn,
                                    selected && styles.genderBtnActive,
                                ]}
                                onPress={() => !loading && update("gender", g)}
                                disabled={loading}
                                activeOpacity={0.7}
                            >
                                <View
                                    style={[
                                        styles.radio,
                                        selected && styles.radioActive,
                                    ]}
                                >
                                    {selected && <View style={styles.radioDot} />}
                                </View>
                                <Text
                                    style={[
                                        styles.genderText,
                                        selected && styles.genderTextActive,
                                    ]}
                                >
                                    {g}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                {errors.gender && <Text style={styles.error}>{errors.gender}</Text>}

                {/* DOB */}
                <Text style={styles.label}>Date of Birth</Text>
                <TextInput
                    style={[styles.input, errors.dob && styles.inputError]}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor={COLORS.textLight}
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
                    editable={!loading}
                />
                {errors.dob && <Text style={styles.error}>{errors.dob}</Text>}

                {/* Email */}
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                    style={[styles.input, errors.email && styles.inputError]}
                    placeholder="you@example.com"
                    placeholderTextColor={COLORS.textLight}
                    value={form.email}
                    onChangeText={(t) => update("email", t)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                />
                {errors.email && <Text style={styles.error}>{errors.email}</Text>}

                {/* Phone */}
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                    style={[styles.input, errors.phone && styles.inputError]}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor={COLORS.textLight}
                    value={form.phone}
                    onChangeText={(t) => {
                        const digits = t.replace(/\D/g, "").slice(0, 10);
                        update("phone", digits);
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!loading}
                />
                {errors.phone && <Text style={styles.error}>{errors.phone}</Text>}

                {/* Password */}
                <Text style={styles.label}>Password</Text>
                <TextInput
                    style={[styles.input, errors.password && styles.inputError]}
                    placeholder="Minimum 8 characters"
                    placeholderTextColor={COLORS.textLight}
                    value={form.password}
                    onChangeText={(t) => update("password", t)}
                    secureTextEntry
                    editable={!loading}
                />
                {errors.password && (
                    <Text style={styles.error}>{errors.password}</Text>
                )}

                {/* Confirm Password */}
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                    style={[styles.input, errors.confirmPassword && styles.inputError]}
                    placeholder="Re-enter password"
                    placeholderTextColor={COLORS.textLight}
                    value={form.confirmPassword}
                    onChangeText={(t) => update("confirmPassword", t)}
                    secureTextEntry
                    editable={!loading}
                />
                {errors.confirmPassword && (
                    <Text style={styles.error}>{errors.confirmPassword}</Text>
                )}

                {/* Terms Checkbox */}
                <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => !loading && update("agreed", !form.agreed)}
                    activeOpacity={0.7}
                    disabled={loading}
                >
                    <View
                        style={[styles.checkbox, form.agreed && styles.checkboxActive]}
                    >
                        {form.agreed && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>
                        By signing up you agree to our{" "}
                        <Text style={styles.checkboxLink}>terms and conditions</Text>
                    </Text>
                </TouchableOpacity>
                {errors.agreed && <Text style={styles.error}>{errors.agreed}</Text>}

                <TouchableOpacity
                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                    onPress={handleSignup}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.primaryBtnText}>Create Account</Text>
                    )}
                </TouchableOpacity>

                <View style={styles.row}>
                    <Text style={styles.mutedText}>Already have an account? </Text>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        disabled={loading}
                    >
                        <Text style={styles.link}>Sign In</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Picker Modal */}
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
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Profile created for</Text>
                        {ON_BEHALF_LIST.map((opt) => (
                            <TouchableOpacity
                                key={opt.id}
                                style={styles.modalItem}
                                onPress={() => {
                                    setForm((p) => ({
                                        ...p,
                                        onBehalf: opt.label,
                                        onBehalfId: opt.id,
                                    }));
                                    setErrors((p) => ({ ...p, onBehalf: undefined }));
                                    setPicker(null);
                                }}
                            >
                                <Text style={styles.modalItemText}>{opt.label}</Text>
                                {form.onBehalf === opt.label && (
                                    <Text style={styles.modalCheck}>✓</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={styles.modalCancel}
                            onPress={() => setPicker(null)}
                        >
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </KeyboardAwareScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flexGrow: 1,
        padding: 20,
        paddingTop: 50,
    },
    backBtn: { marginBottom: 12 },
    backText: {
        color: COLORS.primary,
        fontFamily: FONTS.medium,
        fontSize: 16,
    },
    header: { alignItems: "center", marginBottom: 24 },
    title: { fontSize: 24, fontFamily: FONTS.bold, color: COLORS.primary },
    subtitle: {
        fontSize: 14,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginTop: 4,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: 22,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    label: {
        fontSize: 14,
        fontFamily: FONTS.medium,
        color: COLORS.text,
        marginBottom: 8,
        marginTop: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
        fontSize: 15,
        fontFamily: FONTS.regular,
        color: COLORS.text,
        backgroundColor: "#FFFCF9",
    },
    inputError: { borderColor: COLORS.error },
    error: {
        color: COLORS.error,
        fontSize: 12,
        fontFamily: FONTS.regular,
        marginTop: 6,
    },
    select: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 16,
        backgroundColor: "#FFFCF9",
    },
    selectText: {
        fontSize: 15,
        fontFamily: FONTS.regular,
        color: COLORS.text,
    },
    caret: { fontSize: 14, color: COLORS.textLight },

    genderRow: { flexDirection: "row", gap: 12 },
    genderBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: "#FFFCF9",
    },
    genderBtnActive: {
        borderColor: COLORS.primary,
        backgroundColor: "#FFE6EF",
    },
    radio: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: COLORS.border,
        marginRight: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    radioActive: { borderColor: COLORS.primary },
    radioDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primary,
    },
    genderText: {
        fontSize: 15,
        fontFamily: FONTS.medium,
        color: COLORS.text,
    },
    genderTextActive: { color: COLORS.primary },

    checkboxRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginTop: 18,
        marginBottom: 4,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.border,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
        marginTop: 1,
    },
    checkboxActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    checkmark: {
        color: "#fff",
        fontSize: 13,
        fontFamily: FONTS.bold,
        lineHeight: 16,
    },
    checkboxLabel: {
        flex: 1,
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        lineHeight: 20,
    },
    checkboxLink: {
        color: COLORS.primary,
        fontFamily: FONTS.semiBold,
    },

    primaryBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 20,
        minHeight: 52,
    },
    btnDisabled: {
        opacity: 0.7,
    },
    primaryBtnText: {
        color: "#fff",
        fontSize: 16,
        fontFamily: FONTS.semiBold,
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

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "flex-end",
    },
    modalSheet: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 20,
        paddingBottom: 30,
        paddingHorizontal: 20,
    },
    modalTitle: {
        fontSize: 17,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
        marginBottom: 12,
        textAlign: "center",
    },
    modalItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalItemText: {
        fontSize: 16,
        fontFamily: FONTS.regular,
        color: COLORS.text,
    },
    modalCheck: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    modalCancel: {
        marginTop: 16,
        paddingVertical: 14,
        alignItems: "center",
        borderRadius: 12,
        backgroundColor: "#F5EEEA",
    },
    modalCancelText: {
        fontSize: 15,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
    },
});
