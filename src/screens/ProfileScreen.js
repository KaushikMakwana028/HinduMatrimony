import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import ScreenHeader from "../components/ScreenHeader";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { useAuth } from "../contexts/AuthContext";
import profileService from "../services/profileService";
import memberService from "../services/memberService";
import galleryService from "../services/galleryService";
import happyStoryService from "../services/happyStoryService";
import memberStateService from "../services/memberStateService";
import {
  subscribeMemberAction,
  emitMemberAction,
} from "../services/memberEvents";
import { COLORS, FONTS, DEFAULT_AVATAR, DEFAULT_FEMALE_AVATAR } from "../theme";

const ON_BEHALF_MAP = {
  1: "Self",
  2: "Daughter",
  3: "Son",
  4: "Sister",
  5: "Brother",
  6: "Relative",
  7: "Friend",
};

// Set to true to bring back the "Profile details" tab (About me, Personal info, etc.)
const SHOW_PROFILE_DETAILS = false;

const PREMIUM_COLOR = "#6D28D9";
const PREMIUM_SOFT = "#F3E8FF";
const GOLD = "#F5C451";

// Safely extracts a display string from primitive values or relation objects (e.g. { id, name })
function extractString(val, fallback = "") {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    if (typeof val.name === "string" && val.name.trim()) return val.name.trim();
    if (typeof val.title === "string" && val.title.trim())
      return val.title.trim();
    if (typeof val.label === "string" && val.label.trim())
      return val.label.trim();
    if (typeof val.value === "string" && val.value.trim())
      return val.value.trim();
    if (typeof val.text === "string" && val.text.trim()) return val.text.trim();
    if (typeof val.name === "object") return extractString(val.name, fallback);
  }
  return fallback;
}

function normalizeGenderDisplay(value) {
  const raw =
    value && typeof value === "object"
      ? value.name ||
        value.label ||
        value.value ||
        value.gender ||
        value.id ||
        ""
      : value;
  const gender = String(raw ?? "")
    .trim()
    .toLowerCase();

  if (["male", "m", "man", "1"].includes(gender)) return "Male";
  if (["female", "f", "woman", "2"].includes(gender)) return "Female";
  return "";
}

function calculateAge(dob) {
  const cleanDob = extractString(dob);
  if (!cleanDob) return "";
  let birthDate;
  if (cleanDob.includes("/")) {
    const parts = cleanDob.split("/");
    if (parts.length === 3)
      birthDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  } else {
    birthDate = new Date(cleanDob);
  }
  if (!birthDate || isNaN(birthDate.getTime())) return "";
  const diff = Date.now() - birthDate.getTime();
  const ageDate = new Date(diff);
  const age = Math.abs(ageDate.getUTCFullYear() - 1970);
  return age > 0 && age < 120 ? String(age) : "";
}

function toList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(extractString).filter(Boolean);
  return String(extractString(value))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

