import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import ScreenHeader from "../components/ScreenHeader";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import OptionPickerModal from "../components/OptionPickerModal";
import { useAuth } from "../contexts/AuthContext";
import profileService from "../services/profileService";
import memberService from "../services/memberService";
import { emitMemberAction } from "../services/memberEvents";
import { COLORS, FONTS, DEFAULT_AVATAR } from "../theme";

/* -------------------------------------------------------------------------- */
/*  Static option lists                                                       */
/* -------------------------------------------------------------------------- */

const DEFAULT_MARITAL_STATUSES = [
  { id: 1, name: "Never Married" },
  { id: 2, name: "Divorced" },
  { id: 3, name: "Widowed" },
  { id: 4, name: "Awaiting Divorce" },
];

const DEFAULT_ON_BEHALVES = [
  { id: 1, name: "Self" },
  { id: 2, name: "Daughter" },
  { id: 3, name: "Son" },
  { id: 4, name: "Sister" },
  { id: 5, name: "Brother" },
  { id: 6, name: "Relative" },
  { id: 7, name: "Friend" },
];

const DEFAULT_FAMILY_VALUES = [
  { id: 1, name: "Traditional" },
  { id: 2, name: "Moderate" },
  { id: 3, name: "Liberal" },
];

const GENDER_OPTIONS = [
  { value: "Male", label: "👨  Male" },
  { value: "Female", label: "👩  Female" },
];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const COMPLEXIONS = ["Very Fair", "Fair", "Wheatish", "Dusky", "Dark"];
const BODY_TYPES = ["Slim", "Athletic", "Average", "Heavy"];
const DIETS = ["Vegetarian", "Non-Vegetarian", "Eggetarian", "Vegan", "Jain"];
const HABIT_OPTIONS = ["No", "Occasionally", "Yes"];
const LIVING_WITH = ["Family", "Alone", "Friends"];
const PERSONAL_VALUES = ["Traditional", "Moderate", "Liberal"];
const NO_YES_ANY = ["No", "Yes", "Doesn't Matter"];
const HABIT_ANY = ["No", "Occasionally", "Yes", "Doesn't Matter"];
const COMPLEXIONS_ANY = [...COMPLEXIONS, "Any"];
const BODY_TYPES_ANY = [...BODY_TYPES, "Any"];
const VALUES_ANY = [...PERSONAL_VALUES, "Any"];
const DIETS_ANY = ["Vegetarian", "Non-Vegetarian", "Any"];

const has = (v) => v !== null && v !== undefined && v !== "";

// Turns an id, an {id, name} object, or a plain name ("Hindu") into the option id.
// Returns null when nothing matches.
const resolveId = (list, value) => {
  if (!has(value)) return null;
  const raw = typeof value === "object" ? (value.id ?? value.name) : value;
  if (!has(raw)) return null;

  const items = list || [];
  const byId = items.find((x) => String(x.id) === String(raw));
  if (byId) return byId.id;

  const needle = String(raw).trim().toLowerCase();
  const byName = items.find(
    (x) => String(x.name).trim().toLowerCase() === needle,
  );
  if (byName) return byName.id;

  // Object with an id that is not in the list (e.g. { id: 1, name: "My Self" })
  if (typeof value === "object" && has(value.id)) return value.id;
  return null;
};

/* -------------------------------------------------------------------------- */
/*  Reusable UI pieces (defined OUTSIDE the screen so inputs keep focus)      */
/* -------------------------------------------------------------------------- */

function StatusBadge({ kind, text }) {
  if (!kind) return null;
  const map = {
    done: {
      bg: "#E7F7EF",
      fg: "#059669",
      icon: "checkmark-circle",
      label: "Done",
    },
    missing: {
      bg: "#FEE2E2",
      fg: "#DC2626",
      icon: "alert-circle",
      label: text,
    },
    empty: {
      bg: "#F1F1F4",
      fg: "#6B7280",
      icon: "add-circle-outline",
      label: "Add",
    },
  };
  const c = map[kind] || map.empty;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Ionicons
        name={c.icon}
        size={11}
        color={c.fg}
        style={{ marginRight: 3 }}
      />
      <Text style={[styles.badgeLabel, { color: c.fg }]} numberOfLines={1}>
        {c.label}
      </Text>
    </View>
  );
}

