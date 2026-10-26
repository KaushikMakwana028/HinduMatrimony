import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import ScreenHeader from "../components/ScreenHeader";
import { useAuth } from "../contexts/AuthContext";
import happyStoryService from "../services/happyStoryService";
import { emitMemberAction } from "../services/memberEvents";
import { COLORS, FONTS } from "../theme";

export default function HappyStoryScreen({ navigation }) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(Boolean(token));
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Existing story state
  const [hasStory, setHasStory] = useState(false);
  const [existingStory, setExistingStory] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [details, setDetails] = useState("");
  const [photoAsset, setPhotoAsset] = useState(null);

  // Photo picker modal
  const [pickerModalVisible, setPickerModalVisible] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Fetch current story status
   */
  const fetchStory = useCallback(async (isPullToRefresh = false) => {
    if (!token) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isPullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await happyStoryService.checkHappyStory(token);
      if (isMountedRef.current) {
        setHasStory(Boolean(result?.hasStory));
        setExistingStory(result?.story || null);
      }
    } catch (err) {
      console.log("Error checking happy story:", err?.message);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    if (!token) return;

    (async () => {
      try {
        const result = await happyStoryService.checkHappyStory(token);
        if (active) {
          setHasStory(Boolean(result?.hasStory));
          setExistingStory(result?.story || null);
        }
      } catch (err) {
        console.log("Initial happy story fetch error:", err?.message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const onRefresh = useCallback(() => {
    fetchStory(true);
  }, [fetchStory]);

  /**
   * Open Camera to take story picture
   */
  const handlePickFromCamera = async () => {
    setPickerModalVisible(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera access is required to take a story photo. Please enable it in device settings."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoAsset(result.assets[0]);
      }
    } catch (err) {
      Alert.alert("Camera Error", err?.message || "Could not open camera.");
    }
  };

  /**
   * Pick photo from device gallery
   */
  const handlePickFromLibrary = async () => {
    setPickerModalVisible(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Photo library access is required to choose a picture. Please enable it in device settings."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoAsset(result.assets[0]);
      }
    } catch (err) {
      Alert.alert("Gallery Error", err?.message || "Could not open photo gallery.");
    }
  };

  /**
   * Submit Happy Story
   */
  const handleSubmitStory = async () => {
    if (!token) {
      Alert.alert("Sign In Required", "Please sign in to submit your happy story.");
      return;
    }

    if (!title.trim()) {
      Alert.alert("Required Field", "Please enter a title for your story.");
      return;
    }

    if (title.trim().length > 255) {
      Alert.alert("Character Limit", "Story title cannot exceed 255 characters.");
      return;
    }

    if (!partnerName.trim()) {
      Alert.alert("Required Field", "Please enter your partner's name.");
      return;
    }

    if (partnerName.trim().length > 255) {
      Alert.alert("Character Limit", "Partner name cannot exceed 255 characters.");
      return;
    }

    if (!details.trim()) {
      Alert.alert("Required Field", "Please share details about your journey and story.");
      return;
    }

    if (!photoAsset) {
      Alert.alert("Photo Required", "Please upload a photo of you and your partner.");
      return;
    }

    setSubmitting(true);
    try {
      await happyStoryService.storeHappyStory(
        {
          title: title.trim(),
          partner_name: partnerName.trim(),
          details: details.trim(),
          photoAsset,
        },
        token
      );

      Alert.alert(
        "Story Shared! 🎉",
        "Your Happy Story has been published! Thank you for sharing your wonderful journey with our community.",
        [{ text: "OK" }]
      );

      // Reset form
      setTitle("");
      setPartnerName("");
      setDetails("");
      setPhotoAsset(null);
      setIsEditing(false);

      // Notify profile screen and refresh
      emitMemberAction({ type: "happy_story_updated" });
      await fetchStory(false);
    } catch (err) {
      console.log("Story submission failed:", err?.message);
      Alert.alert("Submission Failed", err?.message || "Could not submit your happy story. Please try again.");
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  /* ---------------- VIEW: Existing Story ---------------- */
  const renderExistingStoryView = () => {
    const photoUrl = existingStory?.photos;

    return (
      <View style={styles.existingCard}>
        {/* Top Celebration Banner */}
        <View style={styles.celebrationHero}>
          <Text style={styles.celebrationIcon}>💍</Text>
          <Text style={styles.celebrationTitle}>Our Happy Journey</Text>
          <Text style={styles.celebrationSub}>
            Inspiring the HinduMatrimony community
          </Text>
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-done-circle" size={14} color="#15803D" />
            <Text style={styles.verifiedBadgeText}>Verified Match Story</Text>
          </View>
        </View>

        {/* Story Photo */}
        {photoUrl ? (
          <View style={styles.storyPhotoWrap}>
            <Image
              source={{ uri: photoUrl }}
              style={styles.storyPhoto}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* Content Box */}
        <View style={styles.storyContentBox}>
          <Text style={styles.storyTitle}>{existingStory?.title || "Happily Married"}</Text>

          <View style={styles.partnerRow}>
            <Ionicons name="heart" size={16} color={COLORS.primary || "#F9407F"} />
            <Text style={styles.partnerNameText}>
              With {existingStory?.partner_name || "Partner"}
            </Text>
          </View>

          {existingStory?.post_date ? (
            <Text style={styles.postDateText}>
              Shared on {new Date(existingStory.post_date).toLocaleDateString()}
            </Text>
          ) : null}

          <View style={styles.storyDivider} />

          <View style={styles.quoteBox}>
            <Text style={styles.quoteMark}>“</Text>
            <Text style={styles.storyDetailsText}>{existingStory?.details}</Text>
          </View>

          {/* Action buttons */}
          <TouchableOpacity
            style={styles.updateStoryBtn}
            onPress={() => {
              setTitle(existingStory?.title || "");
              setPartnerName(existingStory?.partner_name || "");
              setDetails(existingStory?.details || "");
              setIsEditing(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={17} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.updateStoryBtnText}>Update or Share Another Story</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /* ---------------- VIEW: Form Submission ---------------- */
  const renderSubmissionForm = () => {
    return (
      <View style={styles.formContainer}>
        {/* Romantic Intro Header */}
        <View style={styles.introHeader}>
          <View style={styles.heartCircle}>
            <Text style={styles.heartEmoji}>💖</Text>
          </View>
          <Text style={styles.introTitle}>Share Your Happy Story</Text>
          <Text style={styles.introDesc}>
            Found your soulmate on HinduMatrimony? Share your journey, marriage memories,
            and inspiring advice for thousands of hopeful brides and grooms.
          </Text>
        </View>

        {/* Photo Upload Area */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>
            Couple Photo <Text style={styles.requiredStar}>*</Text>
          </Text>

          {photoAsset ? (
            <View style={styles.photoPreviewCard}>
              <Image source={{ uri: photoAsset.uri }} style={styles.photoPreviewImg} resizeMode="cover" />
              <TouchableOpacity
                style={styles.changePhotoBadge}
                onPress={() => setPickerModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="camera-reverse-outline" size={15} color="#fff" />
                <Text style={styles.changePhotoText}>Change</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removePhotoBtn}
                onPress={() => setPhotoAsset(null)}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.uploadDashedBox}
              onPress={() => setPickerModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.uploadIconCircle}>
                <Ionicons name="cloud-upload-outline" size={26} color={COLORS.primary || "#F9407F"} />
              </View>
              <Text style={styles.uploadDashedTitle}>Tap to select wedding / couple photo</Text>
              <Text style={styles.uploadDashedSub}>JPG, PNG up to 10MB</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Story Title Input */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>
              Story Title <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Text style={styles.charCount}>{title.length}/255</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="e.g. From First Hello to Forever Together"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={(text) => setTitle(text.slice(0, 255))}
            maxLength={255}
          />
        </View>

        {/* Partner Name Input */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>
              Partner&apos;s Full Name <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Text style={styles.charCount}>{partnerName.length}/255</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="e.g. Priya Sharma"
            placeholderTextColor="#9CA3AF"
            value={partnerName}
            onChangeText={(text) => setPartnerName(text.slice(0, 255))}
            maxLength={255}
          />
        </View>

        {/* Story Details Input */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>
            Our Story & Journey <Text style={styles.requiredStar}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Share how you matched, what made you click, the wedding date, and sweet memories from your journey..."
            placeholderTextColor="#9CA3AF"
            value={details}
            onChangeText={setDetails}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && { opacity: 0.65 }]}
          onPress={handleSubmitStory}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.submitButtonEmoji}>💍</Text>
              <Text style={styles.submitButtonText}>Publish Happy Story</Text>
            </>
          )}
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity
            style={styles.cancelEditBtn}
            onPress={() => setIsEditing(false)}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelEditText}>Cancel Editing</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      {/* ---------- HEADER ---------- */}
      <ScreenHeader
        title="Happy Story"
        subtitle={hasStory && !isEditing ? "Your Published Story" : "Inspire Other Couples"}
        showBack
        onBack={() => navigation.goBack()}
        badge={hasStory ? "Published 💍" : null}
        badgeColor="#15803D"
        badgeBgColor="#DCFCE7"
      />

      {/* ---------- MAIN BODY ---------- */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary || "#F9407F"} />
          <Text style={styles.loadingText}>Checking happy story...</Text>
        </View>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 40 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary || "#F9407F"]}
              tintColor={COLORS.primary || "#F9407F"}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {hasStory && !isEditing ? renderExistingStoryView() : renderSubmissionForm()}
        </KeyboardAwareScrollView>
      )}

      {/* ---------- PHOTO PICKER SHEET MODAL ---------- */}
      <Modal
        visible={pickerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPickerModalVisible(false)}
        >
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Couple Photo</Text>
            <Text style={styles.sheetSubtitle}>Choose a romantic or wedding picture together</Text>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={handlePickFromCamera}
              activeOpacity={0.7}
            >
              <View style={[styles.sheetIconWrap, { backgroundColor: "#EEF2FF" }]}>
                <Ionicons name="camera-outline" size={22} color="#4F46E5" />
              </View>
              <View style={styles.sheetOptionTextWrap}>
                <Text style={styles.sheetOptionTitle}>Take Photo</Text>
                <Text style={styles.sheetOptionDesc}>Use camera now</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={handlePickFromLibrary}
              activeOpacity={0.7}
            >
              <View style={[styles.sheetIconWrap, { backgroundColor: "#FCE7F3" }]}>
                <Ionicons name="images-outline" size={22} color={COLORS.primary || "#F9407F"} />
              </View>
              <View style={styles.sheetOptionTextWrap}>
                <Text style={styles.sheetOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.sheetOptionDesc}>Select from phone storage</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setPickerModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background || "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerBackBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
  },
  headerSubTitle: {
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#6B7280",
    marginTop: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary || "#6B7280",
    fontFamily: FONTS.regular || "System",
  },
  scrollContent: {
    padding: 16,
  },

  /* Existing Story Display */
  existingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
  },
  celebrationHero: {
    backgroundColor: "#FFF1F5",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#FCE7F3",
  },
  celebrationIcon: {
    fontSize: 34,
    marginBottom: 4,
  },
  celebrationTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold || "System",
    color: COLORS.primary || "#F9407F",
  },
  celebrationSub: {
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#6B7280",
    marginTop: 2,
    marginBottom: 8,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold || "System",
    color: "#15803D",
    marginLeft: 4,
  },
  storyPhotoWrap: {
    width: "100%",
    height: 240,
    backgroundColor: "#F3F4F6",
  },
  storyPhoto: {
    width: "100%",
    height: "100%",
  },
  storyContentBox: {
    padding: 18,
  },
  storyTitle: {
    fontSize: 19,
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
    lineHeight: 26,
  },
  partnerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  partnerNameText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold || "System",
    color: COLORS.primary || "#F9407F",
    marginLeft: 6,
  },
  postDateText: {
    fontSize: 11,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#9CA3AF",
    marginTop: 4,
  },
  storyDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 14,
  },
  quoteBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    position: "relative",
  },
  quoteMark: {
    fontSize: 28,
    lineHeight: 28,
    fontFamily: FONTS.bold || "System",
    color: COLORS.primary || "#F9407F",
    opacity: 0.4,
    marginBottom: -4,
  },
  storyDetailsText: {
    fontSize: 13,
    fontFamily: FONTS.regular || "System",
    color: COLORS.text || "#374151",
    lineHeight: 22,
  },
  updateStoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary || "#F9407F",
    borderRadius: 12,
  },
  updateStoryBtnText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
    color: COLORS.primary || "#F9407F",
  },

  /* Form Container */
  formContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  introHeader: {
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  heartCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFF1F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  heartEmoji: {
    fontSize: 26,
  },
  introTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
  },
  introDesc: {
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
    paddingHorizontal: 8,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
    color: COLORS.text || "#374151",
    marginBottom: 6,
  },
  requiredStar: {
    color: "#EF4444",
  },
  charCount: {
    fontSize: 11,
    fontFamily: FONTS.regular || "System",
    color: "#9CA3AF",
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: FONTS.regular || "System",
    color: COLORS.text || "#111827",
  },
  textArea: {
    minHeight: 110,
    paddingTop: 12,
  },
  uploadDashedBox: {
    borderWidth: 1.5,
    borderColor: COLORS.primary || "#F9407F",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF8FA",
  },
  uploadIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FCE7F3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  uploadDashedTitle: {
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
    color: COLORS.primary || "#F9407F",
  },
  uploadDashedSub: {
    fontSize: 11,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#9CA3AF",
    marginTop: 2,
  },
  photoPreviewCard: {
    width: "100%",
    height: 190,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
  },
  photoPreviewImg: {
    width: "100%",
    height: "100%",
  },
  changePhotoBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  changePhotoText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: FONTS.semiBold || "System",
    marginLeft: 4,
  },
  removePhotoBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary || "#F9407F",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
    elevation: 3,
    shadowColor: COLORS.primary || "#F9407F",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  submitButtonEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONTS.bold || "System",
  },
  cancelEditBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelEditText: {
    fontSize: 13,
    fontFamily: FONTS.medium || "System",
    color: COLORS.textSecondary || "#6B7280",
  },

  /* Picker Sheet Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
    textAlign: "center",
  },
  sheetSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#6B7280",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 18,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 10,
  },
  sheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  sheetOptionTextWrap: {
    flex: 1,
  },
  sheetOptionTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold || "System",
    color: COLORS.text || "#111827",
  },
  sheetOptionDesc: {
    fontSize: 11,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#6B7280",
    marginTop: 2,
  },
  sheetCancelBtn: {
    marginTop: 6,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  sheetCancelText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold || "System",
    color: COLORS.text || "#111827",
  },
});
