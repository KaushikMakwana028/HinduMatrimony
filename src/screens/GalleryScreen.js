import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import ScreenHeader from "../components/ScreenHeader";
import { useAuth } from "../contexts/AuthContext";
import galleryService from "../services/galleryService";
import planService from "../services/planService";
import { emitMemberAction } from "../services/memberEvents";
import { COLORS, FONTS } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COLUMN_GAP = 14;
const PADDING_HORIZONTAL = 16;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING_HORIZONTAL * 2 - COLUMN_GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.32;

export default function GalleryScreen({ navigation }) {
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();

  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isBusyId, setIsBusyId] = useState(null); // id of image currently being operated on

  // Active user plan info (enforces upload limits)
  const [planInfo, setPlanInfo] = useState({
    name: "Silver Package",
    maxGallery: 5,
    isPremium: true,
  });

  // Full-screen viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Picker action sheet modal
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [pickerTargetId, setPickerTargetId] = useState(null); // null = new upload, id = replace

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Fetch gallery images from server
   */
  const fetchImages = useCallback(async (isPullToRefresh = false) => {
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
      const list = await galleryService.getGalleryImages(token);
      if (isMountedRef.current) {
        setImages(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.log("Error loading gallery:", err?.message);
      if (isMountedRef.current && !isPullToRefresh) {
        Alert.alert("Notice", err?.message || "Could not load gallery photos.");
      }
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
        const [list, plan] = await Promise.allSettled([
          galleryService.getGalleryImages(token),
          planService.getActivePlan(user, null, token),
        ]);

        if (active) {
          if (list.status === "fulfilled" && Array.isArray(list.value)) {
            setImages(list.value);
          }
          if (plan.status === "fulfilled" && plan.value) {
            setPlanInfo(plan.value);
          }
        }
      } catch (err) {
        console.log("Initial gallery fetch error:", err?.message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token, user]);

  const onRefresh = useCallback(() => {
    fetchImages(true);
    planService.getActivePlan(user, null, token).then((p) => {
      if (isMountedRef.current && p) setPlanInfo(p);
    });
  }, [fetchImages, user, token]);

  /**
   * Open photo picker sheet (for new upload or replace)
   * Strictly enforces active plan's maxGallery quota
   */
  const promptImageSource = (targetImageId = null) => {
    // If attempting a new upload when current count is already at or above plan allowance
    if (!targetImageId && images.length >= planInfo.maxGallery) {
      Alert.alert(
        "Upload Limit Reached",
        `Your ${planInfo.name} allows a maximum of ${planInfo.maxGallery} gallery photos. You currently have ${images.length} photos uploaded.\n\nPlease delete an existing photo or upgrade your membership plan to unlock more uploads.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Upgrade Plan 💎",
            onPress: () => navigation.navigate("Packages"),
          },
        ]
      );
      return;
    }

    setPickerTargetId(targetImageId);
    setPickerModalVisible(true);
  };

  /**
   * Handle taking a photo with camera
   */
  const handlePickFromCamera = async () => {
    setPickerModalVisible(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera access is required to take a profile photo. Please enable it in device settings."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        processSelectedAsset(result.assets[0], pickerTargetId);
      }
    } catch (err) {
      Alert.alert("Camera Error", err?.message || "Could not open camera.");
    }
  };

  /**
   * Handle picking photo from device library
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
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        processSelectedAsset(result.assets[0], pickerTargetId);
      }
    } catch (err) {
      Alert.alert("Gallery Error", err?.message || "Could not open photo gallery.");
    }
  };

  /**
   * Upload or replace image
   */
  const processSelectedAsset = async (asset, targetId) => {
    if (!token) {
      Alert.alert("Sign In Required", "Please sign in to upload photos.");
      return;
    }

    const isReplacing = Boolean(targetId);
    setUploading(true);
    setUploadMessage(isReplacing ? "Updating photo..." : "Uploading photo...");
    if (isReplacing) {
      setIsBusyId(targetId);
    }

    try {
      if (isReplacing) {
        await galleryService.replaceGalleryImage(targetId, asset, token);
        Alert.alert("Success", "Photo replaced successfully.");
      } else {
        await galleryService.uploadGalleryImage(asset, token);
        Alert.alert("Success", "Photo uploaded successfully to your gallery.");
      }

      // Notify profile and other screens of change
      emitMemberAction({ type: "gallery_updated" });

      // Reload gallery list
      await fetchImages(false);
    } catch (err) {
      console.log("Upload failed:", err?.message);
      Alert.alert(
        isReplacing ? "Update Failed" : "Upload Failed",
        err?.message || "Could not save photo. Please try again."
      );
    } finally {
      if (isMountedRef.current) {
        setUploading(false);
        setUploadMessage("");
        setIsBusyId(null);
        setPickerTargetId(null);
      }
    }
  };

  /**
   * Delete gallery image confirmation & execution
   */
  const confirmDeleteImage = (item) => {
    if (!item?.id) {
      Alert.alert("Error", "Missing photo ID.");
      return;
    }

    Alert.alert(
      "Delete Photo",
      "Are you sure you want to remove this photo from your gallery?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => executeDeleteImage(item.id),
        },
      ]
    );
  };

  const executeDeleteImage = async (id) => {
    if (!token) return;

    setIsBusyId(id);
    try {
      await galleryService.deleteGalleryImage(id, token);

      // Close viewer if deleting the viewed photo
      if (viewerVisible) {
        setViewerVisible(false);
      }

      emitMemberAction({ type: "gallery_updated" });
      await fetchImages(false);
      Alert.alert("Deleted", "The photo has been removed from your gallery.");
    } catch (err) {
      console.log("Delete failed:", err?.message);
      Alert.alert("Delete Failed", err?.message || "Could not delete this photo.");
    } finally {
      if (isMountedRef.current) {
        setIsBusyId(null);
      }
    }
  };

  /**
   * Open full screen image viewer
   */
  const openViewer = (index) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const currentViewedItem = images[viewerIndex] || null;

  /* ---------------- Render Grid Item ---------------- */
  const renderItem = ({ item, index }) => {
    const isBusy = isBusyId === item.id;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.cardImageTouch}
          onPress={() => openViewer(index)}
        >
          <Image
            source={{ uri: item.image_path }}
            style={styles.cardImage}
            resizeMode="cover"
          />

          {/* Number badge */}
          <View style={styles.badgeIndex}>
            <Text style={styles.badgeIndexText}>#{index + 1}</Text>
          </View>

          {/* Overlay loading spinner */}
          {isBusy && (
            <View style={styles.busyOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        {/* Card action footer */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.cardBtn}
            onPress={() => promptImageSource(item.id)}
            disabled={isBusy || uploading}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-horizontal" size={15} color={COLORS.primary} />
            <Text style={styles.cardBtnText}>Replace</Text>
          </TouchableOpacity>

          <View style={styles.cardBtnDivider} />

          <TouchableOpacity
            style={styles.cardBtn}
            onPress={() => confirmDeleteImage(item)}
            disabled={isBusy || uploading}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={15} color={COLORS.danger || "#DC2626"} />
            <Text style={[styles.cardBtnText, { color: COLORS.danger || "#DC2626" }]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /* ---------------- Render Empty State ---------------- */
  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="images-outline" size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.emptyTitle}>No Photos Uploaded Yet</Text>
        <Text style={styles.emptySubtitle}>
          Showcase your best moments! Profiles with multiple clear photos receive up to 5x more
          matches and partner interests.
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => promptImageSource(null)}
          activeOpacity={0.85}
        >
          <Ionicons name="cloud-upload-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.emptyButtonText}>Upload First Photo</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      {/* ---------- HEADER ---------- */}
      <ScreenHeader
        title="Photo Gallery"
        subtitle={
          images.length >= planInfo.maxGallery
            ? `${images.length}/${planInfo.maxGallery} photos • ${planInfo.name} limit`
            : `${images.length} of ${planInfo.maxGallery} photos • ${planInfo.name}`
        }
        showBack
        onBack={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity
            style={[
              styles.headerAddBtn,
              images.length >= planInfo.maxGallery && styles.headerAddBtnLimit,
              uploading && { opacity: 0.5 },
            ]}
            onPress={() => promptImageSource(null)}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <Ionicons
              name={images.length >= planInfo.maxGallery ? "diamond-outline" : "add"}
              size={16}
              color="#fff"
              style={{ marginRight: 3 }}
            />
            <Text style={styles.headerAddBtnText}>
              {images.length >= planInfo.maxGallery ? "Upgrade" : "Add"}
            </Text>
          </TouchableOpacity>
        }
      />

      {/* Uploading progress notification banner */}
      {uploading && (
        <View style={styles.uploadBanner}>
          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
          <Text style={styles.uploadBannerText}>{uploadMessage || "Uploading image..."}</Text>
        </View>
      )}

      {/* ---------- MAIN CONTENT ---------- */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your gallery...</Text>
        </View>
      ) : (
        <FlatList
          data={images}
          keyExtractor={(item, index) =>
            String(item?.id ?? item?.image_path ?? `gallery_${index}`)
          }
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={[
            styles.listContainer,
            images.length === 0 && styles.listContainerEmpty,
            { paddingBottom: Math.max(insets.bottom, 24) + 20 },
          ]}
          columnWrapperStyle={images.length > 0 ? styles.columnWrapper : null}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ---------- IMAGE PICKER ACTION SHEET MODAL ---------- */}
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
            <Text style={styles.sheetTitle}>
              {pickerTargetId ? "Replace Gallery Photo" : "Upload New Photo"}
            </Text>
            <Text style={styles.sheetSubtitle}>
              Choose a clear, front-facing picture of yourself
            </Text>

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
                <Text style={styles.sheetOptionDesc}>Use your camera now</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={handlePickFromLibrary}
              activeOpacity={0.7}
            >
              <View style={[styles.sheetIconWrap, { backgroundColor: "#FCE7F3" }]}>
                <Ionicons name="images-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.sheetOptionTextWrap}>
                <Text style={styles.sheetOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.sheetOptionDesc}>Select from device photos</Text>
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

      {/* ---------- FULL SCREEN IMAGE VIEWER MODAL ---------- */}
      <Modal
        visible={viewerVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
      >
        <SafeAreaView style={styles.viewerContainer} edges={["top", "bottom"]}>
          <StatusBar barStyle="light-content" />

          {/* Viewer Top Bar */}
          <View style={styles.viewerHeader}>
            <TouchableOpacity
              style={styles.viewerIconBtn}
              onPress={() => setViewerVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.viewerCounter}>
              {images.length > 0 ? `${viewerIndex + 1} / ${images.length}` : ""}
            </Text>

            {currentViewedItem ? (
              <TouchableOpacity
                style={styles.viewerIconBtn}
                onPress={() => confirmDeleteImage(currentViewedItem)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
              </TouchableOpacity>
            ) : (
              <View style={styles.viewerIconBtn} />
            )}
          </View>

          {/* Viewer Main Image */}
          <View style={styles.viewerBody}>
            {currentViewedItem?.image_path ? (
              <Image
                source={{ uri: currentViewedItem.image_path }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            ) : (
              <ActivityIndicator size="large" color="#fff" />
            )}

            {/* Previous navigation arrow */}
            {viewerIndex > 0 && (
              <TouchableOpacity
                style={[styles.viewerNavArrow, { left: 16 }]}
                onPress={() => setViewerIndex((prev) => Math.max(prev - 1, 0))}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={26} color="#fff" />
              </TouchableOpacity>
            )}

            {/* Next navigation arrow */}
            {viewerIndex < images.length - 1 && (
              <TouchableOpacity
                style={[styles.viewerNavArrow, { right: 16 }]}
                onPress={() => setViewerIndex((prev) => Math.min(prev + 1, images.length - 1))}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={26} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Viewer Bottom Controls */}
          <View style={styles.viewerFooter}>
            <TouchableOpacity
              style={styles.viewerFooterBtn}
              onPress={() => {
                const targetId = currentViewedItem?.id;
                setViewerVisible(false);
                promptImageSource(targetId);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.viewerFooterBtnText}>Replace Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.viewerFooterBtn, styles.viewerFooterBtnDelete]}
              onPress={() => {
                if (currentViewedItem) {
                  confirmDeleteImage(currentViewedItem);
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={[styles.viewerFooterBtnText, { color: "#EF4444" }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
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
  headerAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary || "#F9407F",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 2,
    shadowColor: COLORS.primary || "#F9407F",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  headerAddBtnLimit: {
    backgroundColor: "#7C3AED",
  },
  headerAddBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
    marginLeft: 4,
  },
  uploadBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary || "#F9407F",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  uploadBannerText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONTS.medium || "System",
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
  listContainer: {
    paddingHorizontal: PADDING_HORIZONTAL,
    paddingTop: 16,
  },
  listContainerEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  cardImageTouch: {
    width: "100%",
    height: CARD_HEIGHT,
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  badgeIndex: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeIndexText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.bold || "System",
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingVertical: 7,
  },
  cardBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  cardBtnText: {
    fontSize: 12,
    fontFamily: FONTS.medium || "System",
    color: COLORS.primary || "#F9407F",
    marginLeft: 4,
  },
  cardBtnDivider: {
    width: 1,
    height: 18,
    backgroundColor: "#E5E7EB",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#FCE7F3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 19,
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary || "#F9407F",
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 24,
    elevation: 3,
    shadowColor: COLORS.primary || "#F9407F",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONTS.semiBold || "System",
  },

  /* Sheet Modal */
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

  /* Full Screen Viewer */
  viewerContainer: {
    flex: 1,
    backgroundColor: "#0B0B0E",
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  viewerIconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  viewerCounter: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONTS.semiBold || "System",
  },
  viewerBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  viewerImage: {
    width: "100%",
    height: "100%",
  },
  viewerNavArrow: {
    position: "absolute",
    top: "50%",
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  },
  viewerFooterBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  viewerFooterBtnDelete: {
    backgroundColor: "rgba(239, 68, 68, 0.18)",
  },
  viewerFooterBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
  },
});