function SectionCard({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  badge,
  expanded,
  onToggle,
  children,
}) {
  return (
    <View style={[styles.sectionCard, expanded && styles.sectionCardOpen]}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={onToggle}
        activeOpacity={0.75}
      >
        <View style={[styles.sectionIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={19} color={iconColor} />
        </View>
        <View style={styles.sectionTitleCol}>
          <Text style={styles.sectionTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.sectionSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {badge ? <StatusBadge kind={badge.kind} text={badge.text} /> : null}
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={expanded ? COLORS.primary : COLORS.textLight}
          style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>
      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Ionicons
        name="alert-circle"
        size={20}
        color="#DC2626"
        style={{ marginRight: 10, marginTop: 1 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.errorTitle}>Please fix the details below</Text>
        <Text style={styles.errorText}>{message}</Text>
      </View>
    </View>
  );
}

function MissingText({ text }) {
  return (
    <View style={styles.missingRow}>
      <Ionicons
        name="alert-circle"
        size={13}
        color="#DC2626"
        style={{ marginRight: 4 }}
      />
      <Text style={styles.missingText}>{text}</Text>
    </View>
  );
}

function FieldLabel({ label, required }) {
  if (!label) return null;
  return (
    <Text style={styles.label}>
      {label}
      {required ? <Text style={styles.star}> *</Text> : null}
    </Text>
  );
}

function Field({
  label,
  required,
  missing,
  missingText,
  multiline,
  style,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel label={label} required={required} />
      <TextInput
        style={[
          styles.input,
          multiline && styles.textArea,
          focused && styles.inputFocused,
          missing && styles.inputMissing,
          style,
        ]}
        placeholderTextColor="#A8A29E"
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      />
      {missing ? (
        <MissingText text={missingText || `${label} is missing`} />
      ) : null}
    </View>
  );
}

function SelectField({
  label,
  required,
  missing,
  missingText,
  value,
  placeholder,
  onPress,
}) {
  const filled = Boolean(value);
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel label={label} required={required} />
      <TouchableOpacity
        style={[styles.selectBtn, missing && styles.inputMissing]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <Text
          style={[styles.selectText, !filled && styles.selectPlaceholder]}
          numberOfLines={1}
        >
          {filled ? value : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
      </TouchableOpacity>
      {missing ? (
        <MissingText text={missingText || `${label} is missing`} />
      ) : null}
    </View>
  );
}

// options: array of strings OR { value, label }
function ChipGroup({ label, options, value, onChange, segmented }) {
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel label={label} />
      <View style={segmented ? styles.segRow : styles.chipWrap}>
        {options.map((opt) => {
          const v = typeof opt === "object" ? opt.value : opt;
          const l = typeof opt === "object" ? opt.label : opt;
          const active =
            String(value || "").toLowerCase() === String(v).toLowerCase();
          return (
            <TouchableOpacity
              key={v}
              style={[
                segmented ? styles.segBtn : styles.chip,
                active && styles.chipActive,
              ]}
              onPress={() => onChange(v)}
              activeOpacity={0.75}
            >
              {active && !segmented ? (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={COLORS.primary}
                  style={{ marginRight: 4 }}
                />
              ) : null}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {l}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function Row({ children }) {
  return <View style={styles.row}>{children}</View>;
}

function Col({ children }) {
  return <View style={styles.col}>{children}</View>;
}

function SaveButton({ label, saving, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.saveSectionBtn, saving && styles.disabled]}
      onPress={onPress}
      disabled={saving}
      activeOpacity={0.85}
    >
      {saving ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.saveSectionBtnText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function GroupTitle({ children }) {
  return <Text style={styles.groupTitle}>{children}</Text>;
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function EditProfileScreen({ navigation, route }) {
  const { user, token, updateUser } = useAuth();
  const routeSection = route?.params?.section;
  const [prevRouteSection, setPrevRouteSection] = useState(routeSection);
  const [expandedSection, setExpandedSection] = useState(
    routeSection || "basic",
  );

  if (routeSection && routeSection !== prevRouteSection) {
    setPrevRouteSection(routeSection);
    setExpandedSection(routeSection);
  }
  const [loading, setLoading] = useState(false);
  const [savingSection, setSavingSection] = useState(null);
  const [memberCode, setMemberCode] = useState(user?.code || "");

  // Section-specific inline error banners and missing field highlights
  const [sectionErrors, setSectionErrors] = useState({});
  const [missingFields, setMissingFields] = useState({});

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // No history: go to a safe screen. Change "Home" if your route name differs.
      navigation.navigate("Home");
    }
  };

  const clearFieldError = (sectionKey, fieldKey) => {
    if (fieldKey) {
      setMissingFields((prev) => {
        if (!prev[sectionKey]?.[fieldKey]) return prev;
        const nextSection = { ...prev[sectionKey] };
        delete nextSection[fieldKey];
        return { ...prev, [sectionKey]: nextSection };
      });
    } else {
      setMissingFields((prev) => {
        if (!prev[sectionKey]) return prev;
        const next = { ...prev };
        delete next[sectionKey];
        return next;
      });
    }
    setSectionErrors((prev) => {
      if (!prev[sectionKey]) return prev;
      const next = { ...prev };
      delete next[sectionKey];
      return next;
    });
  };

  const isFieldMissing = (sectionKey, fieldKey) => {
    return Boolean(missingFields[sectionKey]?.[fieldKey]);
  };

  // Server-provided settings dropdowns
  const [serverSettings, setServerSettings] = useState(null);

  // Option Picker Modal State
  const [pickerModal, setPickerModal] = useState({
    visible: false,
    title: "",
    subtitle: "",
    options: [],
    selectedId: null,
    onSelect: null,
  });

  // Opens the picker; closes it automatically after a choice
  const openPicker = (title, options, selectedId, onPick) => {
    setPickerModal({
      visible: true,
      title,
      subtitle: "",
      options,
      selectedId,
      onSelect: (item) => {
        onPick(item);
        setPickerModal((prev) => ({ ...prev, visible: false }));
      },
    });
  };

  // 1. Introduction
  const [introduction, setIntroduction] = useState("");

  // 2. Basic Info
  const [basicInfo, setBasicInfo] = useState(() => {
    const parts = (user?.name || "").split(" ");
    return {
      first_name: parts[0] || "",
      last_name: parts.slice(1).join(" ") || "",
      gender: user?.gender || "",
      date_of_birth: "",
      marital_status: null,
      children: "",
      on_behalf: null,
      phone: user?.phone || "",
      email: user?.email || "",
    };
  });

  // 3. Contact Info
  const [contactInfo, setContactInfo] = useState({
    phone: user?.phone || "",
    email: user?.email || "",
  });

  // 4. Address Details (Present & Permanent)
  const [addressType, setAddressType] = useState("present");
  const [presentAddress, setPresentAddress] = useState({
    country_id: null,
    state_id: null,
    city_id: null,
    postal_code: "",
  });
  const [permanentAddress, setPermanentAddress] = useState({
    country_id: null,
    state_id: null,
    city_id: null,
    postal_code: "",
  });

  // 5. Physical Attributes
  const [physical, setPhysical] = useState({
    height: "",
    weight: "",
    eye_color: "",
    hair_color: "",
    complexion: "",
    blood_group: "",
    body_type: "",
    body_art: "",
    disability: "",
  });

  // 6. Language Details
  const [language, setLanguage] = useState({
    mothere_tongue: "",
    known_languages: "",
  });

  // 7. Hobbies & Interests
  const [hobbies, setHobbies] = useState({
    hobbies: "",
    interests: "",
    music: "",
    books: "",
    movies: "",
    tv_shows: "",
    sports: "",
    fitness_activities: "",
    cuisines: "",
    dress_styles: "",
  });

  // 8. Attitude & Behavior
  const [attitude, setAttitude] = useState({
    affection: "",
    humor: "",
    political_views: "",
    religious_service: "",
  });

  // 9. Residency Info
  const [residency, setResidency] = useState({
    birth_country_id: null,
    recidency_country_id: null,
    growup_country_id: null,
    immigration_status: "",
  });

  // 10. Spiritual & Community Background
  const [spiritual, setSpiritual] = useState({
    member_religion_id: null,
    member_caste_id: null,
    member_sub_caste_id: null,
    ethnicity: "",
    personal_value: "",
    family_value_id: null,
    community_value: "",
  });

  // 11. Lifestyle
  const [lifestyle, setLifestyle] = useState({
    diet: "",
    drink: "",
    smoke: "",
    living_with: "",
  });

  // 12. Astronomic / Horoscope
  const [astronomic, setAstronomic] = useState({
    sun_sign: "",
    moon_sign: "",
    time_of_birth: "",
    city_of_birth: "",
  });

  // 13. Family Information
  const [family, setFamily] = useState({
    father: "",
    mother: "",
    sibling: "",
  });

  // 14. Partner Expectations
  const [partnerExpectation, setPartnerExpectation] = useState({
    general: "",
    partner_height: "",
    partner_weight: "",
    partner_marital_status: null,
    partner_children_acceptable: "",
    residence_country_id: null,
    partner_religion_id: null,
    partner_caste_id: null,
    partner_sub_caste_id: null,
    pertner_education: "",
    partner_profession: "",
    smoking_acceptable: "",
    drinking_acceptable: "",
    partner_diet: "",
    partner_body_type: "",
    partner_personal_value: "",
    partner_manglik: "",
    language_id: null,
    family_value_id: null,
    partner_country_id: null,
    partner_state_id: null,
    pertner_complexion: "",
  });

  const [localAvatar, setLocalAvatar] = useState(null);
  const [serverPhoto, setServerPhoto] = useState(null);
  const [avatarError, setAvatarError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Derived settings dropdown lists
  const countryList = useMemo(
    () => serverSettings?.countries || [],
    [serverSettings],
  );
  const stateList = useMemo(
    () => serverSettings?.states || [],
    [serverSettings],
  );
  const cityList = useMemo(
    () => serverSettings?.cities || [],
    [serverSettings],
  );
  const religionList = useMemo(
    () => serverSettings?.religions || [],
    [serverSettings],
  );
  const casteList = useMemo(
    () => serverSettings?.castes || [],
    [serverSettings],
  );
  const subCasteList = useMemo(
    () => serverSettings?.sub_castes || [],
    [serverSettings],
  );
  const maritalStatusList = useMemo(
    () =>
      serverSettings?.marital_statuses?.length
        ? serverSettings.marital_statuses
        : DEFAULT_MARITAL_STATUSES,
    [serverSettings],
  );
  const onBehalfList = useMemo(
    () =>
      serverSettings?.on_behalves?.length
        ? serverSettings.on_behalves
        : DEFAULT_ON_BEHALVES,
    [serverSettings],
  );
  const familyValueList = useMemo(
    () =>
      serverSettings?.family_values?.length
        ? serverSettings.family_values
        : DEFAULT_FAMILY_VALUES,
    [serverSettings],
  );
  const languageList = useMemo(
    () => serverSettings?.languages || [],
    [serverSettings],
  );

  // Helpers to get display names
  const getOptionName = (list, id, fallback = "") => {
    if (!id) return fallback;
    const item = (list || []).find((x) => String(x.id) === String(id));
    return item ? item.name : fallback || String(id);
  };

  // Calculate missing fields in Basic Information
  const basicMissingFields = useMemo(() => {
    const missing = [];
    if (!String(basicInfo.first_name || "").trim())
      missing.push({ key: "first_name", label: "First Name" });
    if (!String(basicInfo.gender || "").trim())
      missing.push({ key: "gender", label: "Gender" });
    if (!String(basicInfo.date_of_birth || "").trim())
      missing.push({ key: "date_of_birth", label: "Date of Birth" });
    if (!basicInfo.marital_status)
      missing.push({ key: "marital_status", label: "Marital Status" });
    if (!basicInfo.on_behalf)
      missing.push({ key: "on_behalf", label: "On Behalf" });
    if (
      !String(contactInfo.phone || basicInfo.phone || "").trim() &&
      !String(contactInfo.email || basicInfo.email || "").trim()
    ) {
      missing.push({ key: "contact", label: "Phone or Email" });
    }
    return missing;
  }, [basicInfo, contactInfo]);

  // Address missing check
  const addressMissingCount = useMemo(() => {
    let count = 0;
    if (!presentAddress.country_id) count++;
    if (!presentAddress.state_id) count++;
    if (!presentAddress.city_id) count++;
    if (!String(presentAddress.postal_code || "").trim()) count++;
    return count;
  }, [presentAddress]);

  // Spiritual missing check
  const spiritualMissingCount = useMemo(() => {
    let count = 0;
    if (!spiritual.member_religion_id) count++;
    if (!spiritual.member_caste_id) count++;
    return count;
  }, [spiritual]);

  // Client-side validator before saving any section (only check true essentials)
  const validateSection = (sectionKey) => {
    const missing = {};
    const missingNames = [];

    switch (sectionKey) {
      case "basic": {
        if (!String(basicInfo.first_name || "").trim()) {
          missing.first_name = true;
          missingNames.push("First Name");
        }
        if (!String(basicInfo.gender || "").trim()) {
          missing.gender = true;
          missingNames.push("Gender");
        }
        break;
      }
      default:
        break;
    }

    const isValid = missingNames.length === 0;
    const errorMessage = isValid
      ? null
      : `${missingNames.join(", ")} is required to save.`;
    return { isValid, missing, missingNames, errorMessage };
  };

  // Fetch and populate profile and settings from server
  useEffect(() => {
    let isMounted = true;
    const userId = user?.id;
    if (!userId || !token) return;

    (async () => {
      setLoading(true);
      try {
        // Fetch profile settings (options) and user profile in parallel
        const [profileRes, settingsRes] = await Promise.allSettled([
          profileService.getMyProfile(userId, token),
          profileService.getProfileSettings(token),
        ]);

        if (
          isMounted &&
          settingsRes.status === "fulfilled" &&
          settingsRes.value
        ) {
          setServerSettings(settingsRes.value.data || settingsRes.value);
        }

        if (profileRes.status === "rejected") {
          console.log("Could not fetch profile:", profileRes.reason?.message);
        }

        if (
          isMounted &&
          profileRes.status === "fulfilled" &&
          profileRes.value?.data
        ) {
          const d = profileRes.value.data;

          // Option lists used to convert names from the API into ids
          const settings =
            settingsRes.status === "fulfilled" && settingsRes.value
              ? settingsRes.value.data || settingsRes.value
              : null;
          const lists = {
            countries: settings?.countries || [],
            states: settings?.states || [],
            cities: settings?.cities || [],
            religions: settings?.religions || [],
            castes: settings?.castes || [],
            subCastes: settings?.sub_castes || [],
            marital: settings?.marital_statuses?.length
              ? settings.marital_statuses
              : DEFAULT_MARITAL_STATUSES,
            onBehalf: settings?.on_behalves?.length
              ? settings.on_behalves
              : DEFAULT_ON_BEHALVES,
            familyValues: settings?.family_values?.length
              ? settings.family_values
              : DEFAULT_FAMILY_VALUES,
          };

          // Names that could not be matched to an option (logged once at the end)
          const unresolved = [];
          const resolve = (label, list, value) => {
            const id = resolveId(list, value);
            if (id === null && has(value)) {
              unresolved.push(
                `${label}: ${typeof value === "object" ? value.name : value}`,
              );
            }
            return id;
          };

          // Address from the API has names (country/state/city), the form uses ids
          const addressFields = (a) => {
            const out = {};
            const countryId = resolve(
              "country",
              lists.countries,
              a.country_id ?? a.country,
            );
            const statePool = countryId
              ? lists.states.filter(
                  (s) => String(s.country_id) === String(countryId),
                )
              : lists.states;
            const stateId = resolve(
              "state",
              statePool.length ? statePool : lists.states,
              a.state_id ?? a.state,
            );
            const cityPool = stateId
              ? lists.cities.filter(
                  (c) => String(c.state_id) === String(stateId),
                )
              : lists.cities;
            const cityId = resolve(
              "city",
              cityPool.length ? cityPool : lists.cities,
              a.city_id ?? a.city,
            );

            if (countryId !== null) out.country_id = countryId;
            if (stateId !== null) out.state_id = stateId;
            if (cityId !== null) out.city_id = cityId;
            if (has(a.postal_code)) out.postal_code = String(a.postal_code);
            return out;
          };

          // Profile Photo
          const photoFromApi =
            d.basic_info?.photo ||
            d.photo ||
            d.avatar ||
            settings?.member?.photo ||
            settings?.member?.avatar;
          if (photoFromApi) {
            setServerPhoto(photoFromApi);
          }

          // Introduction
          if (d.introduction || d.intoduction?.introduction) {
            setIntroduction(
              String(d.introduction || d.intoduction?.introduction || ""),
            );
          }

          // Basic Info
          if (d.basic_info) {
            const b = d.basic_info;
            const maritalId = resolve(
              "marital status",
              lists.marital,
              b.marital_status ?? b.maritial_status,
            );
            const onBehalfId = resolve(
              "on behalf",
              lists.onBehalf,
              b.on_behalf ?? b.onbehalf,
            );

            setBasicInfo((prev) => ({
              ...prev,
              first_name: b.first_name || b.firs_name || prev.first_name,
              last_name: b.last_name || prev.last_name,
              gender: b.gender || prev.gender,
              date_of_birth:
                b.date_of_birth || b.birthday || prev.date_of_birth,
              marital_status: maritalId ?? prev.marital_status,
              children: has(b.children)
                ? String(b.children)
                : has(b.no_of_children)
                  ? String(b.no_of_children)
                  : prev.children,
              on_behalf: onBehalfId ?? prev.on_behalf,
              phone: b.phone || d.contact_details?.phone || prev.phone,
              email: b.email || d.contact_details?.email || prev.email,
            }));
            if (b.code) {
              setMemberCode(String(b.code));
            }
          }

          // Contact
          if (d.contact_details) {
            setContactInfo((prev) => ({
              ...prev,
              email: d.contact_details.email || prev.email,
              phone: d.contact_details.phone || prev.phone,
            }));
          }

          // Present Address
          if (d.present_address) {
            const fields = addressFields(d.present_address);
            setPresentAddress((prev) => ({ ...prev, ...fields }));
          }

          // Permanent Address
          if (d.permanent_address) {
            const fields = addressFields(d.permanent_address);
            setPermanentAddress((prev) => ({ ...prev, ...fields }));
          }

          // Physical
          if (d.physical_attributes) {
            const p = d.physical_attributes;
            setPhysical((prev) => ({
              ...prev,
              height:
                p.height !== null && p.height !== undefined
                  ? String(p.height)
                  : prev.height || "",
              weight:
                p.weight !== null && p.weight !== undefined
                  ? String(p.weight)
                  : prev.weight || "",
              eye_color: p.eye_color || prev.eye_color,
              hair_color: p.hair_color || prev.hair_color,
              complexion: p.complexion || prev.complexion,
              blood_group: p.blood_group || prev.blood_group,
              body_type: p.body_type || prev.body_type,
              body_art: p.body_art || prev.body_art,
              disability: p.disability || prev.disability,
            }));
          }

          // Language
          if (
            d.mother_tongue ||
            d.known_languages ||
            d.basic_info?.mothere_tongue
          ) {
            setLanguage((prev) => ({
              ...prev,
              mothere_tongue:
                d.mother_tongue ||
                d.basic_info?.mothere_tongue ||
                prev.mothere_tongue,
              known_languages: d.known_languages || prev.known_languages,
            }));
          }

          // Hobbies
          if (d.hobbies_interest) {
            const h = d.hobbies_interest;
            setHobbies((prev) => ({
              ...prev,
              hobbies: h.hobbies || prev.hobbies,
              interests: h.interests || prev.interests,
              music: h.music || prev.music,
              books: h.books || prev.books,
              movies: h.movies || prev.movies,
              tv_shows: h.tv_shows || prev.tv_shows,
              sports: h.sports || prev.sports,
              fitness_activities:
                h.fitness_activities || prev.fitness_activities,
              cuisines: h.cuisines || prev.cuisines,
              dress_styles: h.dress_styles || prev.dress_styles,
            }));
          }

          // Attitude
          if (d.attitude_behavior) {
            const a = d.attitude_behavior;
            setAttitude((prev) => ({
              ...prev,
              affection: a.affection || prev.affection,
              humor: a.humor || prev.humor,
              political_views: a.political_views || prev.political_views,
              religious_service: a.religious_service || prev.religious_service,
            }));
          }

          // Residency
          if (d.residence_info) {
            const r = d.residence_info;
            setResidency((prev) => ({
              ...prev,
              birth_country_id: r.birth_country_id || prev.birth_country_id,
              recidency_country_id:
                r.recidency_country_id || prev.recidency_country_id,
              growup_country_id: r.growup_country_id || prev.growup_country_id,
              immigration_status:
                r.immigration_status || prev.immigration_status,
            }));
          }

          // Spiritual
          if (d.spiritual_background || d.spiritual_backgrounds) {
            const s = d.spiritual_background || d.spiritual_backgrounds;

            const religionId = resolve(
              "religion",
              lists.religions,
              s.member_religion_id ?? s.religion_id,
            );
            const castePool = religionId
              ? lists.castes.filter(
                  (c) => String(c.religion_id) === String(religionId),
                )
              : lists.castes;
            const casteId = resolve(
              "caste",
              castePool.length ? castePool : lists.castes,
              s.member_caste_id ?? s.caste_id,
            );
            const subPool = casteId
              ? lists.subCastes.filter(
                  (sc) => String(sc.caste_id) === String(casteId),
                )
              : lists.subCastes;
            const subCasteId = resolve(
              "sub-caste",
              subPool.length ? subPool : lists.subCastes,
              s.member_sub_caste_id ?? s.sub_caste_id,
            );
            const familyValueId = resolve(
              "family value",
              lists.familyValues,
              s.family_value_id,
            );

            setSpiritual((prev) => ({
              ...prev,
              member_religion_id: religionId ?? prev.member_religion_id,
              member_caste_id: casteId ?? prev.member_caste_id,
              member_sub_caste_id: subCasteId ?? prev.member_sub_caste_id,
              ethnicity: s.ethnicity || prev.ethnicity,
              personal_value: s.personal_value || prev.personal_value,
              family_value_id: familyValueId ?? prev.family_value_id,
              community_value: s.community_value || prev.community_value,
            }));
          }

          // Lifestyle
          if (d.lifestyles || d.lifestyle) {
            const l = d.lifestyles || d.lifestyle;
            setLifestyle((prev) => ({
              ...prev,
              diet: l.diet || prev.diet,
              drink: l.drink || prev.drink,
              smoke: l.smoke || prev.smoke,
              living_with: l.living_with || prev.living_with,
            }));
          }

          // Astronomic
          if (d.astrologies || d.astronomic) {
            const ast = d.astrologies || d.astronomic;
            setAstronomic((prev) => ({
              ...prev,
              sun_sign: ast.sun_sign || prev.sun_sign,
              moon_sign: ast.moon_sign || prev.moon_sign,
              time_of_birth: ast.time_of_birth || prev.time_of_birth,
              city_of_birth: ast.city_of_birth || prev.city_of_birth,
            }));
          }

          // Family
          if (d.families_information || d.family_info) {
            const fam = d.families_information || d.family_info;
            setFamily((prev) => ({
              ...prev,
              father: fam.father || prev.father,
              mother: fam.mother || prev.mother,
              sibling: fam.sibling || prev.sibling,
            }));
          }

          // Partner Expectation
          if (d.partner_expectation) {
            const pe = d.partner_expectation;
            setPartnerExpectation((prev) => ({
              ...prev,
              general: pe.general || prev.general,
              partner_height: pe.partner_height || prev.partner_height,
              partner_weight: pe.partner_weight || prev.partner_weight,
              partner_marital_status:
                pe.partner_marital_status || prev.partner_marital_status,
              partner_children_acceptable:
                pe.partner_children_acceptable ||
                prev.partner_children_acceptable,
              residence_country_id:
                pe.residence_country_id || prev.residence_country_id,
              partner_religion_id:
                pe.partner_religion_id || prev.partner_religion_id,
              partner_caste_id: pe.partner_caste_id || prev.partner_caste_id,
              partner_sub_caste_id:
                pe.partner_sub_caste_id || prev.partner_sub_caste_id,
              pertner_education: pe.pertner_education || prev.pertner_education,
              partner_profession:
                pe.partner_profession || prev.partner_profession,
              smoking_acceptable:
                pe.smoking_acceptable || prev.smoking_acceptable,
              drinking_acceptable:
                pe.drinking_acceptable || prev.drinking_acceptable,
              partner_diet: pe.partner_diet || prev.partner_diet,
              partner_body_type: pe.partner_body_type || prev.partner_body_type,
              partner_personal_value:
                pe.partner_personal_value || prev.partner_personal_value,
              partner_manglik: pe.partner_manglik || prev.partner_manglik,
              language_id: pe.language_id || prev.language_id,
              family_value_id: pe.family_value_id || prev.family_value_id,
              partner_country_id:
                pe.partner_country_id || prev.partner_country_id,
              partner_state_id: pe.partner_state_id || prev.partner_state_id,
              pertner_complexion:
                pe.pertner_complexion || prev.pertner_complexion,
            }));
          }

          if (unresolved.length) {
            console.log(
              "EditProfile: could not match to options ->",
              unresolved.join(" | "),
            );
          }
        }
      } catch (err) {
        console.log("Error loading profile details:", err?.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user?.id, token]);

  const toggleSection = (sectionKey) => {
    setExpandedSection((prev) => (prev === sectionKey ? null : sectionKey));
  };

  // Save individual section
  const handleSaveSection = async (sectionKey) => {
    if (!token) {
      Alert.alert("Notice", "You must be logged in to update your profile.");
      return;
    }

    // 1. Client-side validation check
    const validation = validateSection(sectionKey);
    if (!validation.isValid) {
      setMissingFields((prev) => ({
        ...prev,
        [sectionKey]: validation.missing,
      }));
      setSectionErrors((prev) => ({
        ...prev,
        [sectionKey]: validation.errorMessage,
      }));
      return;
    }

    // Clear any previous error for this section
    clearFieldError(sectionKey);

    setSavingSection(sectionKey);
    try {
      switch (sectionKey) {
        case "introduction": {
          await memberService.updateIntroduction({ introduction }, token);
          profileService.clearSettingsCache();
          Alert.alert("Success 🎉", "Introduction bio updated successfully!");
          break;
        }
        case "basic": {
          // Normalize marital_status & on_behalf to numeric ID
          const maritalId =
            Number(basicInfo.marital_status) ||
            maritalStatusList.find(
              (m) =>
                String(m.name).toLowerCase() ===
                String(basicInfo.marital_status).toLowerCase(),
            )?.id ||
            1;
          const onBehalfId =
            Number(basicInfo.on_behalf) ||
            onBehalfList.find(
              (o) =>
                String(o.name).toLowerCase() ===
                String(basicInfo.on_behalf).toLowerCase(),
            )?.id ||
            1;

          await memberService.updateBasicInfo(
            {
              first_name: basicInfo.first_name,
              firs_name: basicInfo.first_name,
              last_name: basicInfo.last_name,
              email: basicInfo.email || contactInfo.email,
              phone: basicInfo.phone || contactInfo.phone,
              gender: basicInfo.gender,
              on_behalf: onBehalfId,
              date_of_birth: basicInfo.date_of_birth,
              birthday: basicInfo.date_of_birth,
              marital_status: maritalId,
              maritial_status: maritalId,
              children: String(basicInfo.children || 0),
            },
            token,
          );

          profileService.clearSettingsCache();
          if (updateUser) {
            updateUser({
              name: `${basicInfo.first_name} ${basicInfo.last_name}`.trim(),
              gender: basicInfo.gender,
              phone: basicInfo.phone || contactInfo.phone,
              email: basicInfo.email || contactInfo.email,
            });
          }
          Alert.alert("Success 🎉", "Basic information updated successfully!");
          break;
        }
        case "contact": {
          await memberService.updateContactInfo(
            {
              email: contactInfo.email,
              phone: contactInfo.phone,
            },
            token,
          );
          profileService.clearSettingsCache();
          if (updateUser) {
            updateUser({
              email: contactInfo.email,
              phone: contactInfo.phone,
            });
          }
          Alert.alert("Success 🎉", "Contact details updated successfully!");
          break;
        }
        case "address": {
          const addr =
            addressType === "present" ? presentAddress : permanentAddress;
          await memberService.updateAddress(
            {
              country_id: addr.country_id || 1,
              state_id: addr.state_id || 1,
              city_id: addr.city_id || 1,
              postal_code: addr.postal_code || "110001",
              address_type: addressType,
            },
            token,
          );
          profileService.clearSettingsCache();
          Alert.alert(
            "Success 🎉",
            `${addressType === "present" ? "Present" : "Permanent"} address updated successfully!`,
          );
          break;
        }
        case "physical": {
          const cleanH =
            parseFloat(String(physical.height).replace(/[^\d.]/g, "")) || 5.8;
          const cleanW =
            parseFloat(String(physical.weight).replace(/[^\d.]/g, "")) || 65;
          await memberService.updatePhysicalAttributes(
            {
              height: cleanH,
              weight: cleanW,
              eye_color: physical.eye_color || "",
              hair_color: physical.hair_color || "",
              complexion: physical.complexion || "",
              blood_group: physical.blood_group || "",
              body_type: physical.body_type || "",
              body_art: physical.body_art || "",
              disability: physical.disability || "",
            },
            token,
          );
          profileService.clearSettingsCache();
          Alert.alert(
            "Success 🎉",
            "Physical attributes updated successfully!",
          );
          break;
        }
        case "language": {
          await memberService.updateLanguage(
            {
              mothere_tongue: language.mothere_tongue || "",
              mother_tongue: language.mothere_tongue || "",
              known_languages: language.known_languages || "",
            },
            token,
          );
          profileService.clearSettingsCache();
          Alert.alert("Success 🎉", "Language details updated successfully!");
          break;
        }
        case "hobbies": {
          await memberService.updateHobbies(hobbies, token);
          profileService.clearSettingsCache();
          Alert.alert(
            "Success 🎉",
            "Hobbies and interests updated successfully!",
          );
          break;
        }
        case "attitude": {
          await memberService.updateAttitudeBehavior(attitude, token);
          profileService.clearSettingsCache();
          Alert.alert(
            "Success 🎉",
            "Attitude and behavior updated successfully!",
          );
          break;
        }
        case "residency": {
          await memberService.updateResidencyInfo(
            {
              birth_country_id: residency.birth_country_id || 1,
              recidency_country_id:
                residency.recidency_country_id ||
                residency.residency_country_id ||
                1,
              residency_country_id:
                residency.recidency_country_id ||
                residency.residency_country_id ||
                1,
              growup_country_id: residency.growup_country_id || 1,
              grow_up_country_id: residency.growup_country_id || 1,
              immigration_status: residency.immigration_status || "",
            },
            token,
          );
          profileService.clearSettingsCache();
          Alert.alert("Success 🎉", "Residency details updated successfully!");
          break;
        }
        case "spiritual": {
          const relId =
            spiritual.member_religion_id || spiritual.religion_id || 1;
          const casId = spiritual.member_caste_id || spiritual.caste_id || 1;
          const subId =
            spiritual.member_sub_caste_id || spiritual.sub_caste_id || null;
          const famValId = spiritual.family_value_id || 1;
          await memberService.updateSpiritualBackground(
            {
              member_religion_id: relId,
              religion_id: relId,
              member_caste_id: casId,
              caste_id: casId,
              member_sub_caste_id: subId,
              sub_caste_id: subId,
              ethnicity: spiritual.ethnicity || "",
              personal_value: spiritual.personal_value || "",
              family_value_id: famValId,
              community_value: spiritual.community_value || "",
            },
            token,
          );
          profileService.clearSettingsCache();
          Alert.alert(
            "Success 🎉",
            "Spiritual background updated successfully!",
          );
          break;
        }
        case "lifestyle": {
          await memberService.updateLifestyle(
            {
              diet: lifestyle.diet || "",
              drink: lifestyle.drink || "",
              smoke: lifestyle.smoke || "",
              living_with: lifestyle.living_with || "",
            },
            token,
          );
          profileService.clearSettingsCache();
          Alert.alert("Success 🎉", "Lifestyle updated successfully!");
          break;
        }
        case "astronomic": {
          await memberService.updateAstronomic(
            {
              sun_sign: astronomic.sun_sign || "",
              moon_sign: astronomic.moon_sign || "",
              time_of_birth: astronomic.time_of_birth || "",
              city_of_birth: astronomic.city_of_birth || "",
            },
            token,
          );
          profileService.clearSettingsCache();
          Alert.alert(
            "Success 🎉",
            "Astronomic / horoscope details updated successfully!",
          );
          break;
        }
        case "family": {
          await memberService.updateFamilyInfo(
            {
              father: family.father || "",
              mother: family.mother || "",
              sibling: family.sibling || "",
              siblings: family.sibling || "",
            },
            token,
          );
          profileService.clearSettingsCache();
          Alert.alert("Success 🎉", "Family information updated successfully!");
          break;
        }
        case "partner": {
          const partnerPayload = {
            ...partnerExpectation,
            general:
              partnerExpectation.general ||
              "Looking for a caring, understanding partner",
            residence_country_id:
              Number(partnerExpectation.residence_country_id) ||
              Number(partnerExpectation.partner_country_id) ||
              Number(presentAddress.country_id) ||
              1,
            partner_country_id:
              Number(partnerExpectation.partner_country_id) ||
              Number(partnerExpectation.residence_country_id) ||
              Number(presentAddress.country_id) ||
              1,
            partner_state_id:
              Number(partnerExpectation.partner_state_id) ||
              Number(presentAddress.state_id) ||
              1,
            partner_religion_id:
              Number(partnerExpectation.partner_religion_id) ||
              Number(spiritual.member_religion_id) ||
              1,
            partner_caste_id:
              Number(partnerExpectation.partner_caste_id) ||
              Number(spiritual.member_caste_id) ||
              1,
            partner_sub_caste_id:
              Number(partnerExpectation.partner_sub_caste_id) ||
              Number(spiritual.member_sub_caste_id) ||
              1,
            partner_marital_status:
              Number(partnerExpectation.partner_marital_status) || 1,
            language_id: Number(partnerExpectation.language_id) || 1,
            family_value_id:
              Number(partnerExpectation.family_value_id) ||
              Number(spiritual.family_value_id) ||
              1,
            pertner_education:
              partnerExpectation.pertner_education ||
              partnerExpectation.partner_education ||
              "Graduate",
            partner_education:
              partnerExpectation.pertner_education ||
              partnerExpectation.partner_education ||
              "Graduate",
            pertner_complexion:
              partnerExpectation.pertner_complexion ||
              partnerExpectation.partner_complexion ||
              "Fair",
            partner_complexion:
              partnerExpectation.pertner_complexion ||
              partnerExpectation.partner_complexion ||
              "Fair",
            partner_height: partnerExpectation.partner_height || "5.6",
            partner_weight: partnerExpectation.partner_weight || "60",
          };
          await memberService.updatePartnerExpectation(partnerPayload, token);
          profileService.clearSettingsCache();
          Alert.alert(
            "Success 🎉",
            "Partner expectations updated successfully!",
          );
          break;
        }
        default:
          break;
      }

      emitMemberAction({ type: "profile_updated" });
    } catch (err) {
      // Transform any 500 or technical server error into clean, actionable field-level message
      let friendly = err?.message || "";
      const lower = friendly.toLowerCase();
      if (
        !friendly ||
        lower.includes("server error") ||
        lower.includes("500") ||
        lower.includes("request failed with status")
      ) {
        const recheck = validateSection(sectionKey);
        if (!recheck.isValid) {
          friendly = recheck.errorMessage;
          setMissingFields((prev) => ({
            ...prev,
            [sectionKey]: recheck.missing,
          }));
        } else {
          friendly =
            "Unable to save details. Please verify your entries and try again.";
        }
      }
      setSectionErrors((prev) => ({ ...prev, [sectionKey]: friendly }));
    } finally {
      setSavingSection(null);
    }
  };

  // Prompt photo picker for avatar update
  const promptProfilePhoto = () => {
    Alert.alert(
      "Update Profile Photo 📷",
      "Choose a new picture for your profile:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Take Photo (Camera)",
          onPress: async () => {
            try {
              const { status } =
                await ImagePicker.requestCameraPermissionsAsync();
              if (status !== "granted") {
                Alert.alert(
                  "Permission Required",
                  "Camera access is needed to take a profile picture.",
                );
                return;
              }
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });
              if (!res.canceled && res.assets?.[0]) {
                handleUploadAvatar(res.assets[0]);
              }
            } catch (err) {
              Alert.alert("Error", err?.message || "Could not open camera.");
            }
          },
        },
        {
          text: "Choose from Library",
          onPress: async () => {
            try {
              const { status } =
                await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== "granted") {
                Alert.alert(
                  "Permission Required",
                  "Photo library access is needed to choose a profile picture.",
                );
                return;
              }
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });
              if (!res.canceled && res.assets?.[0]) {
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

  const handleUploadAvatar = async (asset) => {
    if (!token) return;
    setUploadingAvatar(true);
    try {
      setLocalAvatar(asset.uri);
      setAvatarError(false);
      if (updateUser) {
        updateUser({ avatar: asset.uri, avatar_original: asset.uri });
      }

      const response = await memberService.uploadProfilePhoto(
        asset,
        {
          first_name: basicInfo.first_name,
          last_name: basicInfo.last_name,
          email: contactInfo.email || basicInfo.email,
          phone: contactInfo.phone || basicInfo.phone,
          gender: basicInfo.gender,
          date_of_birth: basicInfo.date_of_birth,
          on_behalf: basicInfo.on_behalf,
          marital_status: basicInfo.marital_status,
        },
        token,
      );

      const serverUrl = response?.data?.photo || response?.photo || asset.uri;
      setLocalAvatar(serverUrl);
      setServerPhoto(serverUrl);
      setAvatarError(false);
      if (updateUser) {
        updateUser({ avatar: serverUrl, avatar_original: serverUrl });
      }
      emitMemberAction({ type: "profile_updated", photo: serverUrl });
      Alert.alert("Success 🎉", "Profile photo updated successfully!");
    } catch (err) {
      console.log("EditProfile avatar upload error:", err?.message);
      Alert.alert(
        "Upload Notice",
        err?.message || "Profile photo updated locally.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveCurrent = () => {
    handleSaveSection(expandedSection || "basic");
  };

  const fullName =
    `${basicInfo.first_name} ${basicInfo.last_name}`.trim() ||
    user?.name ||
    "Member Profile";
  const userEmail = contactInfo.email || basicInfo.email || user?.email || "";
  const userPhone = contactInfo.phone || basicInfo.phone || user?.phone || "";
  const userAvatar =
    localAvatar ||
    serverPhoto ||
    user?.avatar_original ||
    user?.avatar ||
    user?.photo ||
    DEFAULT_AVATAR;
  const hasPhoto =
    Boolean(userAvatar) &&
    !String(userAvatar).includes("avatar-place") &&
    userAvatar !== DEFAULT_AVATAR;

  // Profile completeness (simple checklist)
  const completionChecks = [
    hasPhoto,
    Boolean(String(introduction || "").trim()),
    basicMissingFields.length === 0,
    Boolean(contactInfo.phone && contactInfo.email),
    addressMissingCount === 0,
    Boolean(physical.height && physical.weight),
    Boolean(language.mothere_tongue),
    spiritualMissingCount === 0,
    Boolean(lifestyle.diet),
    Boolean(family.father || family.mother || family.sibling),
    Boolean(hobbies.hobbies),
    Boolean(partnerExpectation.general),
  ];
  const completionPct = Math.round(
    (completionChecks.filter(Boolean).length / completionChecks.length) * 100,
  );

  const doneOrEmpty = (
    isDone,
    doneText = "Completed",
    emptyText = "Not added",
  ) =>
    isDone
      ? { kind: "done", text: doneText }
      : { kind: "empty", text: emptyText };

  const activeAddr =
    addressType === "present" ? presentAddress : permanentAddress;
  const setActiveAddr =
    addressType === "present" ? setPresentAddress : setPermanentAddress;
  const filteredStates = stateList.filter(
    (s) =>
      !activeAddr.country_id ||
      String(s.country_id) === String(activeAddr.country_id),
  );
  const filteredCities = cityList.filter(
    (c) =>
      !activeAddr.state_id ||
      String(c.state_id) === String(activeAddr.state_id),
  );
  const filteredCastes = casteList.filter(
    (c) =>
      !spiritual.member_religion_id ||
      String(c.religion_id) === String(spiritual.member_religion_id),
  );
  const filteredSubCastes = subCasteList.filter(
    (sc) =>
      !spiritual.member_caste_id ||
      String(sc.caste_id) === String(spiritual.member_caste_id),
  );

  const spiritualSubtitle = spiritual.member_religion_id
    ? `${getOptionName(religionList, spiritual.member_religion_id, "Religion")}${
        spiritual.member_caste_id
          ? ` • ${getOptionName(casteList, spiritual.member_caste_id, "")}`
          : ""
      }`
    : "Religion, caste & values";

  const lifestyleSubtitle =
    lifestyle.diet || lifestyle.living_with
      ? [
          lifestyle.diet,
          lifestyle.living_with ? `Living with ${lifestyle.living_with}` : "",
        ]
          .filter(Boolean)
          .join(", ")
      : "Diet, drink, smoke & living";

  const astroSubtitle =
    astronomic.sun_sign || astronomic.moon_sign
      ? [astronomic.sun_sign, astronomic.moon_sign].filter(Boolean).join(" • ")
      : "Sun sign, moon sign & birth time";

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <ScreenHeader
        title="Edit Profile"
        subtitle="Complete your details"
        showBack
        onBack={handleBack}
        onBackPress={handleBack}
        onPressBack={handleBack}
        rightElement={
          <TouchableOpacity
            style={[
              styles.headerSaveBtn,
              Boolean(savingSection) && styles.disabled,
            ]}
            onPress={handleSaveCurrent}
            disabled={Boolean(savingSection)}
            activeOpacity={0.85}
          >
            {savingSection ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.headerSaveText}>Save</Text>
            )}
          </TouchableOpacity>
        }
      />

      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ------------------------------ Hero card ------------------------------ */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.avatarWrap}>
              {userAvatar && !avatarError ? (
                <Image
                  source={{ uri: userAvatar }}
                  style={styles.avatarImg}
                  resizeMode="cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <View style={[styles.avatarImg, styles.avatarFallback]}>
                  <Ionicons name="person" size={28} color={COLORS.primary} />
                </View>
              )}
              {uploadingAvatar ? (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.cameraBadge}
                  onPress={promptProfilePhoto}
                  activeOpacity={0.85}
                >
                  <Ionicons name="camera" size={12} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.heroInfo}>
              <Text style={styles.heroName} numberOfLines={1}>
                {fullName}
              </Text>
              {userEmail ? (
                <View style={styles.heroLine}>
                  <Ionicons
                    name="mail-outline"
                    size={14}
                    color={COLORS.textLight}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.heroLineText} numberOfLines={1}>
                    {userEmail}
                  </Text>
                </View>
              ) : null}
              {userPhone ? (
                <View style={styles.heroLine}>
                  <Ionicons
                    name="call-outline"
                    size={14}
                    color={COLORS.textLight}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.heroLineText} numberOfLines={1}>
                    {userPhone}
                  </Text>
                </View>
              ) : null}
              {memberCode ? (
                <View style={styles.idPill}>
                  <Text style={styles.idPillText}>ID: {memberCode}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={styles.changePhotoRow}
            onPress={promptProfilePhoto}
            disabled={uploadingAvatar}
            activeOpacity={0.8}
          >
            <Ionicons
              name="image-outline"
              size={16}
              color={COLORS.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.changePhotoText}>
              {uploadingAvatar
                ? "Uploading..."
                : hasPhoto
                  ? "Change profile photo"
                  : "Upload profile photo"}
            </Text>
          </TouchableOpacity>

          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Profile completeness</Text>
              <Text style={styles.progressPct}>{completionPct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${completionPct}%` }]}
              />
            </View>
            <Text style={styles.progressHint}>
              {completionPct === 100
                ? "Great job! Your profile is complete."
                : "Complete profiles get far more interest from matches."}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBanner}>
            <ActivityIndicator
              size="small"
              color={COLORS.primary}
              style={{ marginRight: 10 }}
            />
            <Text style={styles.loadingBannerText}>
              Loading your profile...
            </Text>
          </View>
        ) : null}

        <Text style={styles.listHeading}>Your details</Text>

        {/* ------------------------------ Introduction ------------------------------ */}
        <SectionCard
          icon="create-outline"
          iconColor={COLORS.primary}
          iconBg="#FFF0F5"
          title="About Me"
          subtitle={
            introduction
              ? `${introduction.length} characters`
              : "Write a short bio"
          }
          badge={doneOrEmpty(Boolean(introduction), "Filled", "Not added")}
          expanded={expandedSection === "introduction"}
          onToggle={() => toggleSection("introduction")}
        >
          <ErrorBanner message={sectionErrors.introduction} />
          <Field
            label="Introduction bio"
            multiline
            numberOfLines={5}
            value={introduction}
            onChangeText={(t) => {
              clearFieldError("introduction", "introduction");
              setIntroduction(t);
            }}
            placeholder="Tell prospective matches about your personality, background, and what you are looking for..."
            missing={isFieldMissing("introduction", "introduction")}
            missingText="Introduction bio is missing"
          />
          <SaveButton
            label="Save Introduction"
            saving={savingSection === "introduction"}
            onPress={() => handleSaveSection("introduction")}
          />
        </SectionCard>

        {/* ------------------------------ Basic ------------------------------ */}
        <SectionCard
          icon="person-outline"
          iconColor={COLORS.primary}
          iconBg="#FFE8EE"
          title="Basic Information"
          subtitle="Name, DOB, gender, marital status"
          badge={
            basicMissingFields.length > 0
              ? {
                  kind: "missing",
                  text: `${basicMissingFields.length} missing`,
                }
              : { kind: "done", text: "Completed" }
          }
          expanded={expandedSection === "basic"}
          onToggle={() => toggleSection("basic")}
        >
          <ErrorBanner message={sectionErrors.basic} />

          {basicMissingFields.length > 0 && !sectionErrors.basic ? (
            <View style={styles.hintBanner}>
              <Ionicons
                name="information-circle"
                size={18}
                color="#B45309"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.hintBannerText}>
                Missing: {basicMissingFields.map((f) => f.label).join(", ")}
              </Text>
            </View>
          ) : null}

          <Row>
            <Col>
              <Field
                label="First name"
                required
                value={basicInfo.first_name}
                onChangeText={(t) => {
                  clearFieldError("basic", "first_name");
                  setBasicInfo((p) => ({ ...p, first_name: t }));
                }}
                placeholder="First name"
                missing={
                  !basicInfo.first_name || isFieldMissing("basic", "first_name")
                }
                missingText="First name is missing"
              />
            </Col>
            <Col>
              <Field
                label="Last name"
                value={basicInfo.last_name}
                onChangeText={(t) =>
                  setBasicInfo((p) => ({ ...p, last_name: t }))
                }
                placeholder="Last name"
              />
            </Col>
          </Row>

          <ChipGroup
            label="Gender *"
            segmented
            options={GENDER_OPTIONS}
            value={basicInfo.gender}
            onChange={(g) => {
              clearFieldError("basic", "gender");
              setBasicInfo((p) => ({ ...p, gender: g }));
            }}
          />

          <Field
            label="Date of birth (YYYY-MM-DD)"
            required
            value={basicInfo.date_of_birth}
            onChangeText={(t) => {
              clearFieldError("basic", "date_of_birth");
              setBasicInfo((p) => ({ ...p, date_of_birth: t }));
            }}
            placeholder="e.g. 1995-05-15"
            missing={
              !basicInfo.date_of_birth ||
              isFieldMissing("basic", "date_of_birth")
            }
            missingText="Date of birth is missing"
          />

          <SelectField
            label="Marital status"
            required
            value={
              basicInfo.marital_status
                ? getOptionName(maritalStatusList, basicInfo.marital_status, "")
                : ""
            }
            placeholder="Select marital status"
            missing={
              !basicInfo.marital_status ||
              isFieldMissing("basic", "marital_status")
            }
            missingText="Marital status is missing"
            onPress={() =>
              openPicker(
                "Select Marital Status",
                maritalStatusList,
                basicInfo.marital_status,
                (item) => {
                  clearFieldError("basic", "marital_status");
                  setBasicInfo((p) => ({ ...p, marital_status: item.id }));
                },
              )
            }
          />

          <SelectField
            label="Profile created by"
            required
            value={
              basicInfo.on_behalf
                ? getOptionName(onBehalfList, basicInfo.on_behalf, "")
                : ""
            }
            placeholder="Select who created this profile"
            missing={
              !basicInfo.on_behalf || isFieldMissing("basic", "on_behalf")
            }
            missingText="Profile created by is missing"
            onPress={() =>
              openPicker(
                "Select Profile Created For",
                onBehalfList,
                basicInfo.on_behalf,
                (item) => {
                  clearFieldError("basic", "on_behalf");
                  setBasicInfo((p) => ({ ...p, on_behalf: item.id }));
                },
              )
            }
          />

          <Field
            label="Number of children"
            value={String(basicInfo.children || "")}
            onChangeText={(t) => setBasicInfo((p) => ({ ...p, children: t }))}
            placeholder="0"
            keyboardType="numeric"
          />

          <SaveButton
            label="Save Basic Info"
            saving={savingSection === "basic"}
            onPress={() => handleSaveSection("basic")}
          />
        </SectionCard>

        {/* ------------------------------ Contact ------------------------------ */}
        <SectionCard
          icon="call-outline"
          iconColor="#059669"
          iconBg="#E7F7EF"
          title="Contact Information"
          subtitle="Phone & email address"
          badge={doneOrEmpty(
            Boolean(contactInfo.phone && contactInfo.email),
            "Complete",
            "Incomplete",
          )}
          expanded={expandedSection === "contact"}
          onToggle={() => toggleSection("contact")}
        >
          <ErrorBanner message={sectionErrors.contact} />
          <Field
            label="Phone number"
            value={contactInfo.phone}
            onChangeText={(t) => {
              clearFieldError("contact", "phone");
              setContactInfo((p) => ({ ...p, phone: t }));
            }}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            missing={isFieldMissing("contact", "phone")}
            missingText="Phone number is missing"
          />
          <Field
            label="Email address"
            value={contactInfo.email}
            onChangeText={(t) => {
              clearFieldError("contact", "email");
              setContactInfo((p) => ({ ...p, email: t }));
            }}
            placeholder="Enter email address"
            keyboardType="email-address"
            autoCapitalize="none"
            missing={isFieldMissing("contact", "email")}
            missingText="Email address is missing"
          />
          <SaveButton
            label="Save Contact Info"
            saving={savingSection === "contact"}
            onPress={() => handleSaveSection("contact")}
          />
        </SectionCard>

        {/* ------------------------------ Address ------------------------------ */}
        <SectionCard
          icon="location-outline"
          iconColor="#2563EB"
          iconBg="#EAF2FF"
          title="Address Details"
          subtitle="Present & permanent address"
          badge={
            addressMissingCount > 0
              ? { kind: "missing", text: `${addressMissingCount} missing` }
              : { kind: "done", text: "Filled" }
          }
          expanded={expandedSection === "address"}
          onToggle={() => toggleSection("address")}
        >
          <ErrorBanner message={sectionErrors.address} />

          <View style={styles.segmentWrap}>
            {[
              { key: "present", label: "Present" },
              { key: "permanent", label: "Permanent" },
            ].map((tab) => {
              const active = addressType === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  onPress={() => setAddressType(tab.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      active && styles.segmentTextActive,
                    ]}
                  >
                    {tab.label} address
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <SelectField
            label="Country"
            required
            value={
              activeAddr.country_id
                ? getOptionName(countryList, activeAddr.country_id, "")
                : ""
            }
            placeholder="Select country"
            missing={isFieldMissing("address", "country_id")}
            missingText="Country is missing"
            onPress={() =>
              openPicker(
                "Select Country",
                countryList,
                activeAddr.country_id,
                (item) => {
                  clearFieldError("address", "country_id");
                  setActiveAddr((p) => ({
                    ...p,
                    country_id: item.id,
                    state_id: null,
                    city_id: null,
                  }));
                },
              )
            }
          />

          <Row>
            <Col>
              <SelectField
                label="State"
                required
                value={
                  activeAddr.state_id
                    ? getOptionName(stateList, activeAddr.state_id, "")
                    : ""
                }
                placeholder="Select state"
                missing={isFieldMissing("address", "state_id")}
                missingText="State is missing"
                onPress={() =>
                  openPicker(
                    "Select State",
                    filteredStates.length ? filteredStates : stateList,
                    activeAddr.state_id,
                    (item) => {
                      clearFieldError("address", "state_id");
                      setActiveAddr((p) => ({
                        ...p,
                        state_id: item.id,
                        city_id: null,
                      }));
                    },
                  )
                }
              />
            </Col>
            <Col>
              <SelectField
                label="City"
                required
                value={
                  activeAddr.city_id
                    ? getOptionName(cityList, activeAddr.city_id, "")
                    : ""
                }
                placeholder="Select city"
                missing={isFieldMissing("address", "city_id")}
                missingText="City is missing"
                onPress={() =>
                  openPicker(
                    "Select City",
                    filteredCities.length ? filteredCities : cityList,
                    activeAddr.city_id,
                    (item) => {
                      clearFieldError("address", "city_id");
                      setActiveAddr((p) => ({ ...p, city_id: item.id }));
                    },
                  )
                }
              />
            </Col>
          </Row>

          <Field
            label="Postal / PIN code"
            required
            value={activeAddr.postal_code}
            onChangeText={(t) => {
              clearFieldError("address", "postal_code");
              setActiveAddr((p) => ({ ...p, postal_code: t }));
            }}
            placeholder="e.g. 110001"
            keyboardType="numeric"
            missing={
              !activeAddr.postal_code ||
              isFieldMissing("address", "postal_code")
            }
            missingText="PIN code is missing"
          />

          <SaveButton
            label={`Save ${addressType === "present" ? "Present" : "Permanent"} Address`}
            saving={savingSection === "address"}
            onPress={() => handleSaveSection("address")}
          />
        </SectionCard>

        {/* ------------------------------ Physical ------------------------------ */}
        <SectionCard
          icon="body-outline"
          iconColor="#A855F7"
          iconBg="#F6ECFF"
          title="Physical Attributes"
          subtitle={
            physical.height && physical.weight
              ? `${physical.height} ft • ${physical.weight} kg`
              : "Height, weight & body type"
          }
          badge={doneOrEmpty(
            Boolean(physical.height && physical.weight),
            "Filled",
            "Not added",
          )}
          expanded={expandedSection === "physical"}
          onToggle={() => toggleSection("physical")}
        >
          <ErrorBanner message={sectionErrors.physical} />

          <Row>
            <Col>
              <Field
                label="Height (ft)"
                required
                value={String(physical.height)}
                onChangeText={(t) => {
                  clearFieldError("physical", "height");
                  setPhysical((p) => ({ ...p, height: t }));
                }}
                placeholder="5.8"
                keyboardType="decimal-pad"
                missing={
                  !physical.height || isFieldMissing("physical", "height")
                }
                missingText="Height is missing"
              />
            </Col>
            <Col>
              <Field
                label="Weight (kg)"
                required
                value={String(physical.weight)}
                onChangeText={(t) => {
                  clearFieldError("physical", "weight");
                  setPhysical((p) => ({ ...p, weight: t }));
                }}
                placeholder="65"
                keyboardType="decimal-pad"
                missing={
                  !physical.weight || isFieldMissing("physical", "weight")
                }
                missingText="Weight is missing"
              />
            </Col>
          </Row>

          <ChipGroup
            label="Blood group"
            options={BLOOD_GROUPS}
            value={physical.blood_group}
            onChange={(v) => setPhysical((p) => ({ ...p, blood_group: v }))}
          />
          <ChipGroup
            label="Complexion"
            options={COMPLEXIONS}
            value={physical.complexion}
            onChange={(v) => setPhysical((p) => ({ ...p, complexion: v }))}
          />
          <ChipGroup
            label="Body type"
            options={BODY_TYPES}
            value={physical.body_type}
            onChange={(v) => setPhysical((p) => ({ ...p, body_type: v }))}
          />

          <SaveButton
            label="Save Physical Attributes"
            saving={savingSection === "physical"}
            onPress={() => handleSaveSection("physical")}
          />
        </SectionCard>

        {/* ------------------------------ Language ------------------------------ */}
        <SectionCard
          icon="chatbubbles-outline"
          iconColor="#D97706"
          iconBg="#FEF3C7"
          title="Language Details"
          subtitle={
            language.mothere_tongue || "Mother tongue & known languages"
          }
          badge={doneOrEmpty(
            Boolean(language.mothere_tongue),
            "Filled",
            "Not added",
          )}
          expanded={expandedSection === "language"}
          onToggle={() => toggleSection("language")}
        >
          <ErrorBanner message={sectionErrors.language} />

          {languageList.length > 0 ? (
            <SelectField
              label="Mother tongue"
              required
              value={language.mothere_tongue}
              placeholder="Select mother tongue"
              missing={
                !language.mothere_tongue ||
                isFieldMissing("language", "mothere_tongue")
              }
              missingText="Mother tongue is missing"
              onPress={() =>
                openPicker(
                  "Select Mother Tongue",
                  languageList,
                  language.mothere_tongue,
                  (item) => {
                    clearFieldError("language", "mothere_tongue");
                    setLanguage((p) => ({ ...p, mothere_tongue: item.name }));
                  },
                )
              }
            />
          ) : (
            <Field
              label="Mother tongue"
              required
              value={language.mothere_tongue}
              onChangeText={(t) => {
                clearFieldError("language", "mothere_tongue");
                setLanguage((p) => ({ ...p, mothere_tongue: t }));
              }}
              placeholder="e.g. Hindi, Tamil, Bengali"
              missing={
                !language.mothere_tongue ||
                isFieldMissing("language", "mothere_tongue")
              }
              missingText="Mother tongue is missing"
            />
          )}

          <Field
            label="Known languages"
            required
            value={language.known_languages}
            onChangeText={(t) => {
              clearFieldError("language", "known_languages");
              setLanguage((p) => ({ ...p, known_languages: t }));
            }}
            placeholder="e.g. English, Hindi, Gujarati"
            missing={
              !language.known_languages ||
              isFieldMissing("language", "known_languages")
            }
            missingText="Known languages are missing"
          />

          <SaveButton
            label="Save Language Details"
            saving={savingSection === "language"}
            onPress={() => handleSaveSection("language")}
          />
        </SectionCard>

        {/* ------------------------------ Spiritual ------------------------------ */}
        <SectionCard
          icon="flower-outline"
          iconColor="#EA580C"
          iconBg="#FFF1E5"
          title="Spiritual & Community"
          subtitle={spiritualSubtitle}
          badge={
            spiritualMissingCount > 0
              ? { kind: "missing", text: `${spiritualMissingCount} missing` }
              : { kind: "done", text: "Filled" }
          }
          expanded={expandedSection === "spiritual"}
          onToggle={() => toggleSection("spiritual")}
        >
          <ErrorBanner message={sectionErrors.spiritual} />

          <SelectField
            label="Religion"
            required
            value={
              spiritual.member_religion_id
                ? getOptionName(religionList, spiritual.member_religion_id, "")
                : ""
            }
            placeholder="Select religion"
            missing={
              !spiritual.member_religion_id ||
              isFieldMissing("spiritual", "member_religion_id")
            }
            missingText="Religion is missing"
            onPress={() =>
              openPicker(
                "Select Religion",
                religionList,
                spiritual.member_religion_id,
                (item) => {
                  clearFieldError("spiritual", "member_religion_id");
                  setSpiritual((p) => ({
                    ...p,
                    member_religion_id: item.id,
                    member_caste_id: null,
                    member_sub_caste_id: null,
                  }));
                },
              )
            }
          />

          <Row>
            <Col>
              <SelectField
                label="Caste"
                required
                value={
                  spiritual.member_caste_id
                    ? getOptionName(casteList, spiritual.member_caste_id, "")
                    : ""
                }
                placeholder="Select caste"
                missing={
                  !spiritual.member_caste_id ||
                  isFieldMissing("spiritual", "member_caste_id")
                }
                missingText="Caste is missing"
                onPress={() =>
                  openPicker(
                    "Select Caste",
                    filteredCastes.length ? filteredCastes : casteList,
                    spiritual.member_caste_id,
                    (item) => {
                      clearFieldError("spiritual", "member_caste_id");
                      setSpiritual((p) => ({
                        ...p,
                        member_caste_id: item.id,
                        member_sub_caste_id: null,
                      }));
                    },
                  )
                }
              />
            </Col>
            <Col>
              <SelectField
                label="Sub-caste"
                value={
                  spiritual.member_sub_caste_id
                    ? getOptionName(
                        subCasteList,
                        spiritual.member_sub_caste_id,
                        "",
                      )
                    : ""
                }
                placeholder="Optional"
                onPress={() =>
                  openPicker(
                    "Select Sub-Caste",
                    filteredSubCastes.length ? filteredSubCastes : subCasteList,
                    spiritual.member_sub_caste_id,
                    (item) =>
                      setSpiritual((p) => ({
                        ...p,
                        member_sub_caste_id: item.id,
                      })),
                  )
                }
              />
            </Col>
          </Row>

          <SelectField
            label="Family value"
            value={
              spiritual.family_value_id
                ? getOptionName(familyValueList, spiritual.family_value_id, "")
                : ""
            }
            placeholder="Select family value"
            onPress={() =>
              openPicker(
                "Select Family Value",
                familyValueList,
                spiritual.family_value_id,
                (item) =>
                  setSpiritual((p) => ({ ...p, family_value_id: item.id })),
              )
            }
          />

          <Field
            label="Ethnicity"
            value={spiritual.ethnicity}
            onChangeText={(t) => setSpiritual((p) => ({ ...p, ethnicity: t }))}
            placeholder="e.g. Asian, Indian"
          />

          <ChipGroup
            label="Personal values"
            segmented
            options={PERSONAL_VALUES}
            value={spiritual.personal_value}
            onChange={(v) => setSpiritual((p) => ({ ...p, personal_value: v }))}
          />

          <SaveButton
            label="Save Spiritual Background"
            saving={savingSection === "spiritual"}
            onPress={() => handleSaveSection("spiritual")}
          />
        </SectionCard>

        {/* ------------------------------ Lifestyle ------------------------------ */}
        <SectionCard
          icon="cafe-outline"
          iconColor="#0D9488"
          iconBg="#E6F8F5"
          title="Lifestyle & Habits"
          subtitle={lifestyleSubtitle}
          badge={doneOrEmpty(Boolean(lifestyle.diet), "Filled", "Not added")}
          expanded={expandedSection === "lifestyle"}
          onToggle={() => toggleSection("lifestyle")}
        >
          <ErrorBanner message={sectionErrors.lifestyle} />

          <ChipGroup
            label="Diet preference"
            options={DIETS}
            value={lifestyle.diet}
            onChange={(v) => setLifestyle((p) => ({ ...p, diet: v }))}
          />
          <ChipGroup
            label="Drinking"
            segmented
            options={HABIT_OPTIONS}
            value={lifestyle.drink}
            onChange={(v) => setLifestyle((p) => ({ ...p, drink: v }))}
          />
          <ChipGroup
            label="Smoking"
            segmented
            options={HABIT_OPTIONS}
            value={lifestyle.smoke}
            onChange={(v) => setLifestyle((p) => ({ ...p, smoke: v }))}
          />
          <ChipGroup
            label="Living with"
            segmented
            options={LIVING_WITH}
            value={lifestyle.living_with}
            onChange={(v) => setLifestyle((p) => ({ ...p, living_with: v }))}
          />

          <SaveButton
            label="Save Lifestyle"
            saving={savingSection === "lifestyle"}
            onPress={() => handleSaveSection("lifestyle")}
          />
        </SectionCard>

        {/* ------------------------------ Astronomic ------------------------------ */}
        <SectionCard
          icon="planet-outline"
          iconColor="#7C3AED"
          iconBg="#F1EBFF"
          title="Horoscope Details"
          subtitle={astroSubtitle}
          badge={doneOrEmpty(
            Boolean(astronomic.sun_sign || astronomic.moon_sign),
            "Filled",
            "Not added",
          )}
          expanded={expandedSection === "astronomic"}
          onToggle={() => toggleSection("astronomic")}
        >
          <ErrorBanner message={sectionErrors.astronomic} />

          <Row>
            <Col>
              <Field
                label="Sun sign (Rashi)"
                value={astronomic.sun_sign}
                onChangeText={(t) =>
                  setAstronomic((p) => ({ ...p, sun_sign: t }))
                }
                placeholder="e.g. Leo"
              />
            </Col>
            <Col>
              <Field
                label="Moon sign"
                value={astronomic.moon_sign}
                onChangeText={(t) =>
                  setAstronomic((p) => ({ ...p, moon_sign: t }))
                }
                placeholder="e.g. Cancer"
              />
            </Col>
          </Row>
          <Row>
            <Col>
              <Field
                label="Time of birth"
                value={astronomic.time_of_birth}
                onChangeText={(t) =>
                  setAstronomic((p) => ({ ...p, time_of_birth: t }))
                }
                placeholder="e.g. 10:30 AM"
              />
            </Col>
            <Col>
              <Field
                label="City of birth"
                value={astronomic.city_of_birth}
                onChangeText={(t) =>
                  setAstronomic((p) => ({ ...p, city_of_birth: t }))
                }
                placeholder="e.g. Ahmedabad"
              />
            </Col>
          </Row>

          <SaveButton
            label="Save Horoscope Details"
            saving={savingSection === "astronomic"}
            onPress={() => handleSaveSection("astronomic")}
          />
        </SectionCard>

        {/* ------------------------------ Family ------------------------------ */}
        <SectionCard
          icon="people-outline"
          iconColor="#DC2626"
          iconBg="#FEEDED"
          title="Family Information"
          subtitle="Parents & siblings"
          badge={doneOrEmpty(
            Boolean(family.father || family.mother || family.sibling),
            "Filled",
            "Not added",
          )}
          expanded={expandedSection === "family"}
          onToggle={() => toggleSection("family")}
        >
          <ErrorBanner message={sectionErrors.family} />

          <Field
            label="Father's occupation"
            value={family.father}
            onChangeText={(t) => setFamily((p) => ({ ...p, father: t }))}
            placeholder="e.g. Business, Govt Service, Retired"
          />
          <Field
            label="Mother's occupation"
            value={family.mother}
            onChangeText={(t) => setFamily((p) => ({ ...p, mother: t }))}
            placeholder="e.g. Homemaker, Teacher, Doctor"
          />
          <Field
            label="Sibling details"
            value={family.sibling}
            onChangeText={(t) => setFamily((p) => ({ ...p, sibling: t }))}
            placeholder="e.g. 1 Brother (Married), 1 Sister"
          />

          <SaveButton
            label="Save Family Info"
            saving={savingSection === "family"}
            onPress={() => handleSaveSection("family")}
          />
        </SectionCard>

        {/* ------------------------------ Hobbies ------------------------------ */}
        <SectionCard
          icon="happy-outline"
          iconColor="#16A34A"
          iconBg="#E9F9EE"
          title="Hobbies & Interests"
          subtitle={hobbies.hobbies || "Personal interests"}
          badge={doneOrEmpty(Boolean(hobbies.hobbies), "Filled", "Not added")}
          expanded={expandedSection === "hobbies"}
          onToggle={() => toggleSection("hobbies")}
        >
          <ErrorBanner message={sectionErrors.hobbies} />

          <Field
            label="Hobbies"
            value={hobbies.hobbies}
            onChangeText={(t) => setHobbies((p) => ({ ...p, hobbies: t }))}
            placeholder="e.g. Reading, Photography, Gardening"
          />
          <Field
            label="Interests"
            value={hobbies.interests}
            onChangeText={(t) => setHobbies((p) => ({ ...p, interests: t }))}
            placeholder="e.g. Traveling, Technology, Cooking"
          />
          <Field
            label="Favorite music"
            value={hobbies.music}
            onChangeText={(t) => setHobbies((p) => ({ ...p, music: t }))}
            placeholder="e.g. Classical, Bollywood, Sufi, Pop"
          />
          <Field
            label="Sports & fitness"
            value={hobbies.sports}
            onChangeText={(t) => setHobbies((p) => ({ ...p, sports: t }))}
            placeholder="e.g. Cricket, Badminton, Yoga, Gym"
          />

          <SaveButton
            label="Save Hobbies"
            saving={savingSection === "hobbies"}
            onPress={() => handleSaveSection("hobbies")}
          />
        </SectionCard>

        {/* ------------------------------ Partner ------------------------------ */}
        <SectionCard
          icon="heart-circle-outline"
          iconColor={COLORS.primary}
          iconBg="#FFEDF1"
          title="Partner Expectations"
          subtitle="Match preferences & criteria"
          badge={doneOrEmpty(
            Boolean(partnerExpectation.general),
            "Filled",
            "Not added",
          )}
          expanded={expandedSection === "partner"}
          onToggle={() => toggleSection("partner")}
        >
          <ErrorBanner message={sectionErrors.partner} />

          <Field
            label="General expectations"
            multiline
            numberOfLines={4}
            value={partnerExpectation.general}
            onChangeText={(t) => {
              clearFieldError("partner", "general");
              setPartnerExpectation((p) => ({ ...p, general: t }));
            }}
            placeholder="Looking for an educated, caring, and understanding partner..."
            missing={isFieldMissing("partner", "general")}
            missingText="General expectations are missing"
          />

          <GroupTitle>Basics</GroupTitle>
          <Row>
            <Col>
              <Field
                label="Height (ft)"
                required
                value={partnerExpectation.partner_height}
                onChangeText={(t) => {
                  clearFieldError("partner", "partner_height");
                  setPartnerExpectation((p) => ({ ...p, partner_height: t }));
                }}
                placeholder="e.g. 5.6"
                keyboardType="decimal-pad"
                missing={isFieldMissing("partner", "partner_height")}
                missingText="Height is missing"
              />
            </Col>
            <Col>
              <Field
                label="Weight (kg)"
                required
                value={partnerExpectation.partner_weight}
                onChangeText={(t) => {
                  clearFieldError("partner", "partner_weight");
                  setPartnerExpectation((p) => ({ ...p, partner_weight: t }));
                }}
                placeholder="e.g. 60"
                keyboardType="decimal-pad"
                missing={isFieldMissing("partner", "partner_weight")}
                missingText="Weight is missing"
              />
            </Col>
          </Row>

          <SelectField
            label="Marital status"
            required
            value={
              partnerExpectation.partner_marital_status
                ? getOptionName(
                    maritalStatusList,
                    partnerExpectation.partner_marital_status,
                    "",
                  )
                : ""
            }
            placeholder="Select marital status"
            missing={isFieldMissing("partner", "partner_marital_status")}
            missingText="Marital status is missing"
            onPress={() =>
              openPicker(
                "Select Partner Marital Status",
                maritalStatusList,
                partnerExpectation.partner_marital_status,
                (item) => {
                  clearFieldError("partner", "partner_marital_status");
                  setPartnerExpectation((p) => ({
                    ...p,
                    partner_marital_status: item.id,
                  }));
                },
              )
            }
          />

          <ChipGroup
            label="Children acceptable"
            options={NO_YES_ANY}
            value={partnerExpectation.partner_children_acceptable}
            onChange={(v) =>
              setPartnerExpectation((p) => ({
                ...p,
                partner_children_acceptable: v,
              }))
            }
          />

          <GroupTitle>Location</GroupTitle>
          <SelectField
            label="Preferred country"
            required
            value={
              partnerExpectation.partner_country_id
                ? getOptionName(
                    countryList,
                    partnerExpectation.partner_country_id,
                    "",
                  )
                : ""
            }
            placeholder="Select country"
            missing={isFieldMissing("partner", "partner_country_id")}
            missingText="Country is missing"
            onPress={() =>
              openPicker(
                "Select Preferred Country",
                countryList,
                partnerExpectation.partner_country_id,
                (item) => {
                  clearFieldError("partner", "partner_country_id");
                  setPartnerExpectation((p) => ({
                    ...p,
                    partner_country_id: item.id,
                    residence_country_id: item.id,
                    partner_state_id: null,
                  }));
                },
              )
            }
          />
          <SelectField
            label="Preferred state"
            required
            value={
              partnerExpectation.partner_state_id
                ? getOptionName(
                    stateList,
                    partnerExpectation.partner_state_id,
                    "",
                  )
                : ""
            }
            placeholder="Select state"
            missing={isFieldMissing("partner", "partner_state_id")}
            missingText="State is missing"
            onPress={() => {
              const filtered = stateList.filter(
                (s) =>
                  !partnerExpectation.partner_country_id ||
                  String(s.country_id) ===
                    String(partnerExpectation.partner_country_id),
              );
              openPicker(
                "Select Preferred State",
                filtered.length ? filtered : stateList,
                partnerExpectation.partner_state_id,
                (item) => {
                  clearFieldError("partner", "partner_state_id");
                  setPartnerExpectation((p) => ({
                    ...p,
                    partner_state_id: item.id,
                  }));
                },
              );
            }}
          />

          <GroupTitle>Religion & community</GroupTitle>
          <SelectField
            label="Religion"
            required
            value={
              partnerExpectation.partner_religion_id
                ? getOptionName(
                    religionList,
                    partnerExpectation.partner_religion_id,
                    "",
                  )
                : ""
            }
            placeholder="Select religion"
            missing={isFieldMissing("partner", "partner_religion_id")}
            missingText="Religion is missing"
            onPress={() =>
              openPicker(
                "Select Partner Religion",
                religionList,
                partnerExpectation.partner_religion_id,
                (item) => {
                  clearFieldError("partner", "partner_religion_id");
                  setPartnerExpectation((p) => ({
                    ...p,
                    partner_religion_id: item.id,
                    partner_caste_id: null,
                    partner_sub_caste_id: null,
                  }));
                },
              )
            }
          />
          <Row>
            <Col>
              <SelectField
                label="Caste"
                value={
                  partnerExpectation.partner_caste_id
                    ? getOptionName(
                        casteList,
                        partnerExpectation.partner_caste_id,
                        "",
                      )
                    : ""
                }
                placeholder="Any caste"
                onPress={() => {
                  const filtered = casteList.filter(
                    (c) =>
                      !partnerExpectation.partner_religion_id ||
                      String(c.religion_id) ===
                        String(partnerExpectation.partner_religion_id),
                  );
                  openPicker(
                    "Select Partner Caste",
                    filtered.length ? filtered : casteList,
                    partnerExpectation.partner_caste_id,
                    (item) =>
                      setPartnerExpectation((p) => ({
                        ...p,
                        partner_caste_id: item.id,
                        partner_sub_caste_id: null,
                      })),
                  );
                }}
              />
            </Col>
            <Col>
              <SelectField
                label="Sub-caste"
                value={
                  partnerExpectation.partner_sub_caste_id
                    ? getOptionName(
                        subCasteList,
                        partnerExpectation.partner_sub_caste_id,
                        "",
                      )
                    : ""
                }
                placeholder="Any sub-caste"
                onPress={() => {
                  const filtered = subCasteList.filter(
                    (sc) =>
                      !partnerExpectation.partner_caste_id ||
                      String(sc.caste_id) ===
                        String(partnerExpectation.partner_caste_id),
                  );
                  openPicker(
                    "Select Partner Sub-Caste",
                    filtered.length ? filtered : subCasteList,
                    partnerExpectation.partner_sub_caste_id,
                    (item) =>
                      setPartnerExpectation((p) => ({
                        ...p,
                        partner_sub_caste_id: item.id,
                      })),
                  );
                }}
              />
            </Col>
          </Row>
          <ChipGroup
            label="Manglik"
            options={NO_YES_ANY}
            value={partnerExpectation.partner_manglik}
            onChange={(v) =>
              setPartnerExpectation((p) => ({ ...p, partner_manglik: v }))
            }
          />

          <GroupTitle>Education & career</GroupTitle>
          <Field
            label="Education"
            value={partnerExpectation.pertner_education}
            onChangeText={(t) =>
              setPartnerExpectation((p) => ({
                ...p,
                pertner_education: t,
                partner_education: t,
              }))
            }
            placeholder="e.g. Graduate, Master's, Any"
          />
          <Field
            label="Profession"
            value={partnerExpectation.partner_profession}
            onChangeText={(t) =>
              setPartnerExpectation((p) => ({ ...p, partner_profession: t }))
            }
            placeholder="e.g. Engineer, Doctor, CA, Any"
          />

          <GroupTitle>Looks & lifestyle</GroupTitle>
          <ChipGroup
            label="Complexion"
            options={COMPLEXIONS_ANY}
            value={
              partnerExpectation.pertner_complexion ||
              partnerExpectation.partner_complexion
            }
            onChange={(v) =>
              setPartnerExpectation((p) => ({
                ...p,
                pertner_complexion: v,
                partner_complexion: v,
              }))
            }
          />
          <ChipGroup
            label="Body type"
            options={BODY_TYPES_ANY}
            value={partnerExpectation.partner_body_type}
            onChange={(v) =>
              setPartnerExpectation((p) => ({ ...p, partner_body_type: v }))
            }
          />
          <ChipGroup
            label="Personal values"
            options={VALUES_ANY}
            value={partnerExpectation.partner_personal_value}
            onChange={(v) =>
              setPartnerExpectation((p) => ({
                ...p,
                partner_personal_value: v,
              }))
            }
          />
          <ChipGroup
            label="Diet"
            options={DIETS_ANY}
            value={partnerExpectation.partner_diet}
            onChange={(v) =>
              setPartnerExpectation((p) => ({ ...p, partner_diet: v }))
            }
          />
          <ChipGroup
            label="Smoking acceptable"
            options={HABIT_ANY}
            value={partnerExpectation.smoking_acceptable}
            onChange={(v) =>
              setPartnerExpectation((p) => ({ ...p, smoking_acceptable: v }))
            }
          />
          <ChipGroup
            label="Drinking acceptable"
            options={HABIT_ANY}
            value={partnerExpectation.drinking_acceptable}
            onChange={(v) =>
              setPartnerExpectation((p) => ({ ...p, drinking_acceptable: v }))
            }
          />

          <GroupTitle>Language & family</GroupTitle>
          <SelectField
            label="Preferred mother tongue"
            value={
              partnerExpectation.language_id
                ? getOptionName(
                    languageList,
                    partnerExpectation.language_id,
                    "",
                  )
                : ""
            }
            placeholder="Any language"
            onPress={() =>
              openPicker(
                "Select Preferred Language",
                languageList,
                partnerExpectation.language_id,
                (item) =>
                  setPartnerExpectation((p) => ({
                    ...p,
                    language_id: item.id,
                  })),
              )
            }
          />
          <SelectField
            label="Preferred family value"
            value={
              partnerExpectation.family_value_id
                ? getOptionName(
                    familyValueList,
                    partnerExpectation.family_value_id,
                    "",
                  )
                : ""
            }
            placeholder="Any family value"
            onPress={() =>
              openPicker(
                "Select Preferred Family Value",
                familyValueList,
                partnerExpectation.family_value_id,
                (item) =>
                  setPartnerExpectation((p) => ({
                    ...p,
                    family_value_id: item.id,
                  })),
              )
            }
          />

          <SaveButton
            label="Save Partner Expectations"
            saving={savingSection === "partner"}
            onPress={() => handleSaveSection("partner")}
          />
        </SectionCard>

        {/* ------------------------------ Account ------------------------------ */}
        <Text style={styles.listHeading}>Account & security</Text>
        <View style={styles.accountCard}>
          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => navigation.navigate("ChangePassword")}
            activeOpacity={0.75}
          >
            <View style={[styles.accountIcon, { backgroundColor: "#F1F1F4" }]}>
              <Ionicons name="key-outline" size={20} color={COLORS.text} />
            </View>
            <Text style={styles.accountText}>Change password</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textLight}
            />
          </TouchableOpacity>

          <View style={styles.accountDivider} />

          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => navigation.navigate("DeactivateAccount")}
            activeOpacity={0.75}
          >
            <View style={[styles.accountIcon, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="pause-circle-outline" size={20} color="#D97706" />
            </View>
            <Text style={[styles.accountText, { color: "#B45309" }]}>
              Temporarily deactivate account
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textLight}
            />
          </TouchableOpacity>

          <View style={styles.accountDivider} />

          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => navigation.navigate("DeleteAccount")}
            activeOpacity={0.75}
          >
            <View style={[styles.accountIcon, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
            </View>
            <Text style={[styles.accountText, { color: "#DC2626" }]}>
              Delete account permanently
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textLight}
            />
          </TouchableOpacity>
        </View>

        <View style={{ height: 48 }} />
      </KeyboardAwareScrollView>

      {/* Option Picker Modal */}
      <OptionPickerModal
        visible={pickerModal.visible}
        title={pickerModal.title}
        subtitle={pickerModal.subtitle}
        options={pickerModal.options}
        selectedId={pickerModal.selectedId}
        onSelect={pickerModal.onSelect}
        onClose={() => setPickerModal((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 20,
  },
  disabled: {
    opacity: 0.6,
  },

  /* Header save */
  headerSaveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSaveText: {
    color: "#fff",
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },

  /* Hero */
  hero: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    width: 64,
    height: 64,
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.border,
    borderWidth: 2,
    borderColor: COLORS.primarySoft,
  },
  avatarFallback: {
    backgroundColor: "#FFE4EE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  heroInfo: {
    flex: 1,
    marginLeft: 12,
  },
  heroName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 2,
  },
  heroLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  heroLineText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
  },
  idPill: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
  },
  idPillText: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  changePhotoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
  },
  changePhotoText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  progressBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  progressPct: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F1ECE8",
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  progressHint: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 6,
  },

  loadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  loadingBannerText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },

  listHeading: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: COLORS.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },

  /* Section card */
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  sectionCardOpen: {
    borderColor: "#F9A8C4",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  sectionTitleCol: {
    flex: 1,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 1,
  },
  sectionBody: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },

  /* Badge */
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
  },
  badgeLabel: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
  },

  /* Fields */
  fieldWrap: {
    marginTop: 12,
  },
  label: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    marginBottom: 5,
  },
  star: {
    color: "#DC2626",
  },
  input: {
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  inputMissing: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF8F8",
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: "top",
    lineHeight: 19,
  },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  selectText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginRight: 8,
  },
  selectPlaceholder: {
    color: "#A8A29E",
  },
  missingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginLeft: 2,
  },
  missingText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: "#DC2626",
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },
  col: {
    flex: 1,
  },

  /* Chips & segmented */
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  segRow: {
    flexDirection: "row",
    gap: 8,
  },
  segBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  chipTextActive: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },

  /* Address segment */
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 3,
    marginTop: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  segmentTextActive: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },

  groupTitle: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },

  /* Banners */
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  errorTitle: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: "#991B1B",
    marginBottom: 1,
  },
  errorText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#B91C1C",
    lineHeight: 16,
  },
  hintBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    padding: 9,
    marginTop: 12,
  },
  hintBannerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: "#92400E",
    lineHeight: 15,
  },

  /* Section save button */
  saveSectionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 18,
  },
  saveSectionBtnText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#fff",
  },

  /* Account */
  accountCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  accountIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  accountText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  accountDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 54,
  },
});
