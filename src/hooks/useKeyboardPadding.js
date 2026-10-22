import { useState, useEffect } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Hook to dynamically calculate bottom scroll padding when the keyboard opens.
 * Allows the user to freely scroll to the bottom of the screen (past inputs, checkboxes, buttons)
 * without the keyboard covering the content or violently jumping.
 *
 * @param {number} basePadding - Default padding when keyboard is hidden
 * @param {number} extraOffset - Extra margin above the keyboard
 */
function useKeyboardPadding(basePadding = 40, extraOffset = 30) {
    const [paddingBottom, setPaddingBottom] = useState(basePadding);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    useEffect(() => {
        const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const onShow = (event) => {
            const keyboardHeight = event?.endCoordinates?.height || 280;
            setPaddingBottom(keyboardHeight + extraOffset);
            setIsKeyboardVisible(true);
        };

        const onHide = () => {
            setPaddingBottom(basePadding);
            setIsKeyboardVisible(false);
        };

        const showListener = Keyboard.addListener(showEvent, onShow);
        const hideListener = Keyboard.addListener(hideEvent, onHide);

        return () => {
            showListener.remove();
            hideListener.remove();
        };
    }, [basePadding, extraOffset]);

    return { paddingBottom, isKeyboardVisible };
}

export default useKeyboardPadding;
