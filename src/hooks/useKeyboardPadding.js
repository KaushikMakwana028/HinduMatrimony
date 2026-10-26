import { useState, useEffect } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Hook that exposes keyboard state and a comfortable bottom scroll padding.
 *
 * KeyboardAwareScrollView now shrinks itself above the keyboard (and never double-shifts
 * when Android already resized the window). So this hook must NOT add the full keyboard
 * height to the content padding anymore – that was what pushed content far away / made
 * the scroll jump. It now only adds a small comfortable extra space while typing.
 *
 * Same API as before: { paddingBottom, isKeyboardVisible } (+ keyboardHeight).
 *
 * @param {number} basePadding - Default padding when keyboard is hidden
 * @param {number} extraOffset - Extra breathing room while the keyboard is visible
 */
function useKeyboardPadding(basePadding = 40, extraOffset = 30) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showListener = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event?.endCoordinates?.height || 0);
      setIsKeyboardVisible(true);
    });
    const hideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  const paddingBottom = isKeyboardVisible
    ? basePadding + extraOffset
    : basePadding;

  return { paddingBottom, isKeyboardVisible, keyboardHeight };
}

export default useKeyboardPadding;
