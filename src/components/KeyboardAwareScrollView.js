import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
    ScrollView,
    View,
    Platform,
    Keyboard,
    TextInput,
    Dimensions,
    StyleSheet,
} from "react-native";
import { COLORS } from "../theme";

/**
 * Reusable Keyboard-Aware ScrollView container for all screens.
 *
 * SELF-CONTAINED: works on iOS and Android, with or without Android edge-to-edge,
 * and with any "softwareKeyboardLayoutMode" – no other file needs to change.
 *
 * How it works (instead of guessing per platform):
 *  1. When the keyboard opens we MEASURE where this container's bottom edge is on screen
 *     and compare it with the keyboard's top edge.
 *  2. If the OS already resized the window (adjustResize), there is no overlap -> no padding added
 *     (so there is never a double shift).
 *  3. If the keyboard covers the container (edge-to-edge / iOS), we add exactly the overlapping
 *     height as bottom padding so the ScrollView shrinks above the keyboard.
 *  4. The focused TextInput is then scrolled into view just above the keyboard.
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
        onScroll,
        ...rest
    },
    ref
) {
    const containerRef = useRef(null);
    const scrollRef = useRef(null);
    const scrollY = useRef(0);
    const timers = useRef([]);
    const [keyboardOverlap, setKeyboardOverlap] = useState(0);

    const setRefs = useCallback(
        (node) => {
            scrollRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
        },
        [ref]
    );

    const clearTimers = () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    };

    useEffect(() => {
        const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const scrollFocusedInputIntoView = (keyboardTop) => {
            const input =
                TextInput.State.currentlyFocusedInput &&
                TextInput.State.currentlyFocusedInput();
            if (!input || !input.measureInWindow) return;
            input.measureInWindow((x, y, w, h) => {
                const bottomEdge = y + h + 20;
                if (bottomEdge > keyboardTop && scrollRef.current) {
                    scrollRef.current.scrollTo({
                        y: Math.max(0, scrollY.current + (bottomEdge - keyboardTop)),
                        animated: true,
                    });
                }
            });
        };

        const measureOverlap = (keyboardTop, withScroll) => {
            if (!containerRef.current) return;
            containerRef.current.measureInWindow((x, y, w, h) => {
                const overlap = Math.max(0, Math.round(y + h - keyboardTop));
                setKeyboardOverlap(overlap);
                if (withScroll) scrollFocusedInputIntoView(keyboardTop);
            });
        };

        const onShow = (e) => {
            const kbHeight = e?.endCoordinates?.height || 0;
            const screenH = Dimensions.get("screen").height;
            const keyboardTop =
                e?.endCoordinates?.screenY && e.endCoordinates.screenY > 0
                    ? e.endCoordinates.screenY
                    : screenH - kbHeight;

            clearTimers();
            // Measure now, then again after Android has finished any native window resize.
            measureOverlap(keyboardTop, false);
            if (Platform.OS === "android") {
                timers.current.push(setTimeout(() => measureOverlap(keyboardTop, true), 120));
                timers.current.push(setTimeout(() => measureOverlap(keyboardTop, true), 350));
            } else {
                timers.current.push(setTimeout(() => measureOverlap(keyboardTop, true), 60));
            }
        };

        const onHide = () => {
            clearTimers();
            setKeyboardOverlap(0);
        };

        const showSub = Keyboard.addListener(showEvent, onShow);
        const hideSub = Keyboard.addListener(hideEvent, onHide);
        return () => {
            clearTimers();
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const handleScroll = (e) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
        if (onScroll) onScroll(e);
    };

    return (
        <View
            ref={containerRef}
            collapsable={false}
            style={[
                styles.container,
                { backgroundColor, paddingBottom: keyboardOverlap },
                style,
            ]}
        >
            <ScrollView
                ref={setRefs}
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
                automaticallyAdjustKeyboardInsets={false}
                {...rest}
                onScroll={handleScroll}
            >
                {children}
            </ScrollView>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default KeyboardAwareScrollView;