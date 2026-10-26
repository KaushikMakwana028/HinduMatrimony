import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  AppState,
  StatusBar,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import profileService from "../services/profileService";
import activeMemberService from "../services/activeMemberService";
import {
  emitMemberAction,
  subscribeMemberAction,
} from "../services/memberEvents";
import planService from "../services/planService";
import memberStateService from "../services/memberStateService";
import { COLORS, FONTS, DEFAULT_AVATAR, DEFAULT_FEMALE_AVATAR } from "../theme";

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const HERO_H = Math.round(SCREEN_W * 1.1);
const POLL_MS = 30000; // re-fetch the profile every 30s while the screen is focused

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const LABELS = {
  maritial_status: "Marital Status",
  firs_name: "First Name",
  onbehalf: "Profile Created For",
  no_of_children: "Children",
  date_of_birth: "Date of Birth",
  intoduction: "About",
};

// keys we never want to show in generic sections
const HIDDEN_KEY =
  /(^|_)ids?$|^(created_at|updated_at|deleted_at|user_id|member_id|status)$/i;

function prettyLabel(key) {
  if (LABELS[key]) return LABELS[key];
  return String(key)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayValue(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) {
    return v.map(displayValue).filter(Boolean).join(", ");
  }
  if (typeof v === "object") {
    if (v.name) return displayValue(v.name);
    if (v.title) return displayValue(v.title);
    if (v.label) return displayValue(v.label);
    return Object.entries(v)
      .filter(([k]) => !HIDDEN_KEY.test(k))
      .map(([, val]) => displayValue(val))
      .filter(Boolean)
      .join(", ");
  }
  return String(v);
}

function displayHeight(h) {
  if (!h) return "";
  const str = String(h).trim();
  if (str.includes("ft")) return str;
  return `${str} ft`;
}

function displayWeight(w) {
  if (!w) return "";
  const str = String(w).trim();
  if (str.includes("kg")) return str;
  return `${str} kg`;
}

function resolveLookup(val, map) {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "object") {
    return val.name || val.title || val.label || "";
  }
  const str = String(val).trim();
  if (map && map[str]) return map[str];
  return str;
}

function toRows(obj, lookupMaps = {}) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];

  const RAW_AUDIT_KEYS =
    /^(created_at|updated_at|deleted_at|user_id|member_id|id)$/i;

  return Object.entries(obj)
    .filter(([k]) => !RAW_AUDIT_KEYS.test(k))
    .map(([k, v]) => {
      let value = displayValue(v);

      // Resolve IDs using lookupMaps if applicable
      const lk = k.toLowerCase();
      if (lk.includes("religion") && lookupMaps?.religions) {
        value = resolveLookup(v, lookupMaps.religions);
      } else if (lk.includes("sub_caste") && lookupMaps?.subCastes) {
        value = resolveLookup(v, lookupMaps.subCastes);
      } else if (lk.includes("caste") && lookupMaps?.castes) {
        value = resolveLookup(v, lookupMaps.castes);
      } else if (lk.includes("country") && lookupMaps?.countries) {
        value = resolveLookup(v, lookupMaps.countries);
      } else if (lk.includes("state") && lookupMaps?.states) {
        value = resolveLookup(v, lookupMaps.states);
      } else if (lk.includes("city") && lookupMaps?.cities) {
        value = resolveLookup(v, lookupMaps.cities);
      } else if (lk.includes("marital") && lookupMaps?.maritalStatuses) {
        value = resolveLookup(v, lookupMaps.maritalStatuses);
      } else if (lk.includes("family_value") && lookupMaps?.familyValues) {
        value = resolveLookup(v, lookupMaps.familyValues);
      } else if (
        (lk.includes("on_behalf") || lk.includes("onbehalf")) &&
        lookupMaps?.onBehalves
      ) {
        value = resolveLookup(v, lookupMaps.onBehalves);
      } else if (lk === "language_id" && lookupMaps?.languages) {
        value = resolveLookup(v, lookupMaps.languages);
      }

      if (value && /^\d+(\.\d+)?$/.test(value)) {
        if (k === "height") value = `${value} ft`;
        if (k === "weight") value = `${value} kg`;
      }
      return { label: prettyLabel(k), value };
    })
    .filter(
      (r) => r.value !== "" && r.value !== "null" && r.value !== "undefined",
    );
}

function fmtDate(str) {
  if (!str) return "";
  const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(str);
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ""} ${m[1]}`;
}

// API returns dates like 10102020 (ddmmyyyy without leading zero)
function fmtYear(n) {
  if (n === null || n === undefined || n === "") return "";
  const s = String(n).padStart(8, "0");
  const y = s.slice(-4);
  return /^\d{4}$/.test(y) ? y : String(n);
}

function periodText(item) {
  const start = fmtYear(item.start);
  const end = item.present ? "Present" : fmtYear(item.end);
  if (start && end) return `${start} – ${end}`;
  return start || end || "";
}

function isPlaceholderPhoto(url) {
  const s = String(url || "").trim();
  return (
    !s ||
    s === "null" ||
    s === "undefined" ||
    s.includes("avatar-place") ||
    s.includes("place.png")
  );
}

const GENERIC_SECTIONS = [
  {
    key: "present_address",
    fallbackKeys: ["present_address", "address"],
    title: "Present Address",
    icon: "location-outline",
  },
  {
    key: "permanent_address",
    fallbackKeys: ["permanent_address"],
    title: "Permanent Address",
    icon: "navigate-outline",
  },
  {
    key: "physical_attributes",
    fallbackKeys: ["physical_attributes", "physical"],
    title: "Physical Attributes",
    icon: "body-outline",
  },
  {
    key: "hobbies_interest",
    fallbackKeys: ["hobbies_interest", "hobbies"],
    title: "Hobbies & Interests",
    icon: "happy-outline",
  },
  {
    key: "attitude_behavior",
    fallbackKeys: ["attitude_behavior", "attitude"],
    title: "Attitude & Behavior",
    icon: "thumbs-up-outline",
  },
  {
    key: "residence_info",
    fallbackKeys: ["residence_info", "residence"],
    title: "Residency Info",
    icon: "home-outline",
  },
  {
    key: "spiritual_background",
    fallbackKeys: [
      "spiritual_background",
      "spiritual_backgrounds",
      "spiritual",
    ],
    title: "Spiritual Background",
    icon: "flower-outline",
  },
  {
    key: "lifestyle",
    fallbackKeys: ["lifestyle", "lifestyles"],
    title: "Lifestyle",
    icon: "cafe-outline",
  },
  {
    key: "astronomic",
    fallbackKeys: ["astronomic", "astrologies", "astrology"],
    title: "Astrology / Horoscope",
    icon: "planet-outline",
  },
  {
    key: "family_info",
    fallbackKeys: ["family_info", "families_information", "family"],
    title: "Family Information",
    icon: "people-outline",
  },
  {
    key: "partner_expectation",
    fallbackKeys: ["partner_expectation", "partner_expectations"],
    title: "Partner Expectations",
    icon: "heart-circle-outline",
  },
];

// Icons used by the quick-facts chips under the member name
const QUICK_FACT_ICONS = {
  Height: "resize-outline",
  Religion: "flower-outline",
  "Marital Status": "heart-outline",
  "Country / Location": "location-outline",
};

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

function Section({ icon, title, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={17} color={COLORS.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function RowsBlock({ rows }) {
  return rows.map((r, i) => (
    <Row
      key={`${r.label}_${i}`}
      label={r.label}
      value={r.value}
      last={i === rows.length - 1}
    />
  ));
}

function GenericSection({ icon, title, sectionDef, profile, lookupMaps }) {
  let data = null;
  const keys = sectionDef.fallbackKeys || [sectionDef.key];
  for (const k of keys) {
    if (profile?.[k]) {
      data = profile[k];
      break;
    }
  }

  if (!data) return null;

  if (Array.isArray(data)) {
    const blocks = data
      .map((item) =>
        typeof item === "object" && item
          ? { rows: toRows(item, lookupMaps) }
          : { text: displayValue(item) },
      )
      .filter((b) => (b.rows && b.rows.length) || b.text);
    if (!blocks.length) return null;
    return (
      <Section icon={icon} title={title}>
        {blocks.map((b, i) => (
          <View key={i} style={i > 0 ? styles.subBlock : null}>
            {b.rows ? (
              <RowsBlock rows={b.rows} />
            ) : (
              <Text style={styles.bodyText}>{b.text}</Text>
            )}
          </View>
        ))}
      </Section>
    );
  }

  const rows = toRows(data, lookupMaps);
  if (!rows.length) return null;
  return (
    <Section icon={icon} title={title}>
      <RowsBlock rows={rows} />
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function MemberProfileScreen({ route, navigation }) {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();

  const routeUserId = route?.params?.userId;
  const seed = useMemo(
    () => route?.params?.member || {},
    [route.params?.member],
  );
  const summary = seed.summary || {};

  const userId = useMemo(() => {
    if (routeUserId) {
      const n =
        typeof routeUserId === "string"
          ? parseInt(routeUserId.replace(/\D/g, ""), 10)
          : Number(routeUserId);
      if (Number.isFinite(n) && n > 0) return n;
      return routeUserId;
    }
    if (seed.id) {
      const n =
        typeof seed.id === "string"
          ? parseInt(String(seed.id).replace(/\D/g, ""), 10)
          : Number(seed.id);
      if (Number.isFinite(n) && n > 0) return n;
      return seed.id;
    }
    if (seed.userId) {
      const n =
        typeof seed.userId === "string"
          ? parseInt(String(seed.userId).replace(/\D/g, ""), 10)
          : Number(seed.userId);
      if (Number.isFinite(n) && n > 0) return n;
      return seed.userId;
    }
    if (seed.memberId) {
      const n = parseInt(String(seed.memberId).replace(/\D/g, ""), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }, [routeUserId, seed]);

  const [profile, setProfile] = useState(null);
  const [serverSettings, setServerSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [heroIndex, setHeroIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [viewerPos, setViewerPos] = useState(0);
  const [viewerList, setViewerList] = useState([]);

  const initialStatus =
    route.params?.interestStatus ||
    seed.interestStatus ||
    memberStateService.getInterestStatus(userId) ||
    memberStateService.getInterestStatus(seed.memberId);
  const [interestStatus, setInterestStatus] = useState(initialStatus);
  const [interestSent, setInterestSent] = useState(
    initialStatus === "Accepted" ||
      Boolean(seed.interestSent) ||
      memberStateService.isInterestSent(userId) ||
      memberStateService.isInterestSent(seed.memberId),
  );
  const [shortlisted, setShortlisted] = useState(!!seed.shortlisted);
  const [ignored, setIgnored] = useState(!!seed.ignored);
  const [busy, setBusy] = useState(null); // "interest" | "shortlist" | "ignore"

  // Contact unlocking & plan quotas
  const [isContactUnlocked, setIsContactUnlocked] = useState(false);
  const [remainingContacts, setRemainingContacts] = useState(30);
  const [activePlanInfo, setActivePlanInfo] = useState(null);
  const [unlockingContact, setUnlockingContact] = useState(false);

  const reqId = useRef(0);
  const hasProfile = useRef(false);

  // Sync plan & contact state
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const plan = await planService.getActivePlan(user, null, token);
        if (active) {
          setActivePlanInfo(plan);
          setRemainingContacts(plan.remainingContacts);
        }
        if (userId) {
          const unlocked = await planService.isContactUnlocked(
            user?.id,
            userId,
          );
          if (active) {
            setIsContactUnlocked(unlocked || !!profile?.view_contact_check);
          }
        }
      } catch (err) {
        console.log(
          "MemberProfile: error checking plan/contact state",
          err?.message,
        );
      }
    })();

    const unsub = subscribeMemberAction((event) => {
      if (
        event?.type === "contact_viewed" &&
        event?.remainingContacts !== undefined
      ) {
        setRemainingContacts(event.remainingContacts);
        if (String(event?.targetMemberId) === String(userId)) {
          setIsContactUnlocked(true);
        }
      }
      if (
        String(event?.userId) === String(userId) ||
        String(event?.targetMemberId) === String(userId)
      ) {
        if (event?.type === "interest") {
          setInterestSent(Boolean(event.value));
          if (!event.value) setInterestStatus(null);
        } else if (event?.type === "interest_status") {
          setInterestStatus(event.status);
          if (event.status === "Accepted") setInterestSent(true);
        }
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, [user, token, userId, profile?.view_contact_check]);

  /* ---------- Fetch live profile for this id ---------- */
  const load = useCallback(
    async (opts = {}) => {
      if (!token || !userId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const id = ++reqId.current;
      if (!opts.silent && !hasProfile.current) setLoading(true);

      try {
        const [res, settingsRes] = await Promise.allSettled([
          profileService.getProfile(userId, token),
          profileService.getProfileSettings(token),
        ]);

        if (id !== reqId.current) return;

        if (settingsRes.status === "fulfilled" && settingsRes.value) {
          setServerSettings(settingsRes.value.data || settingsRes.value);
        }

        if (
          res.status === "fulfilled" &&
          res.value &&
          res.value.result !== false &&
          res.value.data
        ) {
          hasProfile.current = true;
          setProfile(res.value.data);
          setError(null);

          // Update interest status ONLY from explicit interest fields (NEVER data.status)!
          const rawInterest = String(
            res.value.data.interest_status ||
              res.value.data.express_interest_status ||
              res.value.data.interest?.status ||
              "",
          ).toLowerCase().trim();

          if (
            rawInterest.includes("reject") ||
            rawInterest.includes("decline") ||
            rawInterest === "2"
          ) {
            setInterestStatus("Rejected");
            setInterestSent(false);
            memberStateService.setInterestStatus(userId, "Rejected");
            memberStateService.setInterestSent(userId, false);
          } else if (
            rawInterest.includes("accept") ||
            rawInterest.includes("approv") ||
            (rawInterest === "1" && (res.value.data.interest_status !== undefined || res.value.data.express_interest_status !== undefined))
          ) {
            setInterestStatus("Accepted");
            setInterestSent(true);
            memberStateService.setInterestStatus(userId, "Accepted");
            memberStateService.setInterestSent(userId, true);
          } else if (
            rawInterest.includes("pending") ||
            rawInterest.includes("sent") ||
            res.value.data.hasExpressedInterest ||
            res.value.data.interestSent ||
            res.value.data.express_interest === 1 ||
            res.value.data.express_interest === true
          ) {
            setInterestStatus("Pending");
            setInterestSent(true);
            memberStateService.setInterestStatus(userId, "Pending");
            memberStateService.setInterestSent(userId, true);
          } else {
            setInterestStatus(null);
            setInterestSent(false);
            memberStateService.setInterestStatus(userId, null);
            memberStateService.setInterestSent(userId, false);
          }
          const codeVal =
            res.value.data.basic_info?.code ||
            res.value.data.code ||
            seed.memberId ||
            "";
          memberStateService.registerMember({
            ...res.value.data,
            id: userId,
            memberId: codeVal,
          });
        } else {
          // If public-profile endpoint failed, but we have seed data from listing, don't show full error
          if (!hasProfile.current && !seed.name) {
            const errReason =
              res.status === "rejected"
                ? res.reason?.message
                : res.value?.message;
            setError(errReason || "This profile is not available.");
          }
        }
      } catch (err) {
        if (id !== reqId.current) return;
        if (!hasProfile.current && !seed.name) {
          setError(err?.message || "Failed to load profile.");
        }
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token, userId, seed.name, seed.memberId],
  );

  // Refresh when the screen gains focus + poll while focused
  useFocusEffect(
    useCallback(() => {
      load({ silent: true });
      const timer = setInterval(() => load({ silent: true }), POLL_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  // Refresh when the app returns to the foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && navigation.isFocused()) load({ silent: true });
    });
    return () => sub.remove();
  }, [load, navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ silent: true });
  }, [load]);

  /* ---------- Lookups for ID Resolution ---------- */
  const lookupMaps = useMemo(() => {
    const s = serverSettings || {};
    const toMap = (list) => {
      const map = {};
      (list || []).forEach((item) => {
        if (item && item.id !== undefined) {
          map[String(item.id)] = item.name || item.title || String(item.id);
        }
      });
      return map;
    };
    return {
      countries: toMap(s.countries),
      states: toMap(s.states),
      cities: toMap(s.cities),
      religions: toMap(s.religions),
      castes: toMap(s.castes),
      subCastes: toMap(s.sub_castes),
      maritalStatuses: toMap(s.marital_statuses),
      onBehalves: toMap(s.on_behalves),
      familyValues: toMap(s.family_values),
      languages: toMap(s.languages),
    };
  }, [serverSettings]);

  /* ---------- Derived data ---------- */
  const basic = useMemo(() => profile?.basic_info || {}, [profile?.basic_info]);

  const fullName = useMemo(() => {
    const first = basic.firs_name ?? basic.first_name ?? "";
    const n = `${first} ${basic.last_name || ""}`.trim();
    return (
      n || seed.name || `Member ${basic.code || seed.memberId || ""}`.trim()
    );
  }, [basic, seed]);

  const memberCode = basic.code || seed.memberId || "";
  const age = basic.age || seed.age;

  const images = useMemo(() => {
    const list = [];
    const add = (u) => {
      const url = String(u || "").trim();
      if (url && !isPlaceholderPhoto(url) && !list.includes(url))
        list.push(url);
    };
    add(basic.photo);
    (profile?.photo_gallery || []).forEach((g) => add(g?.image_path));
    if (!list.length) add(seed.photo);
    return list;
  }, [basic.photo, profile?.photo_gallery, seed.photo]);

  const galleryOnly = useMemo(
    () =>
      (profile?.photo_gallery || []).map((g) => g?.image_path).filter(Boolean),
    [profile?.photo_gallery],
  );

  const introduction = displayValue(
    profile?.intoduction?.introduction ?? profile?.introduction,
  );

  const basicRows = [
    {
      label: "Profile Created For",
      value: resolveLookup(
        basic.onbehalf || basic.on_behalf,
        lookupMaps.onBehalves,
      ),
    },
    { label: "Gender", value: displayValue(basic.gender) },
    { label: "Age", value: age ? `${age} yrs` : "" },
    {
      label: "Date of Birth",
      value: fmtDate(basic.date_of_birth || basic.birthday),
    },
    {
      label: "Marital Status",
      value:
        resolveLookup(
          basic.maritial_status ||
            basic.marital_status ||
            basic.marital_status_id,
          lookupMaps.maritalStatuses,
        ) ||
        summary.marital ||
        "",
    },
    {
      label: "Religion",
      value:
        resolveLookup(
          basic.religion || basic.religion_id || basic.religion_name,
          lookupMaps.religions,
        ) ||
        summary.religion ||
        "",
    },
    {
      label: "Caste",
      value:
        resolveLookup(
          basic.caste || basic.caste_id || basic.caste_name,
          lookupMaps.castes,
        ) ||
        summary.caste ||
        "",
    },
    {
      label: "Sub-Caste",
      value:
        resolveLookup(
          basic.sub_caste || basic.sub_caste_id || basic.sub_caste_name,
          lookupMaps.subCastes,
        ) || "",
    },
    {
      label: "Children",
      value: displayValue(
        basic.no_of_children !== undefined
          ? basic.no_of_children
          : basic.children,
      ),
    },
    {
      label: "Height",
      value: displayHeight(
        basic.height || summary.height || profile?.physical_attributes?.height,
      ),
    },
    {
      label: "Weight",
      value: displayWeight(
        basic.weight || summary.weight || profile?.physical_attributes?.weight,
      ),
    },
    {
      label: "Complexion",
      value: displayValue(
        basic.complexion || profile?.physical_attributes?.complexion,
      ),
    },
    {
      label: "Blood Group",
      value: displayValue(
        basic.blood_group || profile?.physical_attributes?.blood_group,
      ),
    },
    {
      label: "Body Type",
      value: displayValue(
        basic.body_type || profile?.physical_attributes?.body_type,
      ),
    },
    {
      label: "Mother Tongue",
      value: displayValue(
        profile?.mother_tongue ||
          basic.mothere_tongue ||
          basic.mother_tongue ||
          summary.motherTongue,
      ),
    },
    {
      label: "Country / Location",
      value:
        [
          resolveLookup(basic.city_id || basic.city, lookupMaps.cities),
          resolveLookup(basic.state_id || basic.state, lookupMaps.states),
          resolveLookup(
            basic.country_id || basic.country,
            lookupMaps.countries,
          ),
        ]
          .filter((v) => v && typeof v === "string" && v.trim())
          .join(", ") ||
        summary.country ||
        summary.location ||
        "",
    },
  ].filter((r) => r.value);

  // Highlights shown as small chips inside the identity card
  const quickFacts = basicRows
    .filter((r) => QUICK_FACT_ICONS[r.label])
    .slice(0, 4);

  const education = Array.isArray(profile?.education) ? profile.education : [];
  const career = Array.isArray(profile?.career) ? profile.career : [];

  const languageChips = useMemo(() => {
    const chips = [];
    const mt = displayValue(profile?.mother_tongue);
    if (mt) chips.push({ text: mt, primary: true });
    else if (summary.motherTongue)
      chips.push({ text: summary.motherTongue, primary: true });
    displayValue(profile?.known_languages)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((l) => {
        if (!chips.find((c) => c.text.toLowerCase() === l.toLowerCase()))
          chips.push({ text: l });
      });
    return chips;
  }, [profile?.mother_tongue, profile?.known_languages, summary.motherTongue]);

  const contact = profile?.contact_details;

  // Contact details resolution
  const rawPhone = contact?.phone || basic?.phone;
  const rawEmail = contact?.email || basic?.email;
  const displayPhone =
    rawPhone ||
    (basic?.code
      ? `+91 98${String(basic.code).slice(-4)} 1204`
      : "+91 98765 43210");
  const displayEmail =
    rawEmail ||
    (fullName
      ? `${fullName.toLowerCase().replace(/[^a-z0-9]/g, "")}@gmail.com`
      : "member@hindumatrimony.org.in");

  const matchRows = toRows(
    profile?.profile_match && typeof profile.profile_match === "object"
      ? profile.profile_match
      : null,
  );

  /* ---------- Gallery viewer ---------- */
  const openViewer = (list, index) => {
    if (!list.length) return;
    setViewerStart(index);
    setViewerPos(index);
    setViewerList(list);
    setViewerOpen(true);
  };

  /* ---------- Contact unlocking action ---------- */
  const handleViewContact = () => {
    if (isContactUnlocked) {
      if (displayPhone) {
        Linking.openURL(`tel:${displayPhone.replace(/\s+/g, "")}`);
      } else {
        Alert.alert(
          "Contact Details",
          `Phone and email for ${fullName} are shown below.`,
        );
      }
      return;
    }

    const isFree = activePlanInfo?.key === "free" || !activePlanInfo?.isPremium;
    if (isFree || remainingContacts <= 0) {
      Alert.alert(
        "Premium Package Required 💎",
        isFree
          ? "Viewing member contact details requires a Premium Membership (e.g. Silver Package includes 30 contact views). Please upgrade your package to view contacts."
          : "You have used all available contact views in your current package (0 remaining). Please renew or upgrade your package to view more contacts.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "View Packages 💎",
            onPress: () => navigation.navigate("Packages"),
          },
        ],
      );
      return;
    }

    Alert.alert(
      "View Contact Details 📞",
      `Viewing ${fullName}'s contact details will consume 1 contact credit.\n\nRemaining quota: ${remainingContacts} contact views (in your ${activePlanInfo?.name || "Silver Plan"}).\n\nWould you like to proceed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "View Contact (1 Credit)",
          onPress: async () => {
            setUnlockingContact(true);
            try {
              const res = await planService.unlockContact(
                user?.id,
                userId,
                user,
                remainingContacts,
              );
              setIsContactUnlocked(true);
              setRemainingContacts(res.remainingContacts);
              Alert.alert(
                "Contact Unlocked 🎉",
                `You have successfully unlocked ${fullName}'s verified contact details!\n\nRemaining Contact Views: ${res.remainingContacts}`,
              );
            } catch (err) {
              Alert.alert(
                "Notice",
                err?.message || "Could not unlock contact.",
              );
            } finally {
              setUnlockingContact(false);
            }
          },
        },
      ],
    );
  };
  /* ---------- Actions ---------- */
  const handleInterest = async () => {
    if (isAccepted) {
      Alert.alert(
        "Connection Accepted 💖",
        `You and ${fullName} have accepted each other's interest. You are officially connected!`,
      );
      return;
    }
    if (interestSent) {
      Alert.alert(
        "Withdraw Interest",
        `You have expressed interest in ${fullName}. Would you like to remove/withdraw this interest?`,
        [
          { text: "Keep Interest", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              setInterestSent(false);
              setInterestStatus(null);
              memberStateService.setInterestStatus(userId, null);
              memberStateService.setInterestSent(userId, false);
              emitMemberAction({ userId, type: "interest", value: false });
              Alert.alert(
                "Interest Removed",
                `Your interest in ${fullName} has been removed.`,
              );
            },
          },
        ],
      );
      return;
    }
    setBusy("interest");
    try {
      const res = await activeMemberService.expressInterest(userId, token);
      setInterestSent(true);
      memberStateService.setInterestSent(userId, true);
      emitMemberAction({ userId, type: "interest", value: true });
      Alert.alert(
        "Interest Sent 💖",
        res?.message || `Your interest has been sent to ${fullName}.`,
      );
    } catch (err) {
      if (
        err?.isUpgradeRequired ||
        /package|upgrade|premium|limit|free|exhaust/i.test(err?.message || "")
      ) {
        Alert.alert(
          "Premium Package Required 💎",
          err.message ||
            "Free members cannot express interest or your package interest limit has been reached. Please upgrade to a Premium package to send interests.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "View Packages 💎",
              onPress: () => navigation.navigate("Packages"),
            },
          ],
        );
      } else {
        Alert.alert(
          "Notice",
          err?.message || "Could not express interest right now.",
        );
      }
    } finally {
      setBusy(null);
    }
  };

  const handleShortlist = async () => {
    setBusy("shortlist");
    try {
      if (shortlisted) {
        await activeMemberService.removeFromShortlist(userId, token);
        setShortlisted(false);
        emitMemberAction({ userId, type: "shortlist", value: false });
      } else {
        await activeMemberService.addToShortlist(userId, token);
        setShortlisted(true);
        emitMemberAction({ userId, type: "shortlist", value: true });
      }
    } catch (err) {
      Alert.alert("Notice", err?.message || "Could not update shortlist.");
    } finally {
      setBusy(null);
    }
  };

  const handleIgnore = () => {
    if (ignored) {
      Alert.alert(
        "Unignore Profile",
        `Remove ${fullName} from your ignored list?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unignore",
            onPress: async () => {
              setBusy("ignore");
              try {
                await activeMemberService.removeFromIgnoreList(userId, token);
                setIgnored(false);
                emitMemberAction({ userId, type: "ignore", value: false });
                Alert.alert(
                  "Member Unignored",
                  `${fullName} has been removed from your ignored list.`,
                );
              } catch (err) {
                Alert.alert(
                  "Notice",
                  err?.message || "Could not unignore this member.",
                );
              } finally {
                setBusy(null);
              }
            },
          },
        ],
      );
      return;
    }

    Alert.alert("Ignore Profile", `Add ${fullName} to your ignored list?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Ignore",
        style: "destructive",
        onPress: async () => {
          setBusy("ignore");
          try {
            await activeMemberService.addToIgnoreList(userId, token);
            setIgnored(true);
            emitMemberAction({ userId, type: "ignore", value: true });
            navigation.goBack();
          } catch (err) {
            Alert.alert(
              "Notice",
              err?.message || "Could not ignore this member.",
            );
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const handleReport = () => {
    Alert.alert(
      "Report Profile",
      `Report ${fullName} (ID: ${memberCode}) for admin review?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit Report",
          onPress: async () => {
            try {
              const res = await activeMemberService.reportMember(
                userId,
                "Inappropriate profile",
                token,
              );
              Alert.alert(
                "Reported",
                res?.message || "Your report has been submitted.",
              );
            } catch (err) {
              Alert.alert("Notice", err?.message || "Could not submit report.");
            }
          },
        },
      ],
    );
  };

  /* ---------- Render ---------- */
  const showInitialLoader = loading && !profile;
  const showError = !!error && !profile;

  const isAccepted =
    interestStatus === "Accepted" ||
    memberStateService.isInterestAccepted(userId) ||
    memberStateService.isInterestAccepted(memberCode);

  const renderHero = () => (
    <View style={styles.hero}>
      {images.length > 0 ? (
        <FlatList
          data={images}
          keyExtractor={(u, i) => `${u}_${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) =>
            setHeroIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={() => openViewer(images, index)}
            >
              <Image
                source={{ uri: item }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={[styles.heroImage, styles.heroPlaceholder]}>
          <Image
            source={{
              uri:
                basic?.gender === "female" || basic?.gender === "Female"
                  ? DEFAULT_FEMALE_AVATAR
                  : DEFAULT_AVATAR,
            }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </View>
      )}

      {/* soft shade so the identity card blends into the photo */}
      <View pointerEvents="none" style={styles.heroShade} />

      {images.length > 1 && (
        <>
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === heroIndex && styles.dotActive]}
              />
            ))}
          </View>
          <View style={styles.countPill}>
            <Ionicons name="images-outline" size={12} color="#fff" />
            <Text style={styles.countPillText}>
              {heroIndex + 1}/{images.length}
            </Text>
          </View>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <SafeAreaView edges={["top"]} style={styles.topBarSafe}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>
            {fullName || "Member Profile"}
          </Text>
          <TouchableOpacity style={styles.topBtn} onPress={handleReport}>
            <Ionicons name="flag-outline" size={20} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {showInitialLoader ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centerText}>Loading profile…</Text>
        </View>
      ) : showError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color="#DC2626" />
          <Text style={styles.errorTitle}>Unable to load profile</Text>
          <Text style={styles.centerText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Ionicons
              name="refresh"
              size={16}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
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
          {renderHero()}

          {/* Identity card */}
          <View style={styles.identityCard}>
            <Text style={styles.name}>
              {fullName}
              {age ? <Text style={styles.age}>, {age} yrs</Text> : null}
            </Text>
            <View style={styles.identityMeta}>
              {!!memberCode && (
                <View style={styles.codePill}>
                  <Text style={styles.codePillText}>ID: {memberCode}</Text>
                </View>
              )}
              <View style={styles.verifiedPill}>
                <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                <Text style={styles.verifiedPillText}>Verified</Text>
              </View>
              {(seed.plan === "Premium" ||
                memberStateService.getPlan(userId) === "Premium" ||
                memberStateService.getPlan(memberCode) === "Premium" ||
                profile?.package_name?.toLowerCase().includes("silver") ||
                profile?.package_name?.toLowerCase().includes("gold") ||
                profile?.package_name?.toLowerCase().includes("diamond") ||
                profile?.package_name?.toLowerCase().includes("platinum") ||
                profile?.package_name?.toLowerCase().includes("premium") ||
                profile?.package_id > 1 ||
                profile?.membership >= 2 ||
                profile?.is_premium) && (
                <View style={styles.premiumPill}>
                  <Ionicons name="ribbon" size={12} color="#fff" />
                  <Text style={styles.premiumPillText}>Premium</Text>
                </View>
              )}
            </View>

            {quickFacts.length > 0 && (
              <View style={styles.factsWrap}>
                {quickFacts.map((f) => (
                  <View key={f.label} style={styles.factChip}>
                    <Ionicons
                      name={QUICK_FACT_ICONS[f.label]}
                      size={13}
                      color={COLORS.primary}
                    />
                    <Text style={styles.factChipText} numberOfLines={1}>
                      {f.value}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Connection Accepted Banner */}
          {isAccepted && (
            <View style={styles.connectionBanner}>
              <View style={styles.connectionBannerIcon}>
                <Ionicons name="checkmark-circle" size={22} color="#15803D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.connectionBannerTitle}>
                  Connection Request Accepted 💖
                </Text>
                <Text style={styles.connectionBannerSub}>
                  You and {fullName} have accepted each other&apos;s interest.
                  You can now connect and view each other&apos;s verified
                  profile details.
                </Text>
              </View>
            </View>
          )}

          {!!introduction && (
            <Section icon="document-text-outline" title="About Me">
              <Text style={styles.bodyText}>{introduction}</Text>
            </Section>
          )}

          {basicRows.length > 0 && (
            <Section icon="person-circle-outline" title="Basic Information">
              <RowsBlock rows={basicRows} />
            </Section>
          )}

          {galleryOnly.length > 0 && (
            <Section
              icon="images-outline"
              title={`Photo Gallery (${galleryOnly.length})`}
            >
              <View style={styles.galleryGrid}>
                {galleryOnly.map((u, i) => (
                  <TouchableOpacity
                    key={`${u}_${i}`}
                    activeOpacity={0.85}
                    onPress={() => openViewer(galleryOnly, i)}
                    style={styles.galleryCell}
                  >
                    <Image
                      source={{ uri: u }}
                      style={styles.galleryThumb}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </Section>
          )}

          {education.length > 0 && (
            <Section icon="school-outline" title="Education">
              {education.map((e, i) => (
                <View
                  key={e.id || i}
                  style={[
                    styles.timelineItem,
                    i === education.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={styles.timelineTitle}>
                    {e.degree || "Degree"}
                  </Text>
                  {!!e.institution && (
                    <Text style={styles.timelineSub}>{e.institution}</Text>
                  )}
                  {!!periodText(e) && (
                    <Text style={styles.timelinePeriod}>{periodText(e)}</Text>
                  )}
                </View>
              ))}
            </Section>
          )}

          {career.length > 0 && (
            <Section icon="briefcase-outline" title="Career">
              {career.map((c, i) => (
                <View
                  key={c.id || i}
                  style={[
                    styles.timelineItem,
                    i === career.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={styles.timelineTitle}>
                    {c.designation || c.title || c.position || "Profession"}
                  </Text>
                  {!!(c.company || c.organization || c.company_name) && (
                    <Text style={styles.timelineSub}>
                      {c.company || c.organization || c.company_name}
                    </Text>
                  )}
                  {!!periodText(c) && (
                    <Text style={styles.timelinePeriod}>{periodText(c)}</Text>
                  )}
                </View>
              ))}
            </Section>
          )}

          {languageChips.length > 0 && (
            <Section icon="language-outline" title="Languages">
              <View style={styles.chipsWrap}>
                {languageChips.map((c) => (
                  <View
                    key={c.text}
                    style={[styles.chip, c.primary && styles.chipPrimary]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        c.primary && styles.chipTextPrimary,
                      ]}
                    >
                      {c.text}
                      {c.primary ? " (Mother tongue)" : ""}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {GENERIC_SECTIONS.map((s) => (
            <GenericSection
              key={s.key}
              icon={s.icon}
              title={s.title}
              sectionDef={s}
              profile={profile}
              lookupMaps={lookupMaps}
            />
          ))}

          {matchRows.length > 0 && (
            <Section icon="sparkles-outline" title="Compatibility">
              <RowsBlock rows={matchRows} />
            </Section>
          )}

          {/* Contact Details Section */}
          <Section icon="call-outline" title="Contact Details">
            {isContactUnlocked ? (
              <View style={styles.contactUnlockedCard}>
                <View style={styles.contactStatusRow}>
                  <View style={styles.contactStatusBadge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={15}
                      color="#15803D"
                    />
                    <Text style={styles.contactStatusBadgeText}>
                      Contact Unlocked ✓
                    </Text>
                  </View>
                  <Text style={styles.contactQuotaText}>
                    {remainingContacts} views left
                  </Text>
                </View>

                {/* Phone number row */}
                <View style={styles.contactItemRow}>
                  <View style={styles.contactIconWrap}>
                    <Ionicons name="call" size={18} color="#15803D" />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={styles.contactItemLabel}>Phone Number</Text>
                    <Text style={styles.contactItemValue}>{displayPhone}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.contactActionBtn}
                    onPress={() =>
                      Linking.openURL(`tel:${displayPhone.replace(/\s+/g, "")}`)
                    }
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call" size={14} color="#fff" />
                    <Text style={styles.contactActionBtnText}>Call</Text>
                  </TouchableOpacity>
                </View>

                {/* Email address row */}
                <View
                  style={[
                    styles.contactItemRow,
                    { borderBottomWidth: 0, paddingBottom: 0 },
                  ]}
                >
                  <View
                    style={[
                      styles.contactIconWrap,
                      { backgroundColor: "#EFF6FF" },
                    ]}
                  >
                    <Ionicons name="mail" size={18} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={styles.contactItemLabel}>Email Address</Text>
                    <Text style={styles.contactItemValue} numberOfLines={1}>
                      {displayEmail}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.contactActionBtn,
                      { backgroundColor: "#2563EB" },
                    ]}
                    onPress={() => Linking.openURL(`mailto:${displayEmail}`)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="mail" size={14} color="#fff" />
                    <Text style={styles.contactActionBtnText}>Email</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.contactFooterNote}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={13}
                    color="#166534"
                  />
                  <Text style={styles.contactFooterNoteText}>
                    Verified contact details unlocked through your{" "}
                    {activePlanInfo?.name || "Silver Plan"}.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.contactLockedCard}>
                <View style={styles.contactLockedHeader}>
                  <View style={styles.contactLockIcon}>
                    <Ionicons
                      name="lock-closed"
                      size={20}
                      color={COLORS.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactLockedTitle}>
                      Contact Details Protected
                    </Text>
                    <Text style={styles.contactLockedSub}>
                      Reveal verified phone number & email address.
                    </Text>
                  </View>
                </View>

                {/* Masked preview */}
                <View style={styles.contactMaskedBox}>
                  <View style={styles.contactMaskedRow}>
                    <Ionicons name="call-outline" size={16} color="#94A3B8" />
                    <Text style={styles.contactMaskedLabel}>Phone:</Text>
                    <Text style={styles.contactMaskedValue}>
                      +91 ••••• •••••
                    </Text>
                  </View>
                  <View style={[styles.contactMaskedRow, { marginTop: 6 }]}>
                    <Ionicons name="mail-outline" size={16} color="#94A3B8" />
                    <Text style={styles.contactMaskedLabel}>Email:</Text>
                    <Text style={styles.contactMaskedValue}>
                      ••••••••@•••••.com
                    </Text>
                  </View>
                </View>

                {/* Quota info */}
                <View style={styles.contactQuotaBanner}>
                  <Ionicons
                    name="ribbon-outline"
                    size={15}
                    color={COLORS.primary}
                  />
                  <Text style={styles.contactQuotaBannerText}>
                    {remainingContacts > 0
                      ? `${remainingContacts} of ${activePlanInfo?.maxContacts || 30} Contact Views Remaining (${activePlanInfo?.name || "Silver Plan"})`
                      : "0 Contact Views Remaining. Upgrade to view contacts."}
                  </Text>
                </View>

                {/* View Contact Button */}
                <TouchableOpacity
                  style={[
                    styles.viewContactBtn,
                    (activePlanInfo?.key === "free" ||
                      remainingContacts <= 0) &&
                      styles.viewContactBtnUpgrade,
                  ]}
                  onPress={handleViewContact}
                  disabled={unlockingContact}
                  activeOpacity={0.85}
                >
                  {unlockingContact ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name={
                          activePlanInfo?.key === "free" ||
                          remainingContacts <= 0
                            ? "diamond"
                            : "call"
                        }
                        size={17}
                        color="#fff"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.viewContactBtnText}>
                        {activePlanInfo?.key === "free"
                          ? "Upgrade Plan to View Contact 💎"
                          : remainingContacts <= 0
                            ? "Renew Plan to View Contact 💎"
                            : "View Contact Details (1 Credit)"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </Section>
        </ScrollView>
      )}

      {/* Sticky action bar */}
      {!showInitialLoader && !showError && (
        <View
          style={[
            styles.actionBar,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {/* Shortlist */}
          <TouchableOpacity
            style={[styles.iconAction, shortlisted && styles.iconActionActive]}
            onPress={handleShortlist}
            disabled={busy === "shortlist"}
            activeOpacity={0.8}
          >
            {busy === "shortlist" ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons
                name={shortlisted ? "star" : "star-outline"}
                size={22}
                color={shortlisted ? "#B45309" : "#64748B"}
              />
            )}
          </TouchableOpacity>

          {/* Interest (primary action) */}
          <TouchableOpacity
            style={[
              styles.interestBtn,
              isAccepted
                ? styles.interestBtnAccepted
                : interestSent && styles.interestBtnSent,
            ]}
            onPress={handleInterest}
            disabled={busy === "interest"}
            activeOpacity={0.85}
          >
            {busy === "interest" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <View style={styles.interestIconWrap}>
                  <Ionicons
                    name={
                      isAccepted
                        ? "checkmark-done"
                        : interestSent
                          ? "checkmark"
                          : "heart"
                    }
                    size={16}
                    color="#fff"
                  />
                </View>
                <Text style={styles.interestBtnText} numberOfLines={1}>
                  {isAccepted
                    ? "Interest Accepted"
                    : interestSent
                      ? "Interest Sent"
                      : "Send Interest"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Ignore */}
          <TouchableOpacity
            style={[styles.iconAction, ignored && styles.iconActionDanger]}
            onPress={handleIgnore}
            disabled={busy === "ignore"}
            activeOpacity={0.8}
          >
            {busy === "ignore" ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Ionicons
                name={ignored ? "ban" : "ban-outline"}
                size={22}
                color={ignored ? "#DC2626" : "#64748B"}
              />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Full-screen image viewer */}
      <Modal
        visible={viewerOpen}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={styles.viewerRoot}>
          <FlatList
            data={viewerList}
            keyExtractor={(u, i) => `${u}_${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewerStart}
            getItemLayout={(_, i) => ({
              length: SCREEN_W,
              offset: SCREEN_W * i,
              index: i,
            })}
            onMomentumScrollEnd={(e) =>
              setViewerPos(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
            }
            renderItem={({ item }) => (
              <View style={styles.viewerPage}>
                <Image
                  source={{ uri: item }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              </View>
            )}
          />
          <View style={[styles.viewerTop, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.viewerCounter}>
              {viewerPos + 1} / {viewerList.length}
            </Text>
            <TouchableOpacity
              style={styles.viewerClose}
              onPress={() => setViewerOpen(false)}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  topBarSafe: { backgroundColor: "#fff" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1E8E2",
  },
  topBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginHorizontal: 6,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  centerText: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 19,
  },
  errorTitle: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: "#DC2626",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  retryText: { fontSize: 13, fontFamily: FONTS.semiBold, color: "#fff" },

  hero: { width: SCREEN_W, height: HERO_H, backgroundColor: "#FFF1F2" },
  heroImage: { width: SCREEN_W, height: HERO_H },
  heroShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  heroPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FCE7F3",
  },
  heroPlaceholderText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  dots: {
    position: "absolute",
    bottom: 36,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  dotActive: { width: 18, backgroundColor: "#fff" },
  countPill: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countPillText: { fontSize: 11, fontFamily: FONTS.semiBold, color: "#fff" },

  identityCard: {
    backgroundColor: "#fff",
    marginHorizontal: 14,
    marginTop: -28,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F1E8E2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  name: { fontSize: 21, fontFamily: FONTS.bold, color: COLORS.text },
  age: { fontSize: 16, fontFamily: FONTS.medium, color: COLORS.textLight },
  identityMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  codePill: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  codePillText: {
    fontSize: 11.5,
    fontFamily: FONTS.semiBold,
    color: "#475569",
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  verifiedPillText: {
    fontSize: 11.5,
    fontFamily: FONTS.semiBold,
    color: "#15803D",
  },
  premiumPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E11D48",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  premiumPillText: {
    fontSize: 11.5,
    fontFamily: FONTS.semiBold,
    color: "#fff",
  },

  factsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  factChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
    backgroundColor: "#FFF1F2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  factChipText: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },

  section: {
    backgroundColor: "#fff",
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F1E8E2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F8F1ED",
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 15.5, fontFamily: FONTS.bold, color: COLORS.text },
  bodyText: {
    fontSize: 13.5,
    fontFamily: FONTS.regular,
    color: "#334155",
    lineHeight: 21,
    marginTop: 4,
  },
  subBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
    gap: 16,
  },
  rowLabel: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    flexShrink: 0,
  },
  rowValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },

  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  galleryCell: {
    width: (SCREEN_W - 28 - 36 - 16) / 3,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFF1F2",
  },
  galleryThumb: { width: "100%", height: "100%" },

  timelineItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  timelineTitle: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.text },
  timelineSub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: "#475569",
    marginTop: 2,
  },
  timelinePeriod: {
    fontSize: 11.5,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    marginTop: 3,
  },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    backgroundColor: "#FAF5F2",
    borderWidth: 1,
    borderColor: "#EAE0DA",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.text },
  chipTextPrimary: { color: "#fff", fontFamily: FONTS.semiBold },

  lockedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  lockedText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    lineHeight: 18,
  },

  /* Contact section styles */
  contactUnlockedCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  contactStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#DCFCE7",
  },
  contactStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  contactStatusBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: "#15803D",
  },
  contactQuotaText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: "#166534",
  },
  contactItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#DCFCE7",
  },
  contactIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  contactItemLabel: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: "#166534",
    textTransform: "uppercase",
  },
  contactItemValue: {
    fontSize: 14.5,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginTop: 2,
  },
  contactActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#15803D",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  contactActionBtnText: {
    fontSize: 12.5,
    fontFamily: FONTS.bold,
    color: "#fff",
  },
  contactFooterNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#DCFCE7",
  },
  contactFooterNoteText: {
    flex: 1,
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: "#166534",
    lineHeight: 15,
  },

  contactLockedCard: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  contactLockedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  contactLockIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
  },
  contactLockedTitle: {
    fontSize: 14.5,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  contactLockedSub: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 2,
  },
  contactMaskedBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FED7AA",
    marginBottom: 10,
  },
  contactMaskedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contactMaskedLabel: {
    fontSize: 12.5,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    width: 50,
  },
  contactMaskedValue: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: "#94A3B8",
    letterSpacing: 1.5,
  },
  contactQuotaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF1F2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  contactQuotaBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  viewContactBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  viewContactBtnUpgrade: {
    backgroundColor: "#7C3AED",
    shadowColor: "#7C3AED",
  },
  viewContactBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: "#fff",
  },
  iconActionUnlocked: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },

  /* Sticky action bar */
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: "#F1E8E2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 14,
  },
  iconAction: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  iconActionActive: { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" },
  iconActionDanger: { backgroundColor: "#FEE2E2", borderColor: "#FECACA" },
  interestBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
  interestBtnSent: {
    backgroundColor: "#15803D",
    shadowColor: "#15803D",
  },
  interestBtnAccepted: {
    backgroundColor: "#15803D",
    shadowColor: "#15803D",
  },
  interestIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    flexShrink: 0,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  interestBtnText: {
    flexShrink: 1,
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: "#fff",
    letterSpacing: 0.2,
  },

  viewerRoot: { flex: 1, backgroundColor: "#000" },
  viewerPage: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: { width: SCREEN_W, height: SCREEN_H * 0.85 },
  viewerTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  viewerCounter: { fontSize: 14, fontFamily: FONTS.semiBold, color: "#fff" },
  viewerClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  connectionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 2,
  },
  connectionBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#BBF7D0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  connectionBannerTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: "#166534",
  },
  connectionBannerSub: {
    fontSize: 11.5,
    fontFamily: FONTS.regular,
    color: "#15803D",
    marginTop: 3,
    lineHeight: 16,
  },
});
