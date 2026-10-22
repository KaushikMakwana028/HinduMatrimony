import React, { useState, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { COLORS, FONTS } from "../theme";

export default function LoginScreen({ navigation }) {
    const { login } = useAuth();
    const scrollViewRef = useRef(null);

    const [emailOrPhone, setEmailOrPhone] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const handleGuestLogin = () => {
        navigation.replace("MainTabs");
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
                    "Login Failed",
                    response?.message || "Invalid credentials. Please try again."
                );
            }
        } catch (error) {
            console.log("Login error:", error?.message);
            Alert.alert(
                "Login Error",
                error.message || "Failed to sign in. Please check your credentials."
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
            <View style={styles.header}>
                <Text style={styles.title}>Hindu Matrimony</Text>
                <Text style={styles.subtitle}>
                    Find your life partner with values and traditions
                </Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Welcome Back</Text>
                <Text style={styles.cardSubtitle}>Sign in to continue</Text>

                <Text style={styles.label}>Email or Phone</Text>
                <TextInput
                    style={[styles.input, errors.emailOrPhone && styles.inputError]}
                    placeholder="you@example.com or 9876543210"
                    placeholderTextColor={COLORS.textLight}
                    value={emailOrPhone}
                    onChangeText={(t) => {
                        setEmailOrPhone(t);
                        setErrors((p) => ({ ...p, emailOrPhone: undefined }));
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                />
                {errors.emailOrPhone && (
                    <Text style={styles.error}>{errors.emailOrPhone}</Text>
                )}

                <Text style={styles.label}>Password</Text>
                <TextInput
                    style={[styles.input, errors.password && styles.inputError]}
                    placeholder="Enter your password"
                    placeholderTextColor={COLORS.textLight}
                    value={password}
                    onChangeText={(t) => {
                        setPassword(t);
                        setErrors((p) => ({ ...p, password: undefined }));
                    }}
                    secureTextEntry
                    editable={!loading}
                />
                {errors.password && (
                    <Text style={styles.error}>{errors.password}</Text>
                )}

                <TouchableOpacity style={styles.forgot} disabled={loading}>
                    <Text style={styles.forgotText}>Forgot Password?</Text>
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
                        <Text style={styles.primaryBtnText}>Sign In</Text>
                    )}
                </TouchableOpacity>

                {/* Quick/Guest login */}
                <TouchableOpacity
                    style={styles.guestBtn}
                    onPress={handleGuestLogin}
                    disabled={loading}
                >
                    <Text style={styles.guestBtnText}>Continue without Login (Demo)</Text>
                </TouchableOpacity>

                <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.or}>OR</Text>
                    <View style={styles.line} />
                </View>

                <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => navigation.navigate("Signup")}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    <Text style={styles.secondaryBtnText}>Create New Account</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.footer}>
                By continuing, you agree to our Terms & Privacy Policy
            </Text>
        </KeyboardAwareScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { flexGrow: 1, padding: 20, paddingTop: 80 },
    header: { alignItems: "center", marginBottom: 30 },
    title: { fontSize: 26, fontFamily: FONTS.bold, color: COLORS.primary },
    subtitle: {
        fontSize: 14,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        textAlign: "center",
        marginTop: 6,
        paddingHorizontal: 20,
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
    cardTitle: { fontSize: 22, fontFamily: FONTS.semiBold, color: COLORS.text },
    cardSubtitle: {
        fontSize: 14,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginBottom: 20,
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
    forgot: { alignSelf: "flex-end", marginTop: 10, marginBottom: 20 },
    forgotText: {
        color: COLORS.primary,
        fontFamily: FONTS.medium,
        fontSize: 14,
    },
    primaryBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 52,
    },
    btnDisabled: {
        opacity: 0.7,
    },
    primaryBtnText: {
        color: "#fff",
        fontSize: 16,
        fontFamily: FONTS.semiBold,
        letterSpacing: 0.3,
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 20,
    },
    line: { flex: 1, height: 1, backgroundColor: COLORS.border },
    or: {
        marginHorizontal: 12,
        color: COLORS.textLight,
        fontFamily: FONTS.medium,
        fontSize: 12,
    },
    secondaryBtn: {
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
    },
    secondaryBtnText: {
        color: COLORS.primary,
        fontSize: 16,
        fontFamily: FONTS.semiBold,
    },
    footer: {
        textAlign: "center",
        marginTop: 26,
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
    },
    guestBtn: {
        marginTop: 12,
        paddingVertical: 12,
        alignItems: "center",
    },
    guestBtnText: {
        color: COLORS.textLight,
        fontFamily: FONTS.medium,
        fontSize: 13,
        textDecorationLine: "underline",
    },
});
