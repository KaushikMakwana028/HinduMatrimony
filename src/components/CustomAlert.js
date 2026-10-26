import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  Alert as RNAlert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

let alertSubscriber = null;

/**
 * Global helper to show the custom alert programmatically
 */
export function showCustomAlert(title, message, buttons, options) {
  if (alertSubscriber) {
    alertSubscriber({
      title: title || "",
      message: message || "",
      buttons: buttons && buttons.length ? buttons : [{ text: "OK" }],
      options: options || {},
    });
  } else {
    // Fallback to native alert if provider is not yet mounted
    RNAlert.alert(title, message, buttons, options);
  }
}

/**
 * Intercept React Native's Alert.alert globally across the entire app
 */
export function initCustomAlert() {
  if (!RNAlert.__customAlertInstalled) {
    RNAlert.originalAlert = RNAlert.alert;
    RNAlert.alert = (title, message, buttons, options) => {
      showCustomAlert(title, message, buttons, options);
    };
    RNAlert.__customAlertInstalled = true;
  }
}

// Automatically initialize so any file importing Alert gets the custom modal
initCustomAlert();

/**
 * Determine alert visual type based on title and message contents
 */
function resolveAlertType(title = "", message = "", buttons = []) {
  const combined = `${title} ${message}`.toLowerCase();
  const hasDestructiveBtn = buttons.some((b) => b?.style === "destructive");

  if (
    hasDestructiveBtn ||
    combined.includes("delete") ||
    combined.includes("sign out") ||
    combined.includes("logout") ||
    combined.includes("deactivate") ||
    combined.includes("remove")
  ) {
    return "destructive";
  }

  if (
    combined.includes("success") ||
    combined.includes("🎉") ||
    combined.includes("saved") ||
    combined.includes("updated") ||
    combined.includes("completed") ||
    combined.includes("verified") ||
    combined.includes("sent") ||
    combined.includes("successful")
  ) {
    return "success";
  }

  if (
    combined.includes("error") ||
    combined.includes("failed") ||
    combined.includes("invalid") ||
    combined.includes("not match") ||
    combined.includes("not found")
  ) {
    return "error";
  }

  return "info";
}

const TYPE_CONFIG = {
  success: {
    icon: "checkmark-circle",
    iconColor: "#10B981",
    bgColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    btnColor: "#10B981",
  },
  error: {
    icon: "alert-circle",
    iconColor: "#EF4444",
    bgColor: "#FEF2F2",
    borderColor: "#FECDD3",
    btnColor: "#E11D48",
  },
  destructive: {
    icon: "trash-outline",
    iconColor: "#EF4444",
    bgColor: "#FEF2F2",
    borderColor: "#FECDD3",
    btnColor: "#EF4444",
  },
  info: {
    icon: "information-circle",
    iconColor: COLORS.primary,
    bgColor: "#FFF1F5",
    borderColor: "#FCE7F3",
    btnColor: COLORS.primary,
  },
};

/**
 * Root CustomAlert Component mounted at App root
 */
export default function CustomAlert() {
  const [alertData, setAlertData] = useState(null);
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.9));

  useEffect(() => {
    alertSubscriber = (data) => {
      setAlertData(data);
    };
    return () => {
      alertSubscriber = null;
    };
  }, []);

  useEffect(() => {
    if (alertData) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [alertData, fadeAnim, scaleAnim]);

  if (!alertData) return null;

  const { title, message, buttons = [], options = {} } = alertData;
  const alertType = resolveAlertType(title, message, buttons);
  const config = TYPE_CONFIG[alertType] || TYPE_CONFIG.info;

  const closeAlert = (onPressCallback) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setAlertData(null);
      if (typeof onPressCallback === "function") {
        onPressCallback();
      }
    });
  };

  const handleBackdropPress = () => {
    if (options?.cancelable !== false) {
      const cancelBtn = buttons.find((b) => b?.style === "cancel");
      closeAlert(cancelBtn?.onPress);
    }
  };

  return (
    <Modal
      visible={Boolean(alertData)}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleBackdropPress}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top Icon Badge */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: config.bgColor,
                borderColor: config.borderColor,
              },
            ]}
          >
            <Ionicons name={config.icon} size={30} color={config.iconColor} />
          </View>

          {/* Title */}
          {title ? <Text style={styles.title}>{title}</Text> : null}

          {/* Message */}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Buttons */}
          <View
            style={[
              styles.btnContainer,
              buttons.length === 2 && styles.btnContainerRow,
            ]}
          >
            {buttons.map((btn, index) => {
              const isCancel = btn?.style === "cancel";
              const isDestructive = btn?.style === "destructive";

              let btnStyle = styles.primaryBtn;
              let textStyle = styles.primaryBtnText;

              if (isCancel) {
                btnStyle = styles.cancelBtn;
                textStyle = styles.cancelBtnText;
              } else if (isDestructive) {
                btnStyle = [styles.primaryBtn, { backgroundColor: "#EF4444" }];
                textStyle = styles.primaryBtnText;
              } else if (alertType === "success") {
                btnStyle = [
                  styles.primaryBtn,
                  { backgroundColor: config.btnColor },
                ];
              }

              return (
                <TouchableOpacity
                  key={`btn-${index}`}
                  style={[
                    btnStyle,
                    buttons.length === 2 && styles.btnFlex,
                    index > 0 && buttons.length === 2 && { marginLeft: 10 },
                    index > 0 && buttons.length > 2 && { marginTop: 8 },
                  ]}
                  onPress={() => closeAlert(btn?.onPress)}
                  activeOpacity={0.8}
                >
                  <Text style={textStyle} numberOfLines={1}>
                    {btn?.text || "OK"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 48, 360),
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: "#FCE7F3",
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  message: {
    fontSize: 13.5,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  btnContainer: {
    width: "100%",
  },
  btnContainerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  btnFlex: {
    flex: 1,
  },
  primaryBtn: {
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#fff",
  },
  cancelBtn: {
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: "#4B5563",
  },
});