// List of label/value rows. Safely handles objects {id, name} to avoid React child errors.
function InfoList({ rows }) {
  if (!Array.isArray(rows)) return null;
  const visible = rows
    .map((r) => {
      if (!r) return null;
      const strLabel = extractString(r.label);
      const strVal = extractString(r.value);
      if (!strLabel || !strVal) return null;
      return { label: strLabel, value: strVal };
    })
    .filter(Boolean);

  if (visible.length === 0) return null;
  return (
    <View>
      {visible.map((row, i) => (
        <View
          key={row.label + "_" + i}
          style={[
            styles.infoRow,
            i === visible.length - 1 && styles.infoRowLast,
          ]}
        >
          <Text style={styles.infoLabel}>{row.label}</Text>
          <Text style={styles.infoValue} numberOfLines={2}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ChipGroup({ label, items }) {
  if (!items || !Array.isArray(items) || items.length === 0) return null;
  const validItems = items.map(extractString).filter(Boolean);
  if (validItems.length === 0) return null;
  return (
    <View style={styles.chipBlock}>
      <Text style={styles.chipBlockLabel}>{extractString(label)}</Text>
      <View style={styles.chipWrap}>
        {validItems.map((item, idx) => (
          <View key={item + "_" + idx} style={styles.chip}>
            <Text style={styles.chipText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function EmptyPrompt({ text, onPress }) {
  return (
    <TouchableOpacity
      style={styles.emptyPrompt}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.emptyPromptIcon}>
        <Ionicons name="add" size={16} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyPromptText}>{text}</Text>
    </TouchableOpacity>
  );
}

function ProfileCardSection({ title, icon, sectionKey, navigation, children }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconBadge}>
          <Ionicons name={icon} size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <TouchableOpacity
          style={styles.sectionEditBtn}
          onPress={() =>
            navigation?.navigate("EditProfile", { section: sectionKey })
          }
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="pencil" size={12} color={COLORS.primary} />
          <Text style={styles.sectionEditText}>Edit</Text>
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );
}

function QuickAction({ icon, tint, bg, title, sub, badge, onPress }) {
  const displayTitle = extractString(title);
  const displaySub = extractString(sub);
  const displayBadge = extractString(badge);
  return (
    <TouchableOpacity
      style={styles.quickItem}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.quickIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={tint} />
        {displayBadge ? (
          <View style={styles.quickBadge}>
            <Text style={styles.quickBadgeText}>{displayBadge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.quickTitle} numberOfLines={1}>
        {displayTitle}
      </Text>
      <Text style={styles.quickSub} numberOfLines={1}>
        {displaySub}
      </Text>
    </TouchableOpacity>
  );
}

function MenuGroup({ title, danger, children }) {
  return (
    <View style={styles.menuGroup}>
      <Text style={[styles.menuGroupTitle, danger && { color: COLORS.danger }]}>
        {extractString(title)}
      </Text>
      <View style={styles.menuGroupCard}>{children}</View>
    </View>
  );
}

function MenuRow({ icon, tint, bg, label, onPress, last, danger }) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, last && styles.menuRowLast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <Text style={[styles.menuRowLabel, danger && { color: COLORS.danger }]}>
        {extractString(label)}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={danger ? COLORS.danger : COLORS.textLight}
      />
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function ProfileScreen({ navigation }) {
  const { user, token, logout, updateUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [galleryImages, setGalleryImages] = useState([]);
  const [happyStoryData, setHappyStoryData] = useState({
    hasStory: false,
    story: null,
  });
  const [emailUnverified, setEmailUnverified] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [localAvatar, setLocalAvatar] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState("profile"); // "profile" | "settings"

  const currentUserId = user?.id ? String(user.id) : null;
  const lastUserIdRef = useRef(currentUserId);

  const fetchGallery = useCallback(async () => {
    if (!token) return;
    try {
      const list = await galleryService.getGalleryImages(token);
      if (Array.isArray(list)) {
        setGalleryImages(list);
      }
    } catch {
      // Silently fallback if error
    }
  }, [token]);

  const fetchHappyStory = useCallback(async () => {
    if (!token) return;
    try {
      const res = await happyStoryService.checkHappyStory(token);
      setHappyStoryData({
        hasStory: Boolean(res?.hasStory),
        story: res?.story || null,
      });
    } catch {
      // Silently fallback if error
    }
  }, [token]);

  const fetchFullProfile = useCallback(
    async (forceRefresh = false) => {
      const userId = user?.id;
      if (!userId || !token) {
        setLoading(false);
        return;
      }
      try {
        const response = await profileService.getMyProfile(
          userId,
          token,
          forceRefresh,
        );
        if (response && response.result !== false && response.data) {
          setProfileData(response.data);
          setEmailUnverified(false);
        }
      } catch (err) {
        if (/not verified/i.test(err?.message)) {
          setEmailUnverified(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [user?.id, token],
  );

  // Reset and refetch immediately whenever user ID changes (account switch / re-login)
  useEffect(() => {
    if (currentUserId && lastUserIdRef.current !== currentUserId) {
      lastUserIdRef.current = currentUserId;
      setProfileData(null);
      setLocalAvatar(null);
      setGalleryImages([]);
      fetchFullProfile(true);
      fetchGallery();
      fetchHappyStory();
    }
  }, [currentUserId, fetchFullProfile, fetchGallery, fetchHappyStory]);

  // Refresh data whenever screen comes into focus (serves instant 0ms memory cache)
  useFocusEffect(
    useCallback(() => {
      const isNewUser =
        currentUserId && lastUserIdRef.current !== currentUserId;
      if (isNewUser) {
        lastUserIdRef.current = currentUserId;
        setProfileData(null);
        setLocalAvatar(null);
        setGalleryImages([]);
      }

      Promise.allSettled([
        fetchFullProfile(Boolean(isNewUser)),
        fetchGallery(),
        fetchHappyStory(),
      ]);
    }, [currentUserId, fetchFullProfile, fetchGallery, fetchHappyStory]),
  );

  // Subscribe to cross-screen updates
  useEffect(() => {
    const unsubscribe = subscribeMemberAction((event) => {
      if (event?.type === "gallery_updated") {
        fetchGallery();
      }
      if (event?.type === "happy_story_updated") {
        fetchHappyStory();
      }
      if (
        event?.type === "profile_updated" ||
        event?.type === "profile_photo_updated"
      ) {
        if (event?.photo) {
          setLocalAvatar(event.photo);
        }
        fetchFullProfile(true);
      }
    });
    return unsubscribe;
  }, [fetchGallery, fetchHappyStory, fetchFullProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        fetchFullProfile(true),
        fetchGallery(),
        fetchHappyStory(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchFullProfile, fetchGallery, fetchHappyStory]);

  const handleLogout = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out of HinduMatrimony?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
            } finally {
              setLoggingOut(false);
              navigation.replace("Login");
            }
          },
        },
      ],
    );
  };

  // ---- Extract dynamic fields from profileData or fallback to user ----
  const basicInfo = profileData?.basic_info;
  const contactDetails = profileData?.contact_details;
  const spiritual = profileData?.spiritual_background;
  const presentAddress = profileData?.present_address;
  const permanentAddress = profileData?.permanent_address;
  const physical = profileData?.physical_attributes;
  const educationArr = profileData?.education;
  const careerArr = profileData?.career;
  const lifestyle = profileData?.lifestyles || profileData?.lifestyle;
  const astronomic = profileData?.astrologies || profileData?.astronomic;
  const family = profileData?.families_information || profileData?.family_info;
  const hobbies = profileData?.hobbies_interest || profileData?.hobbies;
  const attitude = profileData?.attitude_behavior || profileData?.attitude;
  const residency =
    profileData?.residence_info ||
    profileData?.residency_info ||
    profileData?.residency;
  const partnerExpectation = profileData?.partner_expectation;
  const knownLanguages = extractString(
    Array.isArray(profileData?.known_languages)
      ? profileData.known_languages
          .map(extractString)
          .filter(Boolean)
          .join(", ")
      : profileData?.known_languages || user?.known_languages,
  );

  const rawUserName = extractString(user?.name);
  const userSplit = rawUserName.trim().split(" ");
  const rawFirstName =
    basicInfo?.first_name ||
    basicInfo?.firs_name ||
    profileData?.first_name ||
    user?.first_name;
  const firstName = extractString(rawFirstName) || userSplit[0] || "";

  const rawLastName =
    basicInfo?.last_name || profileData?.last_name || user?.last_name;
  const lastName =
    extractString(rawLastName) || userSplit.slice(1).join(" ") || "";

  const fullName =
    firstName || lastName
      ? `${firstName} ${lastName}`.trim()
      : rawUserName || "Member profile";

  const memberCode = extractString(
    basicInfo?.code ||
      profileData?.code ||
      user?.code ||
      user?.member_code ||
      (user?.id ? `HM-${user.id}` : ""),
  );

  const memberDob = extractString(
    basicInfo?.date_of_birth ||
      basicInfo?.birthday ||
      basicInfo?.birth_date ||
      profileData?.date_of_birth ||
      user?.date_of_birth ||
      user?.dob ||
      user?.birthday,
  );

  const rawAge = basicInfo?.age ?? user?.age;
  const memberAge = extractString(
    rawAge !== undefined && rawAge !== null && String(rawAge).trim() !== ""
      ? String(rawAge)
      : calculateAge(memberDob),
  );

  const memberGender = normalizeGenderDisplay(
    user?.gender || basicInfo?.gender || profileData?.gender,
  );

  const maritalStatus = extractString(
    basicInfo?.marital_status?.name ||
      basicInfo?.maritial_status?.name ||
      profileData?.marital_status?.name ||
      profileData?.maritial_status?.name ||
      user?.marital_status?.name ||
      basicInfo?.marital_status ||
      basicInfo?.maritial_status ||
      profileData?.marital_status ||
      profileData?.maritial_status ||
      user?.marital_status ||
      user?.maritial_status,
  );

  const rawBehalf =
    basicInfo?.onbehalf?.name ||
    basicInfo?.on_behalf?.name ||
    profileData?.onbehalf?.name ||
    basicInfo?.on_behalf ||
    profileData?.on_behalf ||
    user?.on_behalf;
  const onBehalfKey = extractString(
    typeof rawBehalf === "object"
      ? (rawBehalf?.id ?? rawBehalf?.name)
      : rawBehalf,
  );
  const onBehalfName = extractString(
    typeof rawBehalf === "object" && rawBehalf?.name
      ? rawBehalf.name
      : ON_BEHALF_MAP[onBehalfKey] ||
          (onBehalfKey && isNaN(Number(onBehalfKey)) ? onBehalfKey : "Self"),
    "Self",
  );

  const motherTongue = extractString(
    basicInfo?.mother_tongue?.name ||
      basicInfo?.mothere_tongue?.name ||
      profileData?.mother_tongue?.name ||
      basicInfo?.mother_tongue ||
      basicInfo?.mothere_tongue ||
      profileData?.mother_tongue ||
      user?.mother_tongue ||
      user?.mothere_tongue,
  );

  const defaultAvatarForGender =
    memberGender.toLowerCase() === "female"
      ? DEFAULT_FEMALE_AVATAR
      : DEFAULT_AVATAR;

  const userPhoto = extractString(
    localAvatar ||
      basicInfo?.photo ||
      profileData?.photo ||
      user?.avatar_original ||
      user?.avatar,
    defaultAvatarForGender,
  );

  const userPhone = extractString(
    contactDetails?.phone ||
      basicInfo?.phone ||
      profileData?.phone ||
      user?.phone,
  );

  const userEmail = extractString(
    contactDetails?.email ||
      basicInfo?.email ||
      profileData?.email ||
      user?.email,
  );

  const isPremium = useMemo(() => {
    // 1. Explicit package name checks
    const names = [
      extractString(user?.package_name),
      extractString(profileData?.package_name),
      extractString(profileData?.current_package_info?.package_name),
      extractString(user?.current_package),
    ];
    for (const n of names) {
      if (!n) continue;
      const s = String(n).toLowerCase();
      if (s.includes("free")) return false;
      if (
        s.includes("premium") ||
        s.includes("silver") ||
        s.includes("gold") ||
        s.includes("diamond") ||
        s.includes("platinum") ||
        s.includes("vip")
      ) {
        return true;
      }
    }

    // 2. Package ID check (1 is Free Package)
    const pkgId = Number(
      profileData?.package_id ||
        user?.package_id ||
        profileData?.current_package_info?.package_id ||
        user?.current_package_id,
    );
    if (pkgId === 1) return false;
    if (pkgId > 1) return true;

    // 3. Active Matrimonial CMS membership values: 1 = Free, >= 2 = Premium
    const mem = Number(profileData?.membership ?? user?.membership);
    if (mem === 1) return false;
    if (mem >= 2) return true;

    if (user?.is_premium || profileData?.is_premium) return true;

    return memberStateService.resolvePlan(profileData || user) === "Premium";
  }, [user, profileData]);

  const planName = isPremium ? "Premium member" : "Free member";

  const isAccountDeactivated = Boolean(
    user?.deactivated === 1 ||
    user?.deactivated === "1" ||
    user?.deactivation_status === 1 ||
    user?.deactivation_status === "1" ||
    profileData?.deactivated === 1 ||
    profileData?.deactivated === "1" ||
    profileData?.deactivation_status === 1 ||
    profileData?.deactivation_status === "1",
  );

  const introductionBio = extractString(
    profileData?.introduction || profileData?.intoduction?.introduction,
  );

  const religionName = extractString(
    spiritual?.religion?.name ||
      spiritual?.religion ||
      spiritual?.religion_name ||
      basicInfo?.religion_name ||
      basicInfo?.religion ||
      user?.religion_name ||
      user?.religion ||
      (spiritual?.member_religion_id || spiritual?.religion_id ? "Hindu" : ""),
  );

  const casteName = extractString(
    spiritual?.caste?.name ||
      spiritual?.caste ||
      spiritual?.caste_name ||
      basicInfo?.caste_name ||
      basicInfo?.caste ||
      user?.caste_name ||
      user?.caste,
  );

  const subCasteName = extractString(
    spiritual?.sub_caste?.name ||
      spiritual?.sub_caste ||
      spiritual?.sub_caste_name ||
      basicInfo?.sub_caste_name ||
      user?.sub_caste,
  );

  const city = extractString(
    presentAddress?.city?.name || presentAddress?.city || user?.city,
  );
  const state = extractString(
    presentAddress?.state?.name || presentAddress?.state || user?.state,
  );
  const country = extractString(
    presentAddress?.country?.name || presentAddress?.country || user?.country,
  );
  const locationStr = extractString(
    [city, state, country].filter(Boolean).join(", ") || user?.location,
  );

  const permCity = extractString(
    permanentAddress?.city?.name ||
      permanentAddress?.city ||
      user?.permanent_city,
  );
  const permState = extractString(
    permanentAddress?.state?.name ||
      permanentAddress?.state ||
      user?.permanent_state,
  );
  const permCountry = extractString(
    permanentAddress?.country?.name ||
      permanentAddress?.country ||
      user?.permanent_country,
  );
  const permLocationStr = [permCity, permState, permCountry]
    .filter(Boolean)
    .join(", ");

  const heightStr = extractString(physical?.height || user?.height);
  const weightStr = extractString(physical?.weight || user?.weight);
  const educationStr = extractString(
    Array.isArray(educationArr) && educationArr[0]?.degree
      ? educationArr[0].degree
      : educationArr || user?.education,
  );
  const careerStr = extractString(
    Array.isArray(careerArr) && careerArr[0]?.designation
      ? careerArr[0].designation
      : careerArr || user?.profession || user?.career,
  );

  const hasCustomPhoto = Boolean(
    userPhoto &&
    typeof userPhoto === "string" &&
    !userPhoto.includes("avatar-place"),
  );

  // ---- Profile completeness: score + what's still missing ----
  const { profileCompleteness, missingItems } = useMemo(() => {
    const checklist = [
      {
        key: "photo",
        section: "photo",
        icon: "camera-outline",
        label: "Add profile photo",
        sub: "Upload your main profile photo",
        points: 15,
        done: hasCustomPhoto,
      },
      {
        key: "basic",
        section: "basic",
        icon: "person-outline",
        label: "Basic info",
        sub: "Name, date of birth, marital status",
        points: 15,
        done: Boolean(
          (firstName || user?.name) &&
          (memberDob || memberAge) &&
          maritalStatus,
        ),
      },
      {
        key: "address",
        section: "address",
        icon: "location-outline",
        label: "Location & address",
        sub: "City, state and country details",
        points: 15,
        done: Boolean(
          city || state || locationStr || permCity || permLocationStr,
        ),
      },
      {
        key: "spiritual",
        section: "spiritual",
        icon: "flower-outline",
        label: "Spiritual background",
        sub: "Religion and caste details",
        points: 15,
        done: Boolean(
          spiritual?.member_religion_id ||
          spiritual?.religion_id ||
          spiritual?.member_caste_id ||
          spiritual?.caste_id ||
          spiritual?.member_sub_caste_id ||
          spiritual?.ethnicity ||
          spiritual?.personal_value ||
          religionName ||
          casteName ||
          user?.religion ||
          user?.caste ||
          basicInfo?.religion ||
          basicInfo?.caste,
        ),
      },
      {
        key: "physical",
        section: "physical",
        icon: "body-outline",
        label: "Physical attributes",
        sub: "Height, weight & body details",
        points: 10,
        done: Boolean(
          heightStr || physical?.height || physical?.weight || weightStr,
        ),
      },
      {
        key: "intro",
        section: "introduction",
        icon: "document-text-outline",
        label: "About me / introduction",
        sub: "Brief summary describing yourself",
        points: 10,
        done: Boolean(
          introductionBio && String(introductionBio).trim().length >= 10,
        ),
      },
      {
        key: "partner",
        section: "partner",
        icon: "heart-outline",
        label: "Partner expectations",
        sub: "Preferences for your ideal match",
        points: 10,
        done: Boolean(
          partnerExpectation?.general ||
          partnerExpectation?.residence_country_id ||
          partnerExpectation?.partner_religion_id ||
          partnerExpectation?.partner_caste_id ||
          partnerExpectation?.partner_country_id ||
          partnerExpectation?.pertner_education ||
          partnerExpectation?.partner_profession ||
          partnerExpectation?.partner_marital_status,
        ),
      },
      {
        key: "family",
        section: "family",
        icon: "people-outline",
        label: "Family details",
        sub: "Parents, family background & values",
        points: 10,
        done: Boolean(
          family?.father_name ||
          family?.father ||
          family?.mother_name ||
          family?.mother ||
          family?.family_value_id ||
          family?.family_value ||
          family?.family_status,
        ),
      },
    ];

    const score = checklist.reduce(
      (sum, c) => sum + (c.done ? c.points : 0),
      0,
    );
    return {
      profileCompleteness: Math.min(100, Math.max(0, Math.round(score))),
      missingItems: checklist.filter((c) => !c.done),
    };
  }, [
    hasCustomPhoto,
    firstName,
    user?.name,
    memberDob,
    memberAge,
    maritalStatus,
    religionName,
    casteName,
    spiritual,
    basicInfo?.religion,
    basicInfo?.caste,
    user?.religion,
    user?.caste,
    city,
    state,
    locationStr,
    permCity,
    permLocationStr,
    heightStr,
    physical,
    weightStr,
    introductionBio,
    partnerExpectation,
    family,
  ]);

  const handleUploadAvatar = async (asset) => {
    if (!token) return;
    setUploadingAvatar(true);
    try {
      setLocalAvatar(asset.uri);
      if (updateUser) {
        updateUser({ avatar: asset.uri, avatar_original: asset.uri });
      }

      const response = await memberService.uploadProfilePhoto(
        asset,
        {
          first_name: firstName,
          last_name: lastName,
          email: userEmail,
          phone: userPhone,
          gender: memberGender ? memberGender.toLowerCase() : "",
          date_of_birth: memberDob,
          on_behalf: onBehalfKey || "1",
          marital_status: maritalStatus || "Never Married",
        },
        token,
      );

      const serverUrl = response?.data?.photo || response?.photo || asset.uri;
      setLocalAvatar(serverUrl);
      profileService.clearSettingsCache();
      if (updateUser) {
        updateUser({ avatar: serverUrl, avatar_original: serverUrl });
      }
      emitMemberAction({ type: "profile_updated", photo: serverUrl });
      Alert.alert("Photo updated", "Your profile photo has been updated.");
    } catch (err) {
      console.log("Profile photo upload notice:", err?.message);
      Alert.alert(
        "Upload notice",
        err?.message || "Profile photo updated locally.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const promptProfilePhoto = () => {
    Alert.alert(
      "Update profile photo",
      "Choose how you'd like to add your main profile picture.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Take photo",
          onPress: async () => {
            try {
              const { status } =
                await ImagePicker.requestCameraPermissionsAsync();
              if (status !== "granted") {
                Alert.alert(
                  "Permission required",
                  "Camera access is needed to take a profile picture.",
                );
                return;
              }
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
              });
              if (!res.canceled && res.assets && res.assets.length > 0) {
                handleUploadAvatar(res.assets[0]);
              }
            } catch (err) {
              Alert.alert("Error", err?.message || "Could not launch camera.");
            }
          },
        },
        {
          text: "Choose from library",
          onPress: async () => {
            try {
              const { status } =
                await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== "granted") {
                Alert.alert(
                  "Permission required",
                  "Photo library access is needed to choose a profile picture.",
                );
                return;
              }
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
              });
              if (!res.canceled && res.assets && res.assets.length > 0) {
                handleUploadAvatar(res.assets[0]);
              }
            } catch (err) {
              Alert.alert(
                "Error",
                err?.message || "Could not open photo library.",
              );
            }
          },
        },
      ],
    );
  };

  const SECTION_BY_KEY = {
    photo: "photo",
    basic: "basic",
    name: "basic",
    marital: "basic",
    address: "address",
    location: "address",
    spiritual: "spiritual",
    religion: "spiritual",
    caste: "spiritual",
    education: "education",
    career: "career",
    physical: "physical",
    intro: "introduction",
    introduction: "introduction",
    partner: "partner",
    family: "family",
    hobbies: "hobbies",
    attitude: "attitude",
    residency: "residency",
  };

  const handleMissingPress = (item) => {
    if (!item) return;
    const sectionKey = item.section || SECTION_BY_KEY[item.key] || "basic";
    navigation.navigate("EditProfile", { section: sectionKey });
  };

  const isStrong = profileCompleteness >= 85;
  const barColor = isStrong ? "#10B981" : COLORS.primary;

  const summaryLine = [
    memberAge ? `${memberAge} yrs` : null,
    memberGender,
    maritalStatus,
  ]
    .map(extractString)
    .filter(Boolean)
    .join("  |  ");

  const bannerColor = isPremium ? PREMIUM_COLOR : COLORS.primary;

  const hobbyChips = toList(hobbies?.hobbies);
  const interestChips = toList(hobbies?.interests);

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <ScreenHeader
        title="My Profile"
        subtitle="Matrimonial presence & account"
        badge={planName}
        badgeColor={isPremium ? PREMIUM_COLOR : COLORS.primary}
        badgeBgColor={isPremium ? PREMIUM_SOFT : "#FFF0F5"}
      />

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {emailUnverified && (
          <View style={styles.verificationBanner}>
            <Ionicons
              name="mail-unread-outline"
              size={20}
              color="#B78103"
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.verificationTitle}>Verify your email</Text>
              <Text style={styles.verificationSubtitle}>
                Verify your email on hindumatrimony.org.in to unlock all
                matrimonial features.
              </Text>
            </View>
          </View>
        )}

        {/* ================= HERO ================= */}
        <View style={styles.heroCard}>
          <View style={[styles.heroBanner, { backgroundColor: bannerColor }]}>
            <View style={[styles.bannerCircle, styles.bannerCircleA]} />
            <View style={[styles.bannerCircle, styles.bannerCircleB]} />
            {memberCode ? (
              <View style={styles.idPill}>
                <Text style={styles.idPillText}>ID {memberCode}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.heroBody}>
            <View style={styles.avatarRing}>
              <Image
                source={{
                  uri:
                    userPhoto &&
                    typeof userPhoto === "string" &&
                    userPhoto.trim().length > 0
                      ? userPhoto.trim()
                      : defaultAvatarForGender,
                }}
                style={styles.avatarImg}
                resizeMode="cover"
              />
              {uploadingAvatar ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.avatarCameraBtn}
                  onPress={promptProfilePhoto}
                  activeOpacity={0.85}
                >
                  <Ionicons name="camera" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.nameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {fullName}
              </Text>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#059669"
                style={{ marginLeft: 6 }}
              />
            </View>

            {summaryLine ? (
              <Text style={styles.userSummaryText} numberOfLines={1}>
                {summaryLine}
              </Text>
            ) : null}

            {locationStr || religionName ? (
              <View style={styles.metaRow}>
                {locationStr ? (
                  <View style={styles.metaItem}>
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color={COLORS.textLight}
                    />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {[city, state].filter(Boolean).join(", ") || locationStr}
                    </Text>
                  </View>
                ) : null}
                {religionName ? (
                  <View style={styles.metaItem}>
                    <Ionicons
                      name="flame-outline"
                      size={14}
                      color={COLORS.textLight}
                    />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {religionName}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.heroBadgesRow}>
              <View
                style={[
                  styles.planPill,
                  isPremium ? styles.planPillPremium : styles.planPillFree,
                ]}
              >
                <Ionicons
                  name={isPremium ? "diamond" : "shield-checkmark-outline"}
                  size={12}
                  color={isPremium ? PREMIUM_COLOR : COLORS.primary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.planPillText,
                    { color: isPremium ? PREMIUM_COLOR : COLORS.primary },
                  ]}
                >
                  {planName}
                </Text>
              </View>
              {isAccountDeactivated && (
                <View
                  style={[
                    styles.planPill,
                    {
                      backgroundColor: "#FEF2F2",
                      borderColor: "#FCA5A5",
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Ionicons
                    name="pause-circle"
                    size={12}
                    color="#DC2626"
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.planPillText,
                      { color: "#DC2626", fontWeight: "700" },
                    ]}
                  >
                    Paused
                  </Text>
                </View>
              )}
              {onBehalfName ? (
                <View style={styles.behalfPill}>
                  <Text style={styles.behalfPillText}>
                    Created by{" "}
                    {onBehalfName.toLowerCase() === "self"
                      ? "self"
                      : `your ${onBehalfName.toLowerCase()}`}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.heroActionRow}>
              <TouchableOpacity
                style={styles.heroPrimaryBtn}
                onPress={() => navigation.navigate("EditProfile")}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.heroPrimaryBtnText}>Edit profile</Text>
              </TouchableOpacity>

              {!isPremium ? (
                <TouchableOpacity
                  style={styles.heroUpgradeBtn}
                  onPress={() => navigation.navigate("Packages")}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="sparkles"
                    size={15}
                    color={PREMIUM_COLOR}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={styles.heroUpgradeBtnText}>Upgrade</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        {/* ================= COMPLETENESS ================= */}
        <View style={styles.strengthCard}>
          <View style={styles.strengthHeader}>
            <Text style={styles.strengthTitle}>Profile strength</Text>
            {loading && !profileData ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={[styles.strengthPercent, { color: barColor }]}>
                {profileCompleteness}%
              </Text>
            )}
          </View>

          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${loading && !profileData ? 0 : profileCompleteness}%`,
                  backgroundColor: barColor,
                },
              ]}
            />
          </View>

          {loading && !profileData ? (
            <View
              style={{
                paddingVertical: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: COLORS.textLight,
                  fontFamily: FONTS.medium,
                }}
              >
                Loading profile details...
              </Text>
            </View>
          ) : missingItems.length > 0 ? (
            <View style={styles.missingListContainer}>
              <View style={styles.missingListHeader}>
                <Text
                  style={styles.missingListTitle}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  Missing details ({missingItems.length} left to reach 100%)
                </Text>
              </View>

              {missingItems.map((item, idx) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.missingItemRow,
                    idx === missingItems.length - 1 &&
                      styles.missingItemRowLast,
                  ]}
                  onPress={() => handleMissingPress(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.missingItemIconWrap}>
                    <Ionicons
                      name={item.icon || "create-outline"}
                      size={15}
                      color={COLORS.primary}
                    />
                  </View>

                  <View style={styles.missingItemContent}>
                    <Text
                      style={styles.missingItemTitle}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={styles.missingItemSub}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.sub || "Tap to complete section"}
                    </Text>
                  </View>

                  <View style={styles.missingBadge}>
                    <Text style={styles.missingBadgeText}>+{item.points}%</Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={COLORS.textLight}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.allCompleteRow}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#10B981"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.allCompleteText}>
                Your profile is 100% complete and ready for matches!
              </Text>
            </View>
          )}
        </View>

        {/* ================= QUICK ACTIONS ================= */}
        <View style={styles.quickCard}>
          <QuickAction
            icon="images-outline"
            tint={COLORS.primary}
            bg="#FDF2F8"
            title="Gallery"
            sub={
              galleryImages.length > 0
                ? `${galleryImages.length} photos`
                : "Add photos"
            }
            onPress={() => navigation.navigate("Gallery")}
          />
          <View style={styles.quickDivider} />
          <QuickAction
            icon="heart-outline"
            tint="#EA580C"
            bg="#FFF7ED"
            title="Story"
            sub={happyStoryData.hasStory ? "Published" : "Share yours"}
            onPress={() => navigation.navigate("HappyStory")}
          />
          <View style={styles.quickDivider} />
          <QuickAction
            icon="diamond-outline"
            tint={PREMIUM_COLOR}
            bg={PREMIUM_SOFT}
            title="Packages"
            sub={isPremium ? "Premium" : "Free plan"}
            onPress={() => navigation.navigate("Packages")}
          />
          <View style={styles.quickDivider} />
          <QuickAction
            icon="eye-outline"
            tint="#2563EB"
            bg="#EFF6FF"
            title="Viewers"
            sub="Who viewed you"
            onPress={() => navigation.navigate("ProfileViewer")}
          />
        </View>

        {/* ================= SEGMENT (hidden with profile details) ================= */}
        {SHOW_PROFILE_DETAILS && (
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                activeTab === "profile" && styles.segmentBtnActive,
              ]}
              onPress={() => setActiveTab("profile")}
              activeOpacity={0.85}
            >
              <Ionicons
                name="person-outline"
                size={15}
                color={
                  activeTab === "profile" ? COLORS.primary : COLORS.textLight
                }
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.segmentText,
                  activeTab === "profile" && styles.segmentTextActive,
                ]}
              >
                Profile details
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                activeTab === "settings" && styles.segmentBtnActive,
              ]}
              onPress={() => setActiveTab("settings")}
              activeOpacity={0.85}
            >
              <Ionicons
                name="settings-outline"
                size={15}
                color={
                  activeTab === "settings" ? COLORS.primary : COLORS.textLight
                }
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.segmentText,
                  activeTab === "settings" && styles.segmentTextActive,
                ]}
              >
                Account
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ================= TAB: PROFILE ================= */}
        {SHOW_PROFILE_DETAILS && activeTab === "profile" && (
          <View style={styles.tabContent}>
            <ProfileCardSection
              title="About me"
              icon="document-text-outline"
              sectionKey="introduction"
              navigation={navigation}
            >
              {introductionBio ? (
                <Text style={styles.bioText}>{introductionBio}</Text>
              ) : (
                <EmptyPrompt
                  text="Write a short introduction so matches get to know you"
                  onPress={() =>
                    navigation.navigate("EditProfile", {
                      section: "introduction",
                    })
                  }
                />
              )}
            </ProfileCardSection>

            <ProfileCardSection
              title="Personal information"
              icon="person-circle-outline"
              sectionKey="basic"
              navigation={navigation}
            >
              <InfoList
                rows={[
                  { label: "Full name", value: fullName },
                  { label: "Gender", value: memberGender },
                  {
                    label: "Date of birth",
                    value: memberDob
                      ? `${memberDob}${memberAge ? ` (${memberAge} yrs)` : ""}`
                      : memberAge
                        ? `${memberAge} yrs`
                        : "",
                  },
                  { label: "Marital status", value: maritalStatus },
                  { label: "Profile created for", value: onBehalfName },
                  { label: "Mother tongue", value: motherTongue },
                  { label: "Known languages", value: knownLanguages },
                ]}
              />
            </ProfileCardSection>

            <ProfileCardSection
              title="Religion & community"
              icon="flame-outline"
              sectionKey="spiritual"
              navigation={navigation}
            >
              <InfoList
                rows={[
                  { label: "Religion", value: religionName },
                  {
                    label: "Caste",
                    value: casteName
                      ? `${casteName}${subCasteName ? `, ${subCasteName}` : ""}`
                      : "",
                  },
                  { label: "Ethnicity", value: spiritual?.ethnicity },
                  {
                    label: "Personal values",
                    value: spiritual?.personal_value,
                  },
                ]}
              />
              {!religionName && !casteName && (
                <EmptyPrompt
                  text="Add your religion and community"
                  onPress={() =>
                    navigation.navigate("EditProfile", { section: "spiritual" })
                  }
                />
              )}
            </ProfileCardSection>

            <ProfileCardSection
              title="Contact & location"
              icon="location-outline"
              sectionKey="address"
              navigation={navigation}
            >
              <InfoList
                rows={[
                  { label: "Phone", value: userPhone },
                  { label: "Email", value: userEmail },
                  { label: "Present location", value: locationStr },
                  { label: "Permanent location", value: permLocationStr },
                ]}
              />
              {!locationStr && !userPhone && (
                <EmptyPrompt
                  text="Add your contact and location"
                  onPress={() =>
                    navigation.navigate("EditProfile", { section: "address" })
                  }
                />
              )}
            </ProfileCardSection>

            <ProfileCardSection
              title="Physical & lifestyle"
              icon="fitness-outline"
              sectionKey="physical"
              navigation={navigation}
            >
              <InfoList
                rows={[
                  {
                    label: "Height",
                    value: heightStr ? `${heightStr} ft` : "",
                  },
                  {
                    label: "Weight",
                    value: weightStr ? `${weightStr} kg` : "",
                  },
                  { label: "Blood group", value: physical?.blood_group },
                  { label: "Complexion", value: physical?.complexion },
                  { label: "Body type", value: physical?.body_type },
                  { label: "Diet", value: lifestyle?.diet },
                  { label: "Drink", value: lifestyle?.drink },
                  { label: "Smoke", value: lifestyle?.smoke },
                  { label: "Living with", value: lifestyle?.living_with },
                ]}
              />
              {!heightStr && !lifestyle?.diet && (
                <EmptyPrompt
                  text="Add your physical details and lifestyle"
                  onPress={() =>
                    navigation.navigate("EditProfile", { section: "physical" })
                  }
                />
              )}
            </ProfileCardSection>

            {educationStr || careerStr ? (
              <ProfileCardSection
                title="Education & profession"
                icon="briefcase-outline"
                sectionKey="education"
                navigation={navigation}
              >
                <InfoList
                  rows={[
                    { label: "Education", value: educationStr },
                    { label: "Profession", value: careerStr },
                  ]}
                />
              </ProfileCardSection>
            ) : null}

            {astronomic &&
            (astronomic.sun_sign ||
              astronomic.moon_sign ||
              astronomic.time_of_birth ||
              astronomic.city_of_birth) ? (
              <ProfileCardSection
                title="Horoscope"
                icon="planet-outline"
                sectionKey="astronomic"
                navigation={navigation}
              >
                <InfoList
                  rows={[
                    { label: "Sun sign (Rashi)", value: astronomic.sun_sign },
                    { label: "Moon sign", value: astronomic.moon_sign },
                    { label: "Time of birth", value: astronomic.time_of_birth },
                    { label: "City of birth", value: astronomic.city_of_birth },
                  ]}
                />
              </ProfileCardSection>
            ) : null}

            {family && (family.father || family.mother || family.sibling) ? (
              <ProfileCardSection
                title="Family information"
                icon="people-outline"
                sectionKey="family"
                navigation={navigation}
              >
                <InfoList
                  rows={[
                    { label: "Father", value: family?.father },
                    { label: "Mother", value: family?.mother },
                    { label: "Siblings", value: family?.sibling },
                  ]}
                />
              </ProfileCardSection>
            ) : null}

            {hobbies &&
            (hobbies.hobbies ||
              hobbies.interests ||
              hobbies.music ||
              hobbies.books ||
              hobbies.movies ||
              hobbies.tv_shows ||
              hobbies.sports ||
              hobbies.fitness_activities ||
              hobbies.cuisines ||
              hobbies.dress_styles) ? (
              <ProfileCardSection
                title="Hobbies & interests"
                icon="happy-outline"
                sectionKey="hobbies"
                navigation={navigation}
              >
                <ChipGroup label="Hobbies" items={hobbyChips} />
                <ChipGroup label="Interests" items={interestChips} />
                <InfoList
                  rows={[
                    { label: "Favorite music", value: hobbies.music },
                    { label: "Favorite books", value: hobbies.books },
                    { label: "Favorite movies", value: hobbies.movies },
                    { label: "TV shows", value: hobbies.tv_shows },
                    { label: "Sports", value: hobbies.sports },
                    {
                      label: "Fitness activities",
                      value: hobbies.fitness_activities,
                    },
                    { label: "Cuisines", value: hobbies.cuisines },
                    { label: "Dress styles", value: hobbies.dress_styles },
                  ]}
                />
              </ProfileCardSection>
            ) : null}

            {attitude &&
            (attitude.affection ||
              attitude.humor ||
              attitude.political_views ||
              attitude.religious_service) ? (
              <ProfileCardSection
                title="Attitude & behavior"
                icon="heart-circle-outline"
                sectionKey="attitude"
                navigation={navigation}
              >
                <InfoList
                  rows={[
                    { label: "Affection", value: attitude.affection },
                    { label: "Humor", value: attitude.humor },
                    {
                      label: "Political views",
                      value: attitude.political_views,
                    },
                    {
                      label: "Religious service",
                      value: attitude.religious_service,
                    },
                  ]}
                />
              </ProfileCardSection>
            ) : null}

            {residency &&
            (residency.birth_country ||
              residency.recidency_country ||
              residency.residency_country ||
              residency.growup_country ||
              residency.immigration_status) ? (
              <ProfileCardSection
                title="Residency information"
                icon="globe-outline"
                sectionKey="residency"
                navigation={navigation}
              >
                <InfoList
                  rows={[
                    {
                      label: "Birth country",
                      value: residency.birth_country,
                    },
                    {
                      label: "Residency country",
                      value:
                        residency.recidency_country ||
                        residency.residency_country,
                    },
                    {
                      label: "Grow-up country",
                      value: residency.growup_country,
                    },
                    {
                      label: "Immigration status",
                      value: residency.immigration_status,
                    },
                  ]}
                />
              </ProfileCardSection>
            ) : null}

            <ProfileCardSection
              title="Partner preferences"
              icon="heart-circle-outline"
              sectionKey="partner"
              navigation={navigation}
            >
              {partnerExpectation?.general ? (
                <Text style={[styles.bioText, { marginBottom: 10 }]}>
                  {extractString(partnerExpectation.general)}
                </Text>
              ) : null}
              <InfoList
                rows={[
                  {
                    label: "Preferred height",
                    value: partnerExpectation?.partner_height
                      ? `${partnerExpectation.partner_height} ft`
                      : "",
                  },
                  { label: "Diet", value: partnerExpectation?.partner_diet },
                  {
                    label: "Education",
                    value: partnerExpectation?.pertner_education,
                  },
                  {
                    label: "Profession",
                    value: partnerExpectation?.partner_profession,
                  },
                ]}
              />
              {!partnerExpectation?.general &&
                !partnerExpectation?.partner_height && (
                  <EmptyPrompt
                    text="Set your partner preferences for better matches"
                    onPress={() =>
                      navigation.navigate("EditProfile", { section: "partner" })
                    }
                  />
                )}
            </ProfileCardSection>
          </View>
        )}

        {/* ================= TAB: ACCOUNT ================= */}
        {(!SHOW_PROFILE_DETAILS || activeTab === "settings") && (
          <View style={styles.tabContent}>
            <MenuGroup title="Profile & privacy">
              <MenuRow
                icon="person-outline"
                tint={COLORS.primary}
                bg="#FDF2F8"
                label="Edit profile"
                onPress={() => navigation.navigate("EditProfile")}
              />
              <MenuRow
                icon="ban-outline"
                tint="#4B5563"
                bg="#F3F4F6"
                label="Ignored users"
                onPress={() => navigation.navigate("IgnoredUsers")}
                last
              />
            </MenuGroup>

            <MenuGroup title="Security">
              <MenuRow
                icon="key-outline"
                tint="#059669"
                bg="#ECFDF5"
                label="Change password"
                onPress={() => navigation.navigate("ChangePassword")}
                last
              />
            </MenuGroup>

            <MenuGroup title="Account controls" danger={!isAccountDeactivated}>
              {isAccountDeactivated ? (
                <MenuRow
                  icon="play-circle-outline"
                  tint="#059669"
                  bg="#ECFDF5"
                  label="Activate account"
                  onPress={() => navigation.navigate("DeactivateAccount")}
                />
              ) : (
                <MenuRow
                  icon="pause-circle-outline"
                  tint={COLORS.danger}
                  bg={COLORS.dangerSoft}
                  label="Deactivate account"
                  danger
                  onPress={() => navigation.navigate("DeactivateAccount")}
                />
              )}
              <MenuRow
                icon="trash-outline"
                tint={COLORS.danger}
                bg={COLORS.dangerSoft}
                label="Delete account permanently"
                danger
                onPress={() => navigation.navigate("DeleteAccount")}
                last
              />
            </MenuGroup>

            <TouchableOpacity
              style={[styles.logoutBtn, loggingOut && { opacity: 0.7 }]}
              onPress={handleLogout}
              disabled={loggingOut}
              activeOpacity={0.85}
            >
              {loggingOut ? (
                <ActivityIndicator color={COLORS.primary} size="small" />
              ) : (
                <>
                  <Ionicons
                    name="log-out-outline"
                    size={18}
                    color={COLORS.primary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.logoutText}>Sign out</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.versionText}>HinduMatrimony app | v1.0.0</Text>
          </View>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const CARD_SHADOW = {
  shadowColor: "#7A4A2B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 2,
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 48,
  },

  /* ---------- Verification banner ---------- */
  verificationBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9E6",
    borderWidth: 1,
    borderColor: "#FFE082",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  verificationTitle: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: "#B78103",
  },
  verificationSubtitle: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: "#6D540A",
    marginTop: 2,
    lineHeight: 15,
  },

  /* ---------- Hero ---------- */
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 26,
    overflow: "hidden",
    marginBottom: 14,
    ...CARD_SHADOW,
  },
  heroBanner: {
    height: 96,
    overflow: "hidden",
  },
  bannerCircle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  bannerCircleA: {
    width: 150,
    height: 150,
    top: -60,
    right: -30,
  },
  bannerCircleB: {
    width: 90,
    height: 90,
    bottom: -40,
    left: 24,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  idPill: {
    position: "absolute",
    top: 12,
    right: 14,
    backgroundColor: "rgba(0,0,0,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  idPillText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: FONTS.medium,
    letterSpacing: 0.3,
  },
  heroBody: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  avatarRing: {
    marginTop: -52,
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  avatarImg: {
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: "#F3F4F6",
  },
  avatarOverlay: {
    position: "absolute",
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCameraBtn: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    maxWidth: "100%",
  },
  userName: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  userSummaryText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: 14,
    rowGap: 4,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 190,
  },
  metaText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    flexShrink: 1,
  },
  heroBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  planPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  planPillPremium: {
    backgroundColor: PREMIUM_SOFT,
    borderWidth: 1,
    borderColor: GOLD,
  },
  planPillFree: {
    backgroundColor: "#FFF0F5",
  },
  planPillText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
  },
  behalfPill: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  behalfPillText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: "#4B5563",
  },
  heroActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    alignSelf: "stretch",
  },
  heroPrimaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  heroPrimaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
  heroUpgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PREMIUM_SOFT,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  heroUpgradeBtnText: {
    color: PREMIUM_COLOR,
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },

  /* ---------- Strength ---------- */
  strengthCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    ...CARD_SHADOW,
  },
  strengthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  strengthTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  strengthPercent: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    letterSpacing: -0.4,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#F3EDE8",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  /* Missing items list in strength card */
  missingListContainer: {
    marginTop: 14,
    backgroundColor: "#FFF9FA",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FCE7F3",
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: "hidden",
  },
  missingListHeader: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#FCE7F3",
  },
  missingListTitle: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  missingItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#FCE7F3",
  },
  missingItemRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  missingItemIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFE4EE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  missingItemContent: {
    flex: 1,
    marginRight: 8,
  },
  missingItemTitle: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  missingItemSub: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 1,
  },
  missingBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#FFE4EE",
    marginRight: 6,
  },
  missingBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  allCompleteRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  allCompleteText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: "#059669",
    flex: 1,
  },

  /* ---------- Quick actions (4 across) ---------- */
  quickCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginBottom: 16,
    ...CARD_SHADOW,
  },
  quickItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 2,
  },
  quickDivider: {
    width: 1,
    marginVertical: 8,
    backgroundColor: "#F5EFEA",
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: FONTS.bold,
  },
  quickTitle: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  quickSub: {
    fontSize: 10.5,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 2,
  },

  /* ---------- Segment ---------- */
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#EDE5DE",
    borderRadius: 16,
    padding: 4,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  segmentTextActive: {
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },

  /* ---------- Detail sections ---------- */
  tabContent: {
    gap: 12,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    ...CARD_SHADOW,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  sectionEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#FFF0F5",
  },
  sectionEditText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EADFD6",
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    flex: 1.3,
    textAlign: "right",
  },
  bioText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    lineHeight: 21,
    paddingBottom: 6,
  },
  chipBlock: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  chipBlockLabel: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#FFF0F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  emptyPrompt: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#F9C6D9",
    backgroundColor: "#FFFAFC",
  },
  emptyPromptIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFE4EE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  emptyPromptText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },

  /* ---------- Account tab ---------- */
  menuGroup: {
    marginBottom: 4,
  },
  menuGroupTitle: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.textLight,
    marginBottom: 8,
    marginLeft: 6,
  },
  menuGroupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    ...CARD_SHADOW,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EADFD6",
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuRowLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutText: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
    fontSize: 15,
  },
  versionText: {
    textAlign: "center",
    color: COLORS.textLight,
    fontFamily: FONTS.regular,
    fontSize: 11,
    marginTop: 14,
  },
});
