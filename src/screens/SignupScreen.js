import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    Modal,
} from "react-native";

const COLORS = {
    primary: "#F9407F",
    primaryLight: "#FB6D9B",
    background: "#FFF8F0",
    surface: "#FFFFFF",
    text: "#2B1B17",
    textLight: "#7A6A65",
    border: "#E8DDD5",
    error: "#D32F2F",
};

const FONTS = {
    regular: "Poppins_400Regular",
    medium: "Poppins_500Medium",
    semiBold: "Poppins_600SemiBold",
    bold: "Poppins_700Bold",
};

const ON_BEHALF_OPTIONS = [
    "My Self",
    "My Daughter",
    "My Son",
    "My Sister",
    "My Brother",
    "My Relative",
    "My Friend",
];

const GENDER_OPTIONS = ["Male", "Female"];

export default function SignupScreen({ navigation }) {
    const [form, setForm] = useState({
        onBehalf: "",
        firstName: "",
        lastName: "",
        gender: "",
        dob: "",
        email: "",
        password: "",
        confirmPassword: "",
        agreed: false,
    });
    const [errors, setErrors] = useState({});
    const [picker, setPicker] = useState(null); // "onBehalf" | "gender"

    const update = (key, value) => {
        setForm((p) => ({ ...p, [key]: value }));
        setErrors((p) => ({ ...p, [key]: undefined }));
    };

    const validate = () => {
        const e = {};
        if (!form.onBehalf) e.onBehalf = "Please select";
        if (!form.firstName.trim()) e.firstName = "First name is required";
        if (!form.lastName.trim()) e.lastName = "Last name is required";
        if (!form.gender) e.gender = "Please select gender";
        if (!form.dob.trim()) e.dob = "Date of birth is required";
        else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(form.dob))
            e.dob = "Use format DD/MM/YYYY";
        if (!form.email.trim()) e.email = "Email is required";
        else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Invalid email";
        if (!form.password) e.password = "Password is required";
        else if (form.password.length < 6) e.password = "Minimum 6 characters";
        if (!form.confirmPassword)
            e.confirmPassword = "Please confirm your password";
        else if (form.password !== form.confirmPassword)
            e.confirmPassword = "Passwords do not match";
        if (!form.agreed) e.agreed = "You must accept the terms & conditions";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSignup = () => {
        if (!validate()) return;
        Alert.alert("Success", "Account created (demo)", [
            { text: "OK", onPress: () => navigation.replace("Home") },
        ]);
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: COLORS.background }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.goBack()}
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
                        onPress={() => setPicker("onBehalf")}
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
                        placeholder="e.g. Aarav"
                        placeholderTextColor={COLORS.textLight}
                        value={form.firstName}
                        onChangeText={(t) => update("firstName", t)}
                    />
                    {errors.firstName && (
                        <Text style={styles.error}>{errors.firstName}</Text>
                    )}

                    {/* Last Name */}
                    <Text style={styles.label}>Last Name</Text>
                    <TextInput
                        style={[styles.input, errors.lastName && styles.inputError]}
                        placeholder="e.g. Sharma"
                        placeholderTextColor={COLORS.textLight}
                        value={form.lastName}
                        onChangeText={(t) => update("lastName", t)}
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
                                    onPress={() => update("gender", g)}
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
                            // auto-format: digits only, insert "/" after 2 and 4 digits
                            const digits = t.replace(/[^0-9]/g, "").slice(0, 8);
                            let formatted = digits;
                            if (digits.length > 4)
                                formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                            else if (digits.length > 2)
                                formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                            update("dob", formatted);
                        }}
                        keyboardType="number-pad"
                        maxLength={10}
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
                    />
                    {errors.email && <Text style={styles.error}>{errors.email}</Text>}

                    {/* Password */}
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={[styles.input, errors.password && styles.inputError]}
                        placeholder="Minimum 6 characters"
                        placeholderTextColor={COLORS.textLight}
                        value={form.password}
                        onChangeText={(t) => update("password", t)}
                        secureTextEntry
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
                    />
                    {errors.confirmPassword && (
                        <Text style={styles.error}>{errors.confirmPassword}</Text>
                    )}

                    {/* Terms Checkbox */}
                    <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => update("agreed", !form.agreed)}
                        activeOpacity={0.7}
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

                    <TouchableOpacity style={styles.primaryBtn} onPress={handleSignup}>
                        <Text style={styles.primaryBtnText}>Create Account</Text>
                    </TouchableOpacity>

                    <View style={styles.row}>
                        <Text style={styles.mutedText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.link}>Sign In</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

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
                        <Text style={styles.modalTitle}>
                            {picker === "onBehalf"
                                ? "Profile created for"
                                : "Select gender"}
                        </Text>
                        {(picker === "onBehalf" ? ON_BEHALF_OPTIONS : GENDER_OPTIONS).map(
                            (opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    style={styles.modalItem}
                                    onPress={() => {
                                        update(picker, opt);
                                        setPicker(null);
                                    }}
                                >
                                    <Text style={styles.modalItemText}>{opt}</Text>
                                    {form[picker] === opt && (
                                        <Text style={styles.modalCheck}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            )
                        )}
                        <TouchableOpacity
                            style={styles.modalCancel}
                            onPress={() => setPicker(null)}
                        >
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flexGrow: 1,
        padding: 20,
        paddingTop: 50,
        paddingBottom: 40,
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
        fontSize: 16,
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
        fontSize: 16,
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
        marginTop: 20,
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