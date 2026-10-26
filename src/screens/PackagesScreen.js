import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import ScreenHeader from "../components/ScreenHeader";
import { PackagesSkeleton, ListFeedSkeleton } from "../components/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import packageService from "../services/packageService";
import planService from "../services/planService";
import { COLORS, FONTS } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function PackagesScreen({ navigation }) {
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState("plans"); // "plans" | "history"

  // Active membership plan details (defaults to user's Silver Package if not yet loaded)
  const [activePlan, setActivePlan] = useState({
    name: "Silver Package",
    key: "silver",
    packageId: 9,
    isPremium: true,
    maxGallery: 5,
    maxContacts: 30,
    maxInterests: 30,
  });

  // Packages state
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [refreshingPackages, setRefreshingPackages] = useState(false);

  // Purchase history state
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);

  // Purchase modal & payment methods state
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [manualPaymentMethods, setManualPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  // Form fields
  const [transactionId, setTransactionId] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [paymentProof, setPaymentProof] = useState(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Invoice modal state
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // QR Code preview modal
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrModalImage, setQrModalImage] = useState("");

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Fetch Available Packages
   */
  const fetchPackagesList = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setRefreshingPackages(true);
    } else {
      setLoadingPackages(true);
    }

    try {
      const list = await packageService.getPackages(token);
      if (isMountedRef.current) {
        setPackages(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.log("Error loading packages:", err?.message);
      if (isMountedRef.current && !isPullToRefresh) {
        Alert.alert("Notice", err?.message || "Could not load packages.");
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingPackages(false);
        setRefreshingPackages(false);
      }
    }
  }, [token]);

  /**
   * Fetch Purchase History
   */
  const fetchHistoryList = useCallback(
    async (isPullToRefresh = false) => {
      if (!token) return;

      if (isPullToRefresh) {
        setRefreshingHistory(true);
      } else {
        setLoadingHistory(true);
      }

      try {
        const result = await packageService.getPurchaseHistory(1, token);
        if (isMountedRef.current) {
          setHistory(Array.isArray(result?.list) ? result.list : []);
          setHistoryPage(1);
          setHistoryHasMore(Boolean(result?.hasMore));
        }
      } catch (err) {
        console.log("Error loading purchase history:", err?.message);
      } finally {
        if (isMountedRef.current) {
          setLoadingHistory(false);
          setRefreshingHistory(false);
        }
      }
    },
    [token]
  );

  /**
   * Load more purchase history items
   */
  const handleLoadMoreHistory = async () => {
    if (loadingMoreHistory || !historyHasMore || !token) return;

    setLoadingMoreHistory(true);
    try {
      const nextPage = historyPage + 1;
      const result = await packageService.getPurchaseHistory(nextPage, token);
      if (isMountedRef.current && result?.list?.length) {
        setHistory((prev) => [...prev, ...result.list]);
        setHistoryPage(nextPage);
        setHistoryHasMore(Boolean(result.hasMore));
      } else {
        setHistoryHasMore(false);
      }
    } catch (err) {
      console.log("Error loading more history:", err?.message);
    } finally {
      if (isMountedRef.current) {
        setLoadingMoreHistory(false);
      }
    }
  };

  // Initial load: Packages list and active plan
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [list, plan] = await Promise.allSettled([
          packageService.getPackages(token),
          planService.getActivePlan(user, null, token),
        ]);
        if (active) {
          if (list.status === "fulfilled" && Array.isArray(list.value)) {
            setPackages(list.value);
          }
          if (plan.status === "fulfilled" && plan.value) {
            setActivePlan(plan.value);
          }
        }
      } catch (err) {
        console.log("Initial packages fetch error:", err?.message);
      } finally {
        if (active) {
          setLoadingPackages(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token, user]);

  // Handle switching tabs
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "history" && history.length === 0) {
      fetchHistoryList(false);
    }
  };

  /**
   * Open purchase flow for a package & fetch its dynamic payment methods
   */
  const handleSelectPackage = async (pkg) => {
    if (!pkg) return;
    setSelectedPackage(pkg);
    setTransactionId("");
    setPaymentProof(null);

    // Set immediate default offline method so modal is ready and never blank
    const defaultFallback = {
      id: 3,
      heading: "Offline Payment / UPI",
      cleanDescription:
        "Please scan the QR code below or transfer the payment using any UPI app (GPay, PhonePe, Paytm, BHIM, Amazon Pay). Enter your transaction reference and upload receipt.",
      qrImageUrl: "https://www.hindumatrimony.org.in/public/uploads/all/JgWdgTIPstafeg4PI2w3Ma0oejspcuTebKkt57US.jpg",
    };
    setManualPaymentMethods([defaultFallback]);
    setSelectedPaymentMethod(defaultFallback);
    setPaymentDetails(`Paid via offline payment for ${pkg.name}`);
    setPurchaseModalVisible(true);
    setLoadingPaymentMethods(true);

    try {
      const methodsResult = await packageService.getPackagePaymentMethods(pkg.id, token);
      if (!isMountedRef.current) return;

      const methods = methodsResult?.manual_payments || [];
      if (methods.length > 0) {
        setManualPaymentMethods(methods);
        const defaultMethod = methods[0];
        setSelectedPaymentMethod(defaultMethod);
        setPaymentDetails(`Paid via ${defaultMethod.heading || "offline payment"} for ${pkg.name}`);
      }
    } catch (err) {
      console.log("Error fetching payment methods:", err?.message);
    } finally {
      if (isMountedRef.current) {
        setLoadingPaymentMethods(false);
      }
    }
  };

  /**
   * Pick payment proof: Camera, Gallery, or PDF/Document
   */
  const handlePickProof = async (mode) => {
    try {
      if (mode === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Camera permission is needed to take a photo of your receipt.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.85,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          setPaymentProof(result.assets[0]);
        }
      } else if (mode === "gallery") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Photo library permission is needed to select a receipt.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          setPaymentProof(result.assets[0]);
        }
      } else if (mode === "document") {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["image/*", "application/pdf"],
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          setPaymentProof(result.assets[0]);
        }
      }
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not select file.");
    }
  };

  /**
   * Submit manual payment purchase
   */
  const handleSubmitPurchase = async () => {
    if (!token) {
      Alert.alert("Sign In Required", "Please sign in to purchase a package.");
      return;
    }

    if (!transactionId.trim()) {
      Alert.alert(
        "Transaction ID Required",
        "Please enter your UPI reference number, bank UTR, or transaction ID."
      );
      return;
    }

    if (!paymentProof) {
      Alert.alert(
        "Payment Proof Required",
        "Please upload a screenshot or document (image/PDF) of your completed payment."
      );
      return;
    }

    setSubmittingPayment(true);
    try {
      const manualPaymentId = selectedPaymentMethod?.id || 3;
      const response = await packageService.purchasePackage(
        {
          package_id: selectedPackage.id,
          amount: selectedPackage.price,
          payment_method: "manual_payment",
          manual_payment_id: manualPaymentId,
          transaction_id: transactionId.trim(),
          payment_details: paymentDetails.trim() || `Paid for ${selectedPackage.name}`,
          payment_proof: paymentProof,
        },
        token
      );

      Alert.alert(
        "Payment Submitted 🎉",
        response?.message ||
          "Your payment proof has been submitted successfully. Our team will verify and activate your package in 1-2 business days.",
        [
          {
            text: "View History",
            onPress: () => {
              setPurchaseModalVisible(false);
              setActiveTab("history");
              fetchHistoryList(false);
            },
          },
        ]
      );
    } catch (err) {
      console.log("Purchase error:", err?.message);
      Alert.alert("Submission Failed", err?.message || "Could not submit payment proof. Please try again.");
    } finally {
      if (isMountedRef.current) {
        setSubmittingPayment(false);
      }
    }
  };

  /**
   * View Invoice Details
   */
  const handleViewInvoice = async (packagePaymentId) => {
    setLoadingInvoice(true);
    setInvoiceModalVisible(true);
    setInvoiceData(null);

    try {
      const invoice = await packageService.getPackageInvoice(packagePaymentId, token);
      if (isMountedRef.current) {
        setInvoiceData(invoice);
      }
    } catch (err) {
      console.log("Invoice error:", err?.message);
      Alert.alert("Invoice Error", err?.message || "Could not retrieve invoice details.");
      if (isMountedRef.current) {
        setInvoiceModalVisible(false);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingInvoice(false);
      }
    }
  };

  /* ---------------- RENDER: Plan Item ---------------- */
  const renderPackageItem = ({ item }) => {
    const isFree = Number(item.price) === 0;
    const isPopular = Number(item.price) === 1499 || Number(item.price) === 999;

    // Determine strictly if this specific package matches the user's currently active plan
    const isCurrentPlan = (() => {
      const activePkgId = Number(
        activePlan?.packageId ||
        activePlan?.dashboardData?.current_package_info?.package_id ||
        activePlan?.dashboardData?.current_package_info?.id ||
        0
      );
      const itemPkgId = Number(item?.package_id || item?.id || 0);

      // 1. Direct Package ID comparison if available
      if (activePkgId > 0 && itemPkgId > 0) {
        return activePkgId === itemPkgId;
      }

      const itemName = String(item?.name || "").toLowerCase().trim();
      const activeName = String(
        activePlan?.name ||
        activePlan?.dashboardData?.current_package_info?.package_name ||
        ""
      ).toLowerCase().trim();

      // 2. Exact Name comparison (e.g., "silver package" === "silver package")
      if (activeName) {
        const cleanItem = itemName.replace(/\s*package\s*/gi, "").trim();
        const cleanActive = activeName.replace(/\s*package\s*/gi, "").trim();
        if (cleanItem === cleanActive) {
          return true;
        }
      }

      // 3. Fallback to plan key match ONLY
      if (activePlan?.isPremium && activePlan?.key) {
        const key = String(activePlan.key).toLowerCase().trim();
        if (key === "silver") return itemName.includes("silver");
        if (key === "gold") return itemName.includes("gold");
        if (key === "diamond") return itemName.includes("diamond");
        if (key === "platinum") return itemName.includes("platinum");
        return false;
      }

      // 4. Free plan
      if (!activePlan?.isPremium) {
        return isFree || itemName.includes("free");
      }

      return false;
    })();

    return (
      <View
        style={[
          styles.planCard,
          isPopular && !isCurrentPlan && styles.planCardPopular,
          isCurrentPlan && styles.planCardActive,
        ]}
      >
        {isCurrentPlan ? (
          <View style={styles.activePlanBadge}>
            <Ionicons name="checkmark-circle" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.activePlanBadgeText}>YOUR CURRENT PLAN</Text>
          </View>
        ) : isPopular ? (
          <View style={styles.popularBadge}>
            <Ionicons name="star" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
          </View>
        ) : null}

        <View style={styles.planHeader}>
          <View style={styles.planTitleWrap}>
            <Text style={styles.planName}>{item.name}</Text>
            <Text style={styles.planValidity}>
              Valid for {item.validity} {item.validity === 1 ? "day" : "days"}
            </Text>
          </View>
          <View style={styles.priceWrap}>
            <Text style={styles.currencySymbol}>₹</Text>
            <Text style={styles.priceAmount}>{item.price}</Text>
          </View>
        </View>

        <View style={styles.planDivider} />

        {/* Feature List */}
        <View style={styles.featureList}>
          <View style={styles.featureRow}>
            <Ionicons name="heart-circle" size={18} color={COLORS.primary || "#F9407F"} />
            <Text style={styles.featureText}>
              <Text style={styles.featureHighlight}>{item.express_interest}</Text> Express Interests
            </Text>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="call" size={16} color="#4F46E5" />
            <Text style={styles.featureText}>
              <Text style={styles.featureHighlight}>{item.contact}</Text> Direct Contact Numbers
            </Text>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="images" size={16} color="#059669" />
            <Text style={styles.featureText}>
              <Text style={styles.featureHighlight}>{item.photo_gallery}</Text> Photo Gallery Uploads
            </Text>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="eye" size={16} color="#D97706" />
            <Text style={styles.featureText}>
              <Text style={styles.featureHighlight}>
                {item.profile_viewers_view || item.profile_view || 0}
              </Text>{" "}
              Profile Views Allowed
            </Text>
          </View>

          {item.auto_profile_match ? (
            <View style={styles.featureRow}>
              <Ionicons name="sparkles" size={16} color="#9333EA" />
              <Text style={styles.featureText}>Auto Profile Compatibility Matching</Text>
            </View>
          ) : null}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.choosePlanBtn,
            isCurrentPlan && styles.choosePlanBtnCurrent,
            isFree && !isCurrentPlan && styles.choosePlanBtnFree,
          ]}
          onPress={() => (isCurrentPlan || isFree ? null : handleSelectPackage(item))}
          disabled={isCurrentPlan || isFree}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.choosePlanBtnText,
              isCurrentPlan && styles.choosePlanBtnTextCurrent,
              isFree && !isCurrentPlan && styles.choosePlanBtnTextFree,
            ]}
          >
            {isCurrentPlan
              ? "Current Active Plan ✓"
              : isFree
              ? "Base Tier Included"
              : "Choose & Upgrade 💎"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  /* ---------------- RENDER: History Item ---------------- */
  const renderHistoryItem = ({ item }) => {
    const status = String(item.payment_status || "Due").toLowerCase();
    const isPaid = status === "paid" || status === "approved" || status === "completed";
    const isDue = status === "due" || status === "pending";
    const isRejected = status === "rejected" || status === "failed";

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyTopRow}>
          <View style={styles.historyCodeWrap}>
            <Text style={styles.historyCodeLabel}>PAYMENT CODE</Text>
            <Text style={styles.historyCodeValue}>{item.payment_code}</Text>
          </View>

          <View
            style={[
              styles.statusPill,
              isPaid && styles.statusPillPaid,
              isDue && styles.statusPillDue,
              isRejected && styles.statusPillRejected,
            ]}
          >
            <Ionicons
              name={
                isPaid
                  ? "checkmark-circle"
                  : isDue
                  ? "time"
                  : isRejected
                  ? "close-circle"
                  : "alert-circle"
              }
              size={12}
              color={isPaid ? "#15803D" : isDue ? "#B45309" : "#DC2626"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.statusPillText,
                isPaid && styles.statusPillTextPaid,
                isDue && styles.statusPillTextDue,
                isRejected && styles.statusPillTextRejected,
              ]}
            >
              {item.payment_status}
            </Text>
          </View>
        </View>

        <View style={styles.historyDivider} />

        <View style={styles.historyDetailsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.historyPackageName}>{item.package_name}</Text>
            <Text style={styles.historyDate}>
              Purchased: {item.created_at ? item.created_at.split("T")[0] : "Recent"}
            </Text>
          </View>
          <Text style={styles.historyAmount}>₹{item.amount}</Text>
        </View>

        <TouchableOpacity
          style={styles.invoiceBtn}
          onPress={() => handleViewInvoice(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="receipt-outline"
            size={16}
            color={COLORS.primary || "#F9407F"}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.invoiceBtnText}>View Receipt / Invoice</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      {/* Header */}
      <ScreenHeader
        title="Membership Plans"
        subtitle="Upgrade to unlock full connections"
        showBack
        onBack={() => navigation.goBack()}
        badge="Premium 💎"
        badgeColor={COLORS.primary}
        badgeBgColor="#FFF0F5"
      />

      {/* Segmented Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "plans" && styles.tabBtnActive]}
          onPress={() => handleTabChange("plans")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="diamond"
            size={16}
            color={activeTab === "plans" ? "#FFFFFF" : COLORS.textSecondary || "#6B7280"}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === "plans" && styles.tabBtnTextActive]}>
            Available Plans
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "history" && styles.tabBtnActive]}
          onPress={() => handleTabChange("history")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeTab === "history" ? "#FFFFFF" : COLORS.textSecondary || "#6B7280"}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === "history" && styles.tabBtnTextActive]}>
            Purchase History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {activeTab === "plans" ? (
        loadingPackages ? (
          <PackagesSkeleton count={3} />
        ) : (
          <FlatList
            data={packages}
            keyExtractor={(item, index) =>
              String(item?.id ?? item?.package_id ?? item?.name ?? `pkg_${index}`)
            }
            renderItem={renderPackageItem}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Math.max(insets.bottom, 24) + 24 },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshingPackages}
                onRefresh={() => fetchPackagesList(true)}
                colors={[COLORS.primary || "#F9407F"]}
                tintColor={COLORS.primary || "#F9407F"}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )
      ) : loadingHistory ? (
        <ListFeedSkeleton count={3} />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item, index) =>
            String(item?.id ?? item?.payment_code ?? `hist_${index}`)
          }
          renderItem={renderHistoryItem}
          ListHeaderComponent={
            <View style={styles.activeSubscriptionCard}>
              <View style={styles.activeSubTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeSubLabel}>CURRENT SUBSCRIPTION</Text>
                  <Text style={styles.activeSubName}>{activePlan.name}</Text>
                </View>
                <View style={styles.activeSubBadge}>
                  <Ionicons
                    name="shield-checkmark"
                    size={13}
                    color="#15803D"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.activeSubBadgeText}>
                    {activePlan.isPremium ? "Active & Verified" : "Free Plan"}
                  </Text>
                </View>
              </View>

              <View style={styles.activeSubDivider} />

              <View style={styles.activeSubGrid}>
                <View style={styles.activeSubCol}>
                  <Text style={styles.activeSubVal}>
                    {activePlan.remainingInterests !== undefined
                      ? `${activePlan.remainingInterests} / ${activePlan.maxInterests}`
                      : activePlan.maxInterests}
                  </Text>
                  <Text style={styles.activeSubKey}>Express Interests</Text>
                </View>
                <View style={styles.activeSubCol}>
                  <Text style={styles.activeSubVal}>
                    {activePlan.remainingContacts !== undefined
                      ? `${activePlan.remainingContacts} / ${activePlan.maxContacts}`
                      : activePlan.maxContacts}
                  </Text>
                  <Text style={styles.activeSubKey}>Contact Numbers</Text>
                </View>
                <View style={styles.activeSubCol}>
                  <Text style={styles.activeSubVal}>{activePlan.maxGallery}</Text>
                  <Text style={styles.activeSubKey}>Gallery Uploads</Text>
                </View>
              </View>

              <Text style={styles.activeSubNote}>
                {activePlan.isPremium
                  ? "Your membership benefits and limits are active. All pages adhere to this plan."
                  : "You are on the free plan. Upgrade to Silver to unlock 30 direct contacts & 5 gallery uploads."}
              </Text>
            </View>
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 24 },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={36} color={COLORS.primary || "#F9407F"} />
              </View>
              <Text style={styles.emptyTitle}>No Purchases on Record</Text>
              <Text style={styles.emptySubtitle}>
                {activePlan.isPremium
                  ? `Your ${activePlan.name} is currently active. Offline manual payments and invoices will appear here once submitted.`
                  : "You have not purchased any packages yet. Choose an upgrade plan to accelerate your partner search."}
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => setActiveTab("plans")}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyActionBtnText}>Explore Available Plans 💎</Text>
              </TouchableOpacity>
            </View>
          }
          onEndReached={handleLoadMoreHistory}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMoreHistory ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color={COLORS.primary || "#F9407F"} />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshingHistory}
              onRefresh={() => fetchHistoryList(true)}
              colors={[COLORS.primary || "#F9407F"]}
              tintColor={COLORS.primary || "#F9407F"}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ---------- PURCHASE MODAL (With Dynamic Payment Methods & QR Code) ---------- */}
      <Modal
        visible={purchaseModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPurchaseModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          {/* Dismiss backdrop when tapped outside */}
          <TouchableOpacity
            style={styles.modalBackdropDismiss}
            activeOpacity={1}
            onPress={() => setPurchaseModalVisible(false)}
          />

          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Purchase Package</Text>
                <Text style={styles.modalHeaderSub}>
                  {selectedPackage?.name} • ₹{selectedPackage?.price}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setPurchaseModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: Math.max(insets.bottom, 24) + 40 },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {loadingPaymentMethods ? (
                <View style={styles.paymentMethodsLoader}>
                  <ActivityIndicator size="small" color={COLORS.primary || "#F9407F"} />
                  <Text style={styles.paymentMethodsLoaderText}>
                    Updating official payment details...
                  </Text>
                </View>
              ) : null}

              {/* Multiple Payment Methods Selector (if backend provides multiple) */}
              {manualPaymentMethods.length > 1 ? (
                <View style={styles.methodsTabWrap}>
                  <Text style={styles.methodsTabLabel}>Select Payment Method:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.methodsTabRow}
                  >
                    {manualPaymentMethods.map((method) => {
                      const isSelected = selectedPaymentMethod?.id === method.id;
                      return (
                        <TouchableOpacity
                          key={`method_${method.id}`}
                          style={[styles.methodPill, isSelected && styles.methodPillSelected]}
                          onPress={() => {
                            setSelectedPaymentMethod(method);
                            setPaymentDetails(
                              `Paid via ${method.heading || "offline payment"} for ${selectedPackage?.name}`
                            );
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={isSelected ? "checkmark-circle" : "wallet-outline"}
                            size={14}
                            color={isSelected ? "#FFFFFF" : "#4B5563"}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              styles.methodPillText,
                              isSelected && styles.methodPillTextSelected,
                            ]}
                          >
                            {method.heading || `Method #${method.id}`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* Dynamic QR Code & Payment Instructions */}
              <View style={styles.paymentInstructionCard}>
                <View style={styles.paymentHeaderRow}>
                  <View style={styles.paymentHeaderIconCircle}>
                    <Ionicons name="qr-code-outline" size={18} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentHeaderTitle}>
                      {selectedPaymentMethod?.heading || "Offline Payment / UPI Transfer"}
                    </Text>
                    <Text style={styles.paymentHeaderSubtitle}>
                      Transfer exactly ₹{selectedPackage?.price} to activate
                    </Text>
                  </View>
                </View>

                {/* QR Code Presentation (if available from API) */}
                {selectedPaymentMethod?.qrImageUrl ? (
                  <View style={styles.qrCard}>
                    <Text style={styles.qrLabel}>SCAN UPI QR CODE TO PAY</Text>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => {
                        setQrModalImage(selectedPaymentMethod.qrImageUrl);
                        setQrModalVisible(true);
                      }}
                      style={styles.qrImageContainer}
                    >
                      <Image
                        source={{ uri: selectedPaymentMethod.qrImageUrl }}
                        style={styles.qrImage}
                        resizeMode="contain"
                      />
                      <View style={styles.qrEnlargeHint}>
                        <Ionicons name="expand" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.qrEnlargeText}>Tap to enlarge</Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.upiAppsRow}>
                      <Text style={styles.upiAppsText}>
                        Accepted on: GPay • PhonePe • Paytm • Amazon Pay • BHIM
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Step-by-Step Instructions */}
                <View style={styles.stepsWrap}>
                  <Text style={styles.stepsTitle}>How to complete payment:</Text>

                  <View style={styles.stepItem}>
                    <View style={styles.stepNumberBadge}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Text style={styles.stepDesc}>
                      Scan the QR code above or pay <Text style={styles.boldText}>₹{selectedPackage?.price}</Text> via any UPI app (GPay, PhonePe, Paytm, etc.).
                    </Text>
                  </View>

                  <View style={styles.stepItem}>
                    <View style={styles.stepNumberBadge}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Text style={styles.stepDesc}>
                      After successful transfer, take a clear screenshot and copy the <Text style={styles.boldText}>UPI / UTR Transaction ID</Text>.
                    </Text>
                  </View>

                  <View style={styles.stepItem}>
                    <View style={styles.stepNumberBadge}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <Text style={styles.stepDesc}>
                      Enter the Transaction ID and upload your screenshot below.
                    </Text>
                  </View>

                  {/* Verification Note from Admin */}
                  <View style={styles.verificationNoteWrap}>
                    <Ionicons name="information-circle" size={16} color="#0284C7" style={{ marginRight: 6 }} />
                    <Text style={styles.verificationNoteText}>
                      Our support team will verify your payment in 1-2 business days. You will be notified via email and your package will activate instantly upon approval.
                    </Text>
                  </View>
                </View>

                {/* Bank Info (if server provided) */}
                {selectedPaymentMethod?.bank_info ? (
                  <View style={styles.bankInfoBox}>
                    <Text style={styles.bankInfoTitle}>Bank Account Details:</Text>
                    <Text style={styles.bankInfoText}>{selectedPaymentMethod.bank_info}</Text>
                  </View>
                ) : null}
              </View>

              {/* Form Input: Transaction ID */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>
                  Transaction / UTR ID <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. TXN12345678 or 12-digit UPI reference"
                  placeholderTextColor="#9CA3AF"
                  value={transactionId}
                  onChangeText={setTransactionId}
                  autoCapitalize="characters"
                />
              </View>

              {/* Form Input: Payment Details / Notes */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Payment Notes / Method</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Paid via GPay / PhonePe / Bank transfer"
                  placeholderTextColor="#9CA3AF"
                  value={paymentDetails}
                  onChangeText={setPaymentDetails}
                />
              </View>

              {/* Form Input: Payment Proof File */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>
                  Payment Proof (Image or PDF) <Text style={styles.requiredStar}>*</Text>
                </Text>

                {paymentProof ? (
                  <View style={styles.proofPreviewCard}>
                    {paymentProof.mimeType?.includes("pdf") ||
                    paymentProof.name?.endsWith(".pdf") ||
                    paymentProof.fileName?.endsWith(".pdf") ? (
                      <View style={styles.pdfPreviewBox}>
                        <Ionicons name="document-text" size={44} color="#EF4444" />
                        <Text style={styles.pdfFileName} numberOfLines={1}>
                          {paymentProof.name || paymentProof.fileName || "Payment_Receipt.pdf"}
                        </Text>
                        <Text style={styles.pdfFileSize}>
                          {paymentProof.size ? `${Math.round(paymentProof.size / 1024)} KB` : "PDF Document"}
                        </Text>
                      </View>
                    ) : (
                      <Image
                        source={{ uri: paymentProof.uri }}
                        style={styles.proofPreviewImg}
                        resizeMode="cover"
                      />
                    )}

                    <View style={styles.proofActionRow}>
                      <TouchableOpacity
                        style={styles.proofChangeBtn}
                        onPress={() => handlePickProof("gallery")}
                      >
                        <Ionicons name="refresh" size={13} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.proofBtnText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.proofChangeBtn, { backgroundColor: "#EF4444" }]}
                        onPress={() => setPaymentProof(null)}
                      >
                        <Ionicons name="trash" size={13} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.proofBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.proofPickerRow}>
                    <TouchableOpacity
                      style={styles.proofPickBtn}
                      onPress={() => handlePickProof("gallery")}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="images-outline"
                        size={20}
                        color={COLORS.primary || "#F9407F"}
                      />
                      <Text style={styles.proofPickBtnText}>Photos</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.proofPickBtn}
                      onPress={() => handlePickProof("camera")}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="camera-outline" size={20} color="#4F46E5" />
                      <Text style={[styles.proofPickBtnText, { color: "#4F46E5" }]}>Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.proofPickBtn}
                      onPress={() => handlePickProof("document")}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="document-attach-outline" size={20} color="#059669" />
                      <Text style={[styles.proofPickBtnText, { color: "#059669" }]}>Document / PDF</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitPurchaseBtn, submittingPayment && { opacity: 0.65 }]}
                onPress={handleSubmitPurchase}
                disabled={submittingPayment}
                activeOpacity={0.85}
              >
                {submittingPayment ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                    <Text style={styles.submitPurchaseBtnText}>Uploading & Submitting...</Text>
                  </View>
                ) : (
                  <Text style={styles.submitPurchaseBtnText}>Submit Payment Proof</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------- QR CODE FULLSCREEN PREVIEW MODAL ---------- */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.qrModalBackdrop}>
          <View style={styles.qrModalContent}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>UPI Payment QR Code</Text>
              <TouchableOpacity
                onPress={() => setQrModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={26} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {qrModalImage ? (
              <Image
                source={{ uri: qrModalImage }}
                style={styles.qrModalImg}
                resizeMode="contain"
              />
            ) : null}

            <Text style={styles.qrModalSubtitle}>
              Scan using any UPI app to pay ₹{selectedPackage?.price}
            </Text>

            <TouchableOpacity
              style={styles.qrModalCloseBtn}
              onPress={() => setQrModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.qrModalCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---------- INVOICE MODAL ---------- */}
      <Modal
        visible={invoiceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInvoiceModalVisible(false)}
      >
        <View style={styles.invoiceBackdrop}>
          <View style={styles.invoiceCard}>
            <View style={styles.invoiceHeader}>
              <View>
                <Text style={styles.invoiceBrand}>HINDU MATRIMONY</Text>
                <Text style={styles.invoiceSub}>Official Payment Receipt</Text>
              </View>
              <TouchableOpacity
                onPress={() => setInvoiceModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {loadingInvoice ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <ActivityIndicator size="large" color={COLORS.primary || "#F9407F"} />
                <Text style={{ marginTop: 12, color: "#6B7280", fontSize: 13 }}>
                  Fetching receipt details...
                </Text>
              </View>
            ) : invoiceData ? (
              <ScrollView style={styles.invoiceBody} showsVerticalScrollIndicator={false}>
                <View style={styles.invoiceCodeBanner}>
                  <Text style={styles.invoiceCodeBannerLabel}>RECEIPT / PAYMENT CODE</Text>
                  <Text style={styles.invoiceCodeBannerVal}>{invoiceData.payment_code}</Text>
                  <View
                    style={[
                      styles.invoiceStatusPill,
                      String(invoiceData.payment_status).toLowerCase() === "due" && {
                        backgroundColor: "#FEF3C7",
                      },
                      String(invoiceData.payment_status).toLowerCase() === "rejected" && {
                        backgroundColor: "#FEE2E2",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.invoiceStatusText,
                        String(invoiceData.payment_status).toLowerCase() === "due" && {
                          color: "#B45309",
                        },
                        String(invoiceData.payment_status).toLowerCase() === "rejected" && {
                          color: "#DC2626",
                        },
                      ]}
                    >
                      {invoiceData.payment_status}
                    </Text>
                  </View>
                </View>

                <View style={styles.invoiceDetailRow}>
                  <Text style={styles.invoiceRowLabel}>Package Plan</Text>
                  <Text style={styles.invoiceRowVal}>{invoiceData.package_name}</Text>
                </View>

                <View style={styles.invoiceDetailRow}>
                  <Text style={styles.invoiceRowLabel}>Amount Paid</Text>
                  <Text
                    style={[
                      styles.invoiceRowVal,
                      { color: COLORS.primary || "#F9407F", fontFamily: FONTS.bold || "System" },
                    ]}
                  >
                    ₹{invoiceData.amount}
                  </Text>
                </View>

                <View style={styles.invoiceDetailRow}>
                  <Text style={styles.invoiceRowLabel}>Payment Method</Text>
                  <Text style={styles.invoiceRowVal}>
                    {invoiceData.custom_payment_name || "Offline Payment"}
                  </Text>
                </View>

                <View style={styles.invoiceDetailRow}>
                  <Text style={styles.invoiceRowLabel}>Transaction / UTR ID</Text>
                  <Text style={styles.invoiceRowVal}>
                    {invoiceData.custom_payment_transaction_id || "N/A"}
                  </Text>
                </View>

                {invoiceData.custom_payment_proof ? (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.invoiceRowLabel}>Attached Payment Proof:</Text>
                    <Image
                      source={{ uri: invoiceData.custom_payment_proof }}
                      style={styles.invoiceProofImg}
                      resizeMode="contain"
                    />
                  </View>
                ) : null}
              </ScrollView>
            ) : null}

            <TouchableOpacity
              style={styles.closeInvoiceBtn}
              onPress={() => setInvoiceModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeInvoiceBtnText}>Close Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background || "#F9FAFB",
  },
  /* Tabs */
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  tabBtnActive: {
    backgroundColor: COLORS.primary || "#F9407F",
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: FONTS.medium || "System",
    color: COLORS.textSecondary || "#6B7280",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
    fontFamily: FONTS.semiBold || "System",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#6B7280",
  },
  listContent: {
    padding: 16,
  },

  /* Plan Card */
  planCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    position: "relative",
  },
  planCardPopular: {
    borderColor: COLORS.primary || "#F9407F",
    borderWidth: 1.5,
  },
  popularBadge: {
    position: "absolute",
    top: -11,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary || "#F9407F",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: FONTS.bold || "System",
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planTitleWrap: {
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
  },
  planValidity: {
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#6B7280",
    marginTop: 2,
  },
  priceWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  currencySymbol: {
    fontSize: 16,
    fontFamily: FONTS.bold || "System",
    color: COLORS.primary || "#F9407F",
    marginTop: 2,
  },
  priceAmount: {
    fontSize: 26,
    fontFamily: FONTS.bold || "System",
    color: COLORS.primary || "#F9407F",
  },
  planDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 14,
  },
  featureList: {
    gap: 10,
    marginBottom: 18,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureText: {
    fontSize: 13,
    fontFamily: FONTS.regular || "System",
    color: "#374151",
    marginLeft: 10,
  },
  featureHighlight: {
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
  },
  choosePlanBtn: {
    backgroundColor: COLORS.primary || "#F9407F",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: COLORS.primary || "#F9407F",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  choosePlanBtnFree: {
    backgroundColor: "#F3F4F6",
    elevation: 0,
    shadowOpacity: 0,
  },
  choosePlanBtnCurrent: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    elevation: 0,
    shadowOpacity: 0,
  },
  choosePlanBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONTS.bold || "System",
  },
  choosePlanBtnTextFree: {
    color: "#9CA3AF",
  },
  choosePlanBtnTextCurrent: {
    color: "#15803D",
  },
  activePlanBadge: {
    position: "absolute",
    top: -12,
    right: 18,
    backgroundColor: "#16A34A",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    elevation: 3,
  },
  activePlanBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: FONTS.bold || "System",
    letterSpacing: 0.5,
  },
  planCardActive: {
    borderColor: "#16A34A",
    borderWidth: 1.5,
  },

  /* Active Subscription Banner Card on History Tab */
  activeSubscriptionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#86EFAC",
    elevation: 2,
    shadowColor: "#16A34A",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  activeSubTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activeSubLabel: {
    fontSize: 11,
    fontFamily: FONTS.bold || "System",
    color: "#6B7280",
    letterSpacing: 0.5,
  },
  activeSubName: {
    fontSize: 18,
    fontFamily: FONTS.bold || "System",
    color: "#111827",
    marginTop: 2,
  },
  activeSubBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeSubBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.bold || "System",
    color: "#15803D",
  },
  activeSubDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 14,
  },
  activeSubGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  activeSubCol: {
    flex: 1,
    alignItems: "center",
  },
  activeSubVal: {
    fontSize: 16,
    fontFamily: FONTS.bold || "System",
    color: COLORS.primary || "#F9407F",
  },
  activeSubKey: {
    fontSize: 11,
    fontFamily: FONTS.regular || "System",
    color: "#6B7280",
    marginTop: 2,
    textAlign: "center",
  },
  activeSubNote: {
    fontSize: 11,
    fontFamily: FONTS.regular || "System",
    color: "#6B7280",
    marginTop: 8,
    fontStyle: "italic",
    textAlign: "center",
  },

  /* History Card */
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  historyTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyCodeWrap: {},
  historyCodeLabel: {
    fontSize: 10,
    fontFamily: FONTS.bold || "System",
    color: "#9CA3AF",
    letterSpacing: 0.5,
  },
  historyCodeValue: {
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
    color: COLORS.text || "#111827",
    marginTop: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  statusPillPaid: {
    backgroundColor: "#DCFCE7",
  },
  statusPillDue: {
    backgroundColor: "#FEF3C7",
  },
  statusPillRejected: {
    backgroundColor: "#FEE2E2",
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: FONTS.bold || "System",
    color: "#4B5563",
  },
  statusPillTextPaid: {
    color: "#15803D",
  },
  statusPillTextDue: {
    color: "#B45309",
  },
  statusPillTextRejected: {
    color: "#DC2626",
  },
  historyDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 12,
  },
  historyDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyPackageName: {
    fontSize: 15,
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
  },
  historyDate: {
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#6B7280",
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 18,
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
  },
  invoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#FFF1F5",
  },
  invoiceBtnText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold || "System",
    color: COLORS.primary || "#F9407F",
  },

  /* Empty State */
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FFF1F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#6B7280",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyActionBtn: {
    backgroundColor: COLORS.primary || "#F9407F",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 20,
  },
  emptyActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
  },

  /* Purchase Modal Backdrop & Card */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  modalBackdropDismiss: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "85%",
    maxHeight: "90%",
    width: "100%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
  },
  modalHeaderSub: {
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
    color: COLORS.primary || "#F9407F",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  paymentMethodsLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  paymentMethodsLoaderText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 8,
    fontFamily: FONTS.regular || "System",
  },

  /* Method Selector Pills */
  methodsTabWrap: {
    marginBottom: 14,
  },
  methodsTabLabel: {
    fontSize: 12,
    fontFamily: FONTS.semiBold || "System",
    color: "#4B5563",
    marginBottom: 8,
  },
  methodsTabRow: {
    flexDirection: "row",
    gap: 8,
  },
  methodPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  methodPillSelected: {
    backgroundColor: COLORS.primary || "#F9407F",
    borderColor: COLORS.primary || "#F9407F",
  },
  methodPillText: {
    fontSize: 12,
    fontFamily: FONTS.medium || "System",
    color: "#4B5563",
  },
  methodPillTextSelected: {
    color: "#FFFFFF",
    fontFamily: FONTS.bold || "System",
  },

  /* Payment Instruction Card */
  paymentInstructionCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 18,
  },
  paymentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  paymentHeaderIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  paymentHeaderTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold || "System",
    color: "#1E293B",
  },
  paymentHeaderSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: "#64748B",
    marginTop: 1,
  },

  /* QR Presentation */
  qrCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  qrLabel: {
    fontSize: 10,
    fontFamily: FONTS.bold || "System",
    color: "#64748B",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  qrImageContainer: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    padding: 8,
  },
  qrImage: {
    width: Math.min(SCREEN_WIDTH * 0.55, 200),
    height: Math.min(SCREEN_WIDTH * 0.55, 200),
  },
  qrEnlargeHint: {
    position: "absolute",
    bottom: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  qrEnlargeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: FONTS.medium || "System",
  },
  upiAppsRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    width: "100%",
    alignItems: "center",
  },
  upiAppsText: {
    fontSize: 11,
    fontFamily: FONTS.medium || "System",
    color: "#475569",
    textAlign: "center",
  },

  /* Steps */
  stepsWrap: {
    marginTop: 4,
  },
  stepsTitle: {
    fontSize: 12,
    fontFamily: FONTS.bold || "System",
    color: "#334155",
    marginBottom: 8,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  stepNumberBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 10,
    fontFamily: FONTS.bold || "System",
    color: "#4F46E5",
  },
  stepDesc: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: "#475569",
    lineHeight: 17,
  },
  boldText: {
    fontFamily: FONTS.bold || "System",
    color: "#0F172A",
  },

  verificationNoteWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0F9FF",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  verificationNoteText: {
    flex: 1,
    fontSize: 11,
    fontFamily: FONTS.regular || "System",
    color: "#0369A1",
    lineHeight: 16,
  },

  bankInfoBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  bankInfoTitle: {
    fontSize: 11,
    fontFamily: FONTS.bold || "System",
    color: "#334155",
    marginBottom: 4,
  },
  bankInfoText: {
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: "#475569",
    lineHeight: 18,
  },

  /* Form Fields */
  modalField: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
    color: "#374151",
    marginBottom: 6,
  },
  requiredStar: {
    color: "#EF4444",
  },
  modalInput: {
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

  proofPickerRow: {
    flexDirection: "row",
    gap: 8,
  },
  proofPickBtn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  proofPickBtnText: {
    fontSize: 11,
    fontFamily: FONTS.medium || "System",
    color: COLORS.primary || "#F9407F",
    marginTop: 4,
    textAlign: "center",
  },
  proofPreviewCard: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
  proofPreviewImg: {
    width: "100%",
    height: "100%",
  },
  pdfPreviewBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  pdfFileName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
    marginTop: 8,
    maxWidth: 220,
    textAlign: "center",
  },
  pdfFileSize: {
    color: "#94A3B8",
    fontSize: 11,
    fontFamily: FONTS.regular || "System",
    marginTop: 2,
  },
  proofActionRow: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    gap: 8,
  },
  proofChangeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  proofBtnText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: FONTS.semiBold || "System",
  },
  submitPurchaseBtn: {
    backgroundColor: COLORS.primary || "#F9407F",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 20,
    elevation: 2,
    shadowColor: COLORS.primary || "#F9407F",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  submitPurchaseBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONTS.bold || "System",
  },

  /* QR Modal */
  qrModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  qrModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  qrModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  qrModalTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold || "System",
    color: "#0F172A",
  },
  qrModalImg: {
    width: 250,
    height: 250,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  qrModalSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.medium || "System",
    color: "#475569",
    marginTop: 14,
    textAlign: "center",
  },
  qrModalCloseBtn: {
    backgroundColor: COLORS.primary || "#F9407F",
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
  },
  qrModalCloseBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
  },

  /* Invoice Modal */
  invoiceBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  invoiceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    maxHeight: "85%",
    overflow: "hidden",
  },
  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  invoiceBrand: {
    fontSize: 16,
    fontFamily: FONTS.bold || "System",
    color: COLORS.primary || "#F9407F",
    letterSpacing: 0.5,
  },
  invoiceSub: {
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#6B7280",
    marginTop: 1,
  },
  invoiceBody: {
    padding: 20,
  },
  invoiceCodeBanner: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  invoiceCodeBannerLabel: {
    fontSize: 10,
    fontFamily: FONTS.bold || "System",
    color: "#9CA3AF",
    letterSpacing: 0.5,
  },
  invoiceCodeBannerVal: {
    fontSize: 16,
    fontFamily: FONTS.bold || "System",
    color: COLORS.text || "#111827",
    marginTop: 2,
  },
  invoiceStatusPill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
  },
  invoiceStatusText: {
    fontSize: 11,
    fontFamily: FONTS.bold || "System",
    color: "#15803D",
  },
  invoiceDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  invoiceRowLabel: {
    fontSize: 13,
    fontFamily: FONTS.regular || "System",
    color: COLORS.textSecondary || "#6B7280",
  },
  invoiceRowVal: {
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
    color: COLORS.text || "#111827",
  },
  invoiceProofImg: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    marginTop: 8,
  },
  closeInvoiceBtn: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  closeInvoiceBtnText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold || "System",
    color: COLORS.text || "#111827",
  },
});
