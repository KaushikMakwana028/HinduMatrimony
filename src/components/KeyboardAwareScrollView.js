import React, { forwardRef } from "react";
import {
    ScrollView,
    KeyboardAvoidingView,
    View,
    Platform,
    StyleSheet,
} from "react-native";
import { COLORS } from "../theme";

/**
 * Reusable Keyboard-Aware ScrollView container for all screens.
 *
 * Designed specifically for Expo with "softwareKeyboardLayoutMode": "resize" on Android:
 * - On Android: Native OS handles the window resize. We use persistentScrollbar,
 *   keyboardDismissMode="none", and stable bottom padding so content never violently
 *   jumps, sticks to top, or closes the keyboard while scrolling.
 * - On iOS: KeyboardAvoidingView handles smooth padding behavior.
 */
const KeyboardAwareScrollView = forwardRef(function KeyboardAwareScrollView(
    {
        children,
        contentContainerStyle,
        style,
        bottomPadding = 60,
        keyboardShouldPersistTaps = "handled",
        keyboardDismissMode = "none",
        showsVerticalScrollIndicator = true,
        backgroundColor = COLORS.background,
        ...rest
    },
    ref
) {
    const isIos = Platform.OS === "ios";
    const Wrapper = isIos ? KeyboardAvoidingView : View;
    const wrapperProps = isIos
        ? {
              behavior: "padding",
              style: [styles.container, { backgroundColor }, style],
          }
        : {
              style: [styles.container, { backgroundColor }, style],
          };

    return (
        <Wrapper {...wrapperProps}>
            <ScrollView
                ref={ref}
                contentContainerStyle={[
                    contentContainerStyle,
                    { paddingBottom: bottomPadding },
                ]}
                keyboardShouldPersistTaps={keyboardShouldPersistTaps}
                keyboardDismissMode={keyboardDismissMode}
                showsVerticalScrollIndicator={showsVerticalScrollIndicator}
                persistentScrollbar={Platform.OS === "android"}
                scrollEventThrottle={16}
                bounces={true}
                overScrollMode="always"
                nestedScrollEnabled={true}
                {...rest}
            >
                {children}
            </ScrollView>
        </Wrapper>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default KeyboardAwareScrollView;
