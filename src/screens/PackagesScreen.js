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
  StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import ScreenHeader from "../components/ScreenHeader";
import { useAuth } from "../contexts/AuthContext";
import packageService from "../services/packageService";
import planService from "../services/planService";
import { COLORS, FONTS } from "../theme";

export default function PackagesScreen({ navigation }) {
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState("plans"); // "plans" | "history"

  // Active membership plan details
  const [activePlan, setActivePlan] = useState({
    name: "Silver Package",
    key: "silver",
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

  // Purchase modal state
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [transactionId, setTransactionId] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("Paid via manual payment / Bank transfer");
  const [paymentProof, setPaymentProof] = useState(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Invoice modal state
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

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
  const fetchHistoryList = useCallback(async (isPullToRefresh = false) => {
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
      }
    } catch (err) {
      console.log("Error loading purchase history:", err?.message);
    } finally {
      if (isMountedRef.current) {
        setLoadingHistory(false);
        setRefreshingHistory(false);
      }
    }
  }, [token]);

  // Initial load
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
   * Open purchase flow for a package
   */
  const handleSelectPackage = (pkg) => {
    setSelectedPackage(pkg);
    setTransactionId("");
    setPaymentDetails(`Paid via manual payment for ${pkg.name}`);
    setPaymentProof(null);
    setPurchaseModalVisible(true);
  };

  /**
   * Pick payment proof from device
   */
  const handlePickProof = async (fromCamera = false) => {
    try {
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Camera permission is needed to take a photo.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.85,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          setPaymentProof(result.assets[0]);
        }
      } else {
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
      Alert.alert("Transaction ID Required", "Please enter your bank or UPI transaction / UTR reference number.");
      return;
    }

    if (!paymentProof) {
      Alert.alert("Proof Required", "Please upload a screenshot or receipt of your completed payment.");
      return;
    }

    setSubmittingPayment(true);
    try {
      const response = await packageService.purchasePackage(
        {
          package_id: selectedPackage.id,
          amount: selectedPackage.price,
          payment_method: "manual_payment",
          manual_payment_id: 2,
          transaction_id: transactionId.trim(),
          payment_details: paymentDetails.trim(),
          payment_proof: paymentProof,
        },
        token
      );

      Alert.alert(
        "Payment Submitted 🎉",
        response?.message ||
          "Your payment proof has been submitted successfully. Our team will verify and activate your package shortly.",
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
    const isPopular = !isFree && item.price >= 500 && item.price <= 2000;

    const isCurrentPlan = activePlan.isPremium
      ? item.name.toLowerCase().includes(activePlan.key) || (activePlan.key === "silver" && item.price >= 500 && item.price <= 1500)
      : isFree;

    return (
      <View style={[styles.planCard, isPopular && styles.planCardPopular, isCurrentPlan && styles.planCardActive]}>
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
              <Text style={styles.featureHighlight}>{item.profile_view}</Text> Profile Views Allowed
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
            (isFree && !isCurrentPlan) && styles.choosePlanBtnFree,
          ]}
          onPress={() => (isCurrentPlan || isFree ? null : handleSelectPackage(item))}
          disabled={isCurrentPlan || isFree}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.choosePlanBtnText,
              isCurrentPlan && styles.choosePlanBtnTextCurrent,
              (isFree && !isCurrentPlan) && styles.choosePlanBtnTextFree,
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
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                isPaid && styles.statusPillTextPaid,
                isDue && styles.statusPillTextDue,
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
          <Ionicons name="receipt-outline" size={16} color={COLORS.primary || "#F9407F"} style={{ marginRight: 6 }} />
          <Text style={styles.invoiceBtnText}>View Receipt / Invoice</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

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
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary || "#F9407F"} />
            <Text style={styles.centerText}>Loading packages...</Text>
          </View>
        ) : (
          <FlatList
            data={packages}
            keyExtractor={(item, index) =>
              String(item?.id ?? item?.name ?? `pkg_${index}`)
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary || "#F9407F"} />
          <Text style={styles.centerText}>Loading your purchase history...</Text>
        </View>
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
                  <Ionicons name="shield-checkmark" size={13} color="#15803D" style={{ marginRight: 4 }} />
                  <Text style={styles.activeSubBadgeText}>
                    {activePlan.isPremium ? "Active & Verified" : "Free Plan"}
                  </Text>
                </View>
              </View>

              <View style={styles.activeSubDivider} />

              <View style={styles.activeSubGrid}>
                <View style={styles.activeSubCol}>
                  <Text style={styles.activeSubVal}>
                    {activePlan.remainingInterests !== undefined ? `${activePlan.remainingInterests} / ${activePlan.maxInterests}` : activePlan.maxInterests}
                  </Text>
                  <Text style={styles.activeSubKey}>Express Interests</Text>
                </View>
                <View style={styles.activeSubCol}>
                  <Text style={styles.activeSubVal}>
                    {activePlan.remainingContacts !== undefined ? `${activePlan.remainingContacts} / ${activePlan.maxContacts}` : activePlan.maxContacts}
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
              <Text style={styles.emptyTitle}>No Invoices on File</Text>
              <Text style={styles.emptySubtitle}>
                {activePlan.isPremium
                  ? `Your ${activePlan.name} is active. Offline manual bank receipts will appear here once submitted.`
                  : "You haven't purchased any offline packages yet. Choose an upgrade plan to boost your partner search."}
              </Text>
            </View>
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

      {/* ---------- PURCHASE MODAL ---------- */}
      <Modal
        visible={purchaseModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPurchaseModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
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

            <KeyboardAwareScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Payment Instructions Card */}
              <View style={styles.bankInstructionCard}>
                <View style={styles.bankHeaderRow}>
                  <Ionicons name="wallet-outline" size={20} color="#4F46E5" />
                  <Text style={styles.bankHeaderTitle}>Manual Payment / Bank Transfer</Text>
                </View>
                <Text style={styles.bankDesc}>
                  Please transfer <Text style={styles.bankAmountBold}>₹{selectedPackage?.price}</Text> using Bank Transfer, UPI, or QR code. Once paid, fill in your transaction reference and upload the receipt below.
                </Text>
              </View>

              {/* Transaction ID */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>
                  Transaction / UTR ID <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. TXN12345678 or UPI reference"
                  placeholderTextColor="#9CA3AF"
                  value={transactionId}
                  onChangeText={setTransactionId}
                  autoCapitalize="characters"
                />
              </View>

              {/* Payment Details Notes */}
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

              {/* Payment Proof File */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>
                  Payment Proof (Screenshot / Receipt) <Text style={styles.requiredStar}>*</Text>
                </Text>

                {paymentProof ? (
                  <View style={styles.proofPreviewCard}>
                    <Image source={{ uri: paymentProof.uri }} style={styles.proofPreviewImg} resizeMode="cover" />
                    <View style={styles.proofActionRow}>
                      <TouchableOpacity
                        style={styles.proofChangeBtn}
                        onPress={() => handlePickProof(false)}
                      >
                        <Ionicons name="refresh" size={14} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.proofBtnText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.proofChangeBtn, { backgroundColor: "#EF4444" }]}
                        onPress={() => setPaymentProof(null)}
                      >
                        <Ionicons name="trash" size={14} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.proofBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.proofPickerRow}>
                    <TouchableOpacity
                      style={styles.proofPickBtn}
                      onPress={() => handlePickProof(false)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="images-outline" size={20} color={COLORS.primary || "#F9407F"} />
                      <Text style={styles.proofPickBtnText}>Select from Photos</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.proofPickBtn}
                      onPress={() => handlePickProof(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="camera-outline" size={20} color="#4F46E5" />
                      <Text style={[styles.proofPickBtnText, { color: "#4F46E5" }]}>Use Camera</Text>
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
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitPurchaseBtnText}>Submit Payment Proof</Text>
                )}
              </TouchableOpacity>
            </KeyboardAwareScrollView>
          </View>
        </SafeAreaView>
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
                <Text style={{ marginTop: 12, color: "#6B7280", fontSize: 13 }}>Fetching invoice details...</Text>
              </View>
            ) : invoiceData ? (
              <ScrollView style={styles.invoiceBody} showsVerticalScrollIndicator={false}>
                <View style={styles.invoiceCodeBanner}>
                  <Text style={styles.invoiceCodeBannerLabel}>RECEIPT / PAYMENT CODE</Text>
                  <Text style={styles.invoiceCodeBannerVal}>{invoiceData.payment_code}</Text>
                  <View style={styles.invoiceStatusPill}>
                    <Text style={styles.invoiceStatusText}>{invoiceData.payment_status}</Text>
                  </View>
                </View>

                <View style={styles.invoiceDetailRow}>
                  <Text style={styles.invoiceRowLabel}>Package Plan</Text>
                  <Text style={styles.invoiceRowVal}>{invoiceData.package_name}</Text>
                </View>

                <View style={styles.invoiceDetailRow}>
                  <Text style={styles.invoiceRowLabel}>Amount Paid</Text>
                  <Text style={[styles.invoiceRowVal, { color: COLORS.primary || "#F9407F", fontFamily: FONTS.bold || "System" }]}>
                    ₹{invoiceData.amount}
                  </Text>
                </View>

                <View style={styles.invoiceDetailRow}>
                  <Text style={styles.invoiceRowLabel}>Payment Method</Text>
                  <Text style={styles.invoiceRowVal}>{invoiceData.custom_payment_name || "Manual Payment"}</Text>
                </View>

                <View style={styles.invoiceDetailRow}>
                  <Text style={styles.invoiceRowLabel}>Transaction / UTR ID</Text>
                  <Text style={styles.invoiceRowVal}>{invoiceData.custom_payment_transaction_id || "N/A"}</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backBtn: {
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
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
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
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
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

  /* Purchase Modal */
  modalSafe: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
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
  modalScroll: {
    padding: 20,
  },
  bankInstructionCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E0E7FF",
    marginBottom: 18,
  },
  bankHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  bankHeaderTitle: {
    fontSize: 13,
    fontFamily: FONTS.semiBold || "System",
    color: "#4338CA",
    marginLeft: 6,
  },
  bankDesc: {
    fontSize: 12,
    fontFamily: FONTS.regular || "System",
    color: "#374151",
    lineHeight: 18,
  },
  bankAmountBold: {
    fontFamily: FONTS.bold || "System",
    color: "#1E1B4B",
  },
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
    gap: 12,
  },
  proofPickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 14,
  },
  proofPickBtnText: {
    fontSize: 12,
    fontFamily: FONTS.medium || "System",
    color: COLORS.primary || "#F9407F",
    marginLeft: 6,
  },
  proofPreviewCard: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
  },
  proofPreviewImg: {
    width: "100%",
    height: "100%",
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
