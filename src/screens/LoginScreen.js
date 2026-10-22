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

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState({});

    const handleGuestLogin = () => {
        navigation.replace("MainTabs");
    };

    const validate = () => {
        const e = {};
        if (!email.trim()) e.email = "Email is required";
        else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter a valid email";
        if (!password) e.password = "Password is required";
        else if (password.length < 6) e.password = "Minimum 6 characters";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleLogin = () => {
        if (!validate()) return;
        Alert.alert("Welcome", "Login successful (demo)");
        navigation.replace("MainTabs");   // ← was navigation.replace("Home")
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
                <View style={styles.header}>
                    <Text style={styles.title}>Hindu Matrimony</Text>
                    <Text style={styles.subtitle}>
                        Find your life partner with values and traditions
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Welcome Back</Text>
                    <Text style={styles.cardSubtitle}>Sign in to continue</Text>

                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={[styles.input, errors.email && styles.inputError]}
                        placeholder="you@example.com"
                        placeholderTextColor={COLORS.textLight}
                        value={email}
                        onChangeText={(t) => {
                            setEmail(t);
                            setErrors((p) => ({ ...p, email: undefined }));
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    {errors.email && <Text style={styles.error}>{errors.email}</Text>}

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
                    />
                    {errors.password && (
                        <Text style={styles.error}>{errors.password}</Text>
                    )}

                    <TouchableOpacity style={styles.forgot}>
                        <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
                        <Text style={styles.primaryBtnText}>Sign In</Text>
                    </TouchableOpacity>

                    {/* 🆕 Quick/Guest login - bypasses validation */}
                    <TouchableOpacity style={styles.guestBtn} onPress={handleGuestLogin}>
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
                    >
                        <Text style={styles.secondaryBtnText}>Create New Account</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.footer}>
                    By continuing, you agree to our Terms & Privacy Policy
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
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
