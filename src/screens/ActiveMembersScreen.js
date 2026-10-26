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
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { ActiveMembersSkeleton } from "../components/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import activeMemberService from "../services/activeMemberService";
import profileService from "../services/profileService";
import memberStateService from "../services/memberStateService";
import { useNavigation } from "@react-navigation/native";
import {
  subscribeMemberAction,
  emitMemberAction,
} from "../services/memberEvents";
import { COLORS, FONTS, DEFAULT_AVATAR } from "../theme";

const PAGE_SIZE = 10;
const CACHE_MEMBERS_KEY = "@hm_active_members_feed";
const CACHE_SETTINGS_KEY = "@hm_profile_settings_cache_v2";

const PICK_KEYS = {
  countries: ["id", "name"],
  states: ["id", "name", "country_id"],
  cities: ["id", "name", "state_id"],
  religions: ["id", "name"],
  castes: ["id", "name", "religion_id"],
  sub_castes: ["id", "name", "caste_id"],
  family_values: ["id", "name"],
  marital_statuses: ["id", "name"],
  on_behalves: ["id", "name"],
  languages: ["id", "name"],
};

/**
 * GET /member/profile-settings is ~7.5 MB (47k cities, 4k states, with
 * timestamps on every row). Keep only the fields we use so it stays light in
 * memory.
 */
function slimSettings(res) {
  if (!res) return null;
  const out = {
    result: res.result,
    member: { id: res.member?.id, gender: res.member?.gender },
  };
  Object.keys(PICK_KEYS).forEach((key) => {
    const keys = PICK_KEYS[key];
    out[key] = Array.isArray(res[key])
      ? res[key].map((row) => {
          const o = {};
          keys.forEach((k) => {
            o[k] = row[k];
          });
          return o;
        })
      : [];
  });
  return out;
}

const byName = (a, b) => {
  const sa = String(a?.name || "");
  const sb = String(b?.name || "");
  return sa < sb ? -1 : sa > sb ? 1 : 0;
};

function groupBy(list, key) {
  const map = {};
  if (!Array.isArray(list)) return map;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const k = String(item[key]);
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

function labelOf(options, id) {
  if (id === "" || id === null || id === undefined) return "";
  const found = (options || []).find((o) => String(o.id) === String(id));
  return found ? found.name : "";
}

/**
 * Dropdown-style field. Tapping it opens the PickerSheet (with search).
 */
function SelectField({
  value,
  placeholder,
  disabled,
  onPress,
  onClear,
  loading,
}) {
  return (
    <TouchableOpacity
      style={[styles.selectField, disabled && styles.selectFieldDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.selectFieldText,
          !value && styles.selectFieldPlaceholder,
          disabled && styles.selectFieldTextDisabled,
        ]}
        numberOfLines={1}
      >
        {value || placeholder}
      </Text>
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : value && onClear && !disabled ? (
        <TouchableOpacity
          onPress={onClear}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
        </TouchableOpacity>
      ) : (
        <Ionicons
          name="chevron-down"
          size={18}
          color={disabled ? "#CBD5E1" : COLORS.textLight}
        />
      )}
    </TouchableOpacity>
  );
}

/**
 * Full-height sheet with a search box + virtualized list (handles 5k+ cities).
 */
function PickerSheet({ picker, onClose }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const data = useMemo(() => {
    const options = picker.options || [];
    if (!q) return options;
    const starts = [];
    const contains = [];
    options.forEach((o) => {
      const name = String(o.name || "").toLowerCase();
      if (name.startsWith(q)) starts.push(o);
      else if (name.includes(q)) contains.push(o);
    });
    return starts.concat(contains);
  }, [picker.options, q]);

  const selected = String(picker.selectedId ?? "");

  return (
    <View style={styles.pickerOverlay}>
      <View style={styles.pickerHeader}>
        <TouchableOpacity onPress={onClose} style={styles.pickerBackBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.pickerTitle}>{picker.title}</Text>
          <Text style={styles.pickerSubtitle}>
            {(picker.options || []).length} options
          </Text>
        </View>
      </View>

      <View style={styles.pickerSearchWrap}>
        <Ionicons name="search" size={16} color={COLORS.textLight} />
        <TextInput
          style={styles.pickerSearchInput}
          placeholder={`Search ${picker.title.toLowerCase()}...`}
          placeholderTextColor={COLORS.textLight}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={16} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={data}
        keyExtractor={(item, index) =>
          String(item?.id ?? item?.name ?? `opt_${index}`)
        }
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        maxToRenderPerBatch={30}
        windowSize={7}
        contentContainerStyle={styles.pickerListContent}
        ListHeaderComponent={
          !q ? (
            <TouchableOpacity
              style={[
                styles.pickerRow,
                selected === "" && styles.pickerRowActive,
              ]}
              onPress={() => {
                picker.onSelect("");
                onClose();
              }}
            >
              <Text
                style={[
                  styles.pickerRowText,
                  selected === "" && styles.pickerRowTextActive,
                ]}
              >
                {picker.anyLabel || "Any"}
              </Text>
              {selected === "" && (
                <Ionicons name="checkmark" size={18} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => {
          const active = String(item.id) === selected;
          return (
            <TouchableOpacity
              style={[styles.pickerRow, active && styles.pickerRowActive]}
              onPress={() => {
                picker.onSelect(String(item.id));
                onClose();
              }}
            >
              <Text
                style={[
                  styles.pickerRowText,
                  active && styles.pickerRowTextActive,
                ]}
              >
                {item.name}
              </Text>
              {active && (
                <Ionicons name="checkmark" size={18} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.pickerEmpty}>
            {(picker.options || []).length === 0
              ? picker.emptyText || "No options available."
              : "No matches found."}
          </Text>
        }
      />
    </View>
  );
}

/**
 * Determine opposite gender based on user gender
 */
function normalizeGender(genderValue) {
  if (genderValue === null || genderValue === undefined) {
    return "";
  }

  const gender = String(genderValue).trim().toLowerCase();

  if (["female", "f", "2", "woman", "women", "girl"].includes(gender)) {
    return "Female";
  }

  if (["male", "m", "1", "man", "men", "boy"].includes(gender)) {
    return "Male";
  }

  return "";
}

function resolveOppositeGender(genderValue) {
  const gender = normalizeGender(genderValue);

  if (gender === "Female") return "Male";
  if (gender === "Male") return "Female";

  return "Male";
}

/**
 * Helper to resolve an ID or string to a human-readable name from lookup map
 */
function resolveName(value, map) {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value).trim().replace(/,\s*$/, "");
  if (map && map[str]) return map[str];
  const num = Number(str);
  if (!isNaN(num) && map && map[num]) return map[num];
  return str;
}

/**
 * Smart Pagination Range Generator
 * Fits screen width without skipping pages:
 * If totalPages <= 7: shows all pages
 * Near start (currentPage <= 4): [1, 2, 3, 4, 5, "...", totalPages]
 * Near end: [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
 * Middle:   [1, "...", current - 1, current, current + 1, "...", totalPages]
 */
function getPaginationRange(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

/**
 * Smart extractor for paginated response from POST /api/member/member-listing?page=...
 * Supports all Laravel LengthAwarePaginator, ResourceCollection, and custom wrapper shapes
 */

function extractPaginationData(response) {
  if (!response) {
    return {
      rawMembers: [],
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      perPage: 10,
    };
  }

  // Your API response structure:
  // response.data.members.data
  const root =
    response.data && typeof response.data === "object" ? response.data : {};

  const membersWrapper = root.members;

  // Support the actual API response and other common response formats.
  let rawMembers = [];

  if (Array.isArray(membersWrapper)) {
    rawMembers = membersWrapper;
  } else if (membersWrapper && Array.isArray(membersWrapper.data)) {
    rawMembers = membersWrapper.data;
  } else if (Array.isArray(root.data)) {
    rawMembers = root.data;
  } else if (Array.isArray(root.users)) {
    rawMembers = root.users;
  } else if (Array.isArray(root.profiles)) {
    rawMembers = root.profiles;
  } else if (Array.isArray(root.records)) {
    rawMembers = root.records;
  } else if (Array.isArray(root.items)) {
    rawMembers = root.items;
  } else if (Array.isArray(response.data)) {
    rawMembers = response.data;
  } else if (Array.isArray(response.members)) {
    rawMembers = response.members;
  } else if (Array.isArray(response.users)) {
    rawMembers = response.users;
  } else if (Array.isArray(response.profiles)) {
    rawMembers = response.profiles;
  } else if (Array.isArray(response.records)) {
    rawMembers = response.records;
  } else if (Array.isArray(response.items)) {
    rawMembers = response.items;
  } else if (Array.isArray(response)) {
    rawMembers = response;
  }

  // Pagination can be nested inside data.members.meta.
  const meta =
    membersWrapper &&
    typeof membersWrapper === "object" &&
    !Array.isArray(membersWrapper)
      ? membersWrapper.meta || {}
      : {};

  const currentPage = Number(
    meta.current_page ??
      membersWrapper?.current_page ??
      root.current_page ??
      response.current_page ??
      response.meta?.current_page ??
      root.page ??
      response.page ??
      1,
  );

  const perPage = Number(
    meta.per_page ??
      membersWrapper?.per_page ??
      root.per_page ??
      response.per_page ??
      response.meta?.per_page ??
      10,
  );

  const totalItems = Number(
    meta.total ??
      membersWrapper?.total ??
      root.total ??
      response.total ??
      response.meta?.total ??
      rawMembers.length,
  );

  let totalPages = Number(
    meta.last_page ??
      membersWrapper?.last_page ??
      root.last_page ??
      response.last_page ??
      response.meta?.last_page ??
      root.total_pages ??
      response.total_pages ??
      (totalItems > 0 ? Math.ceil(totalItems / (perPage || 10)) : 1),
  );

  if (!Number.isFinite(totalPages) || totalPages < 1) {
    totalPages = 1;
  }

  return {
    rawMembers,
    currentPage:
      Number.isFinite(currentPage) && currentPage >= 1 ? currentPage : 1,
    totalPages,
    totalItems: Number.isFinite(totalItems) ? totalItems : rawMembers.length,
    perPage: Number.isFinite(perPage) && perPage >= 1 ? perPage : 10,
  };
}

/**
 * Normalizes member item from POST /api/member/member-listing
 */
function formatLiveMember(item, index) {
  if (!item) return null;
  const id =
    item.id ||
    item.user_id ||
    item.userId ||
    item.member_id ||
    item.memberId ||
    item.code ||
    (typeof index === "number"
      ? index + 1
      : Math.random().toString(36).slice(2));
  const rawName = item.name
    ? String(item.name).trim()
    : `${item.first_name || ""} ${item.last_name || ""}`.trim();
  const name = rawName || `Member ${item.code || item.member_code || id}`;
  const rawPhoto =
    item.photo ||
    item.avatar ||
    item.avatar_original ||
    item.profile_image ||
    "";
  const photoStr = String(rawPhoto).trim();
  const isValidPhoto =
    photoStr && photoStr !== "null" && photoStr !== "undefined";
  const finalPhoto = isValidPhoto ? photoStr : DEFAULT_AVATAR;

  const rawCity =
    typeof item.city === "object"
      ? item.city?.name
      : item.city_name || (typeof item.city === "string" ? item.city : "");
  const rawState =
    typeof item.state === "object"
      ? item.state?.name
      : item.state_name || (typeof item.state === "string" ? item.state : "");
  const rawCountry =
    typeof item.country === "object"
      ? item.country?.name
      : item.country_name ||
        (typeof item.country === "string" ? item.country : item.country_id);

  const loc =
    [rawCity, rawState, typeof rawCountry === "string" ? rawCountry : ""]
      .filter((v) => v && typeof v === "string" && v.trim())
      .join(", ") ||
    item.location ||
    "";

  const resolvedCode = memberStateService.resolveMemberCode(item);
  const isAccepted = Boolean(id && memberStateService.isInterestAccepted(id));

  return {
    id: id,
    userId: id,
    name: name,
    memberId:
      resolvedCode ||
      String(item.code || item.member_code || item.member_id || `HM-${id}`),
    photo: finalPhoto,
    photoUrl: photoStr,
    plan: memberStateService.resolvePlan(item),
    isAccepted,
    onlineStatus: "Active Now",
    verified: true,
    age: item.age || item.birthday || 26,
    height: item.height
      ? String(item.height).includes("ft")
        ? item.height
        : `${item.height} ft`
      : null,
    rawReligion: item.religion_id || item.religion,
    rawCaste: item.caste_id || item.caste,
    rawMaritalStatus:
      item.marital_status_id?.id ||
      item.marital_status_id ||
      item.marital_status,
    rawCountry: item.country_id || rawCountry,
    rawState: item.state_id || rawState,
    rawCity: item.city_id || rawCity,
    city: rawCity,
    state: rawState,
    location: loc,
    rawMotherTongue: item.mothere_tongue || item.mother_tongue,
    career: item.profession || item.career || "Professional",
    about:
      "Looking for an educated, caring life partner with strong cultural values and mutual respect.",
    interestSent: false,
    shortlisted: false,
    ignored: false,
  };
}

export default function ActiveMembersScreen() {
  const { user, token, updateUser } = useAuth();
  const scrollRef = useRef(null);
  const navigation = useNavigation();

  // Storage keys for persisting user actions
  const SENT_INTERESTS_KEY = useMemo(
    () => `@hm_sent_interests_${user?.id || "default"}`,
    [user?.id],
  );
  const SHORTLIST_STORAGE_KEY = useMemo(
    () => `@hm_shortlist_ids_${user?.id || "default"}`,
    [user?.id],
  );

  // Detected logged-in user gender & opposite gender
  const [detectedUserGender, setDetectedUserGender] = useState(
    () => normalizeGender(user?.gender) || "Female",
  );
  const [inferredMatchGender, setInferredMatchGender] = useState("");

  const effectiveUserGender =
    normalizeGender(user?.gender) || detectedUserGender;

  const targetOppositeGender = useMemo(() => {
    if (inferredMatchGender) return inferredMatchGender;
    return resolveOppositeGender(effectiveUserGender);
  }, [inferredMatchGender, effectiveUserGender]);

  // Live Member List & Server-Side Pagination State
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(token));
  const [pageLoading, setPageLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(PAGE_SIZE);

  // Filter Settings from GET /member/profile-settings
  const [serverFilterSettings, setServerFilterSettings] = useState(null);
  const [syncingFilter, setSyncingFilter] = useState(false);

  // Active Applied Server Filters
  const [appliedFilters, setAppliedFilters] = useState({});

  // Network & Verification Error Handling
  const [emailUnverified, setEmailUnverified] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Search Query (Client Live Filtering + Optional Server Member Code Search)
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Filters (aligned with POST /member/member-listing?page=... payload)
  const [filterMemberCode, setFilterMemberCode] = useState("");
  const [filterAgeFrom, setFilterAgeFrom] = useState("");
  const [filterAgeTo, setFilterAgeTo] = useState("");
  const [filterMaritalStatusId, setFilterMaritalStatusId] = useState("");
  const [filterReligionId, setFilterReligionId] = useState("");
  const [filterCasteId, setFilterCasteId] = useState("");
  const [filterSubCasteId, setFilterSubCasteId] = useState("");

  const [filterCountryId, setFilterCountryId] = useState("");
  const [filterStateId, setFilterStateId] = useState("");
  const [filterCityId, setFilterCityId] = useState("");

  // Currently open dropdown (searchable picker) inside the filter modal
  const [picker, setPicker] = useState(null);

  const [filterMotherTongue, setFilterMotherTongue] = useState("");
  const [filterProfession, setFilterProfession] = useState("");
  const [filterMinHeight, setFilterMinHeight] = useState("");
  const [filterMaxHeight, setFilterMaxHeight] = useState("");
  const [filterMemberType, setFilterMemberType] = useState("");

  // Modals
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Member Action State (Interest, Shortlist, Ignore)
  const [interestSentMap, setInterestSentMap] = useState({});
  const [shortlistMap, setShortlistMap] = useState({});
  const [ignoredMap, setIgnoredMap] = useState({});

  // Build lookup maps from server profile-settings (ID -> Name)
  const lookupMaps = useMemo(() => {
    const religions = {};
    const castes = {};
    const maritalStatuses = {};
    const countries = {};
    const languages = {};

    if (serverFilterSettings) {
      (serverFilterSettings.religions || []).forEach((r) => {
        religions[r.id] = r.name;
      });
      (serverFilterSettings.castes || []).forEach((c) => {
        castes[c.id] = c.name;
      });
      (serverFilterSettings.marital_statuses || []).forEach((m) => {
        maritalStatuses[m.id] = m.name;
      });
      (serverFilterSettings.countries || []).forEach((co) => {
        countries[co.id] = co.name;
      });
      (serverFilterSettings.languages || []).forEach((l) => {
        languages[l.id] = l.name;
      });
    }

    return { religions, castes, maritalStatuses, countries, languages };
  }, [serverFilterSettings]);

  // Apply (slimmed) profile settings + detect user gender
  const applySettings = useCallback((res) => {
    const slim = slimSettings(res);
    if (!slim) return;
    setServerFilterSettings(slim);
    // states/cities are huge – keep them in memory only, cache the small lists
    AsyncStorage.setItem(
      CACHE_SETTINGS_KEY,
      JSON.stringify({ ...slim, states: [], cities: [] }),
    ).catch(() => {});
    const apiGender = normalizeGender(slim.member?.gender);

    if (apiGender) {
      setDetectedUserGender(apiGender);
    }
  }, []);

  // Dependent-dropdown indexes built once per settings load
  const statesByCountry = useMemo(
    () => groupBy(serverFilterSettings?.states, "country_id"),
    [serverFilterSettings?.states],
  );
  const citiesByState = useMemo(
    () => groupBy(serverFilterSettings?.cities, "state_id"),
    [serverFilterSettings?.cities],
  );

  const filterOptions = useMemo(() => {
    const settings = serverFilterSettings || {};
    const sorted = (list) => [...(list || [])].sort(byName);

    const maritalStatuses = settings.marital_statuses?.length
      ? settings.marital_statuses
      : [
          { id: 4, name: "Never Married" },
          { id: 1, name: "Divorced" },
          { id: 2, name: "Awaiting Divorce" },
          { id: 3, name: "Widower" },
        ];
    const religions = settings.religions?.length
      ? settings.religions
      : [{ id: 1, name: "Hindu" }];
    const languages = settings.languages?.length
      ? settings.languages
      : [
          { id: 1, name: "Gujrati" },
          { id: 2, name: "Hindi" },
          { id: 3, name: "Marathi" },
          { id: 4, name: "Marwari" },
          { id: 5, name: "English" },
        ];

    return {
      maritalStatuses,
      religions,
      languages,
      castes: sorted(
        (settings.castes || []).filter(
          (c) =>
            !filterReligionId ||
            String(c.religion_id) === String(filterReligionId),
        ),
      ),
      subCastes: filterCasteId
        ? sorted(
            (settings.sub_castes || []).filter(
              (sc) => String(sc.caste_id) === String(filterCasteId),
            ),
          )
        : [],
      countries: sorted(settings.countries),
      states: filterCountryId
        ? sorted(statesByCountry[String(filterCountryId)] || [])
        : [],
      cities: filterStateId
        ? sorted(citiesByState[String(filterStateId)] || [])
        : [],
    };
  }, [
    serverFilterSettings,
    statesByCountry,
    citiesByState,
    filterReligionId,
    filterCasteId,
    filterCountryId,
    filterStateId,
  ]);

  const locationDataLoading =
    !!serverFilterSettings && (serverFilterSettings.states || []).length === 0;

  // Fetch members for a specific page with server-side pagination
  const fetchMembersPage = useCallback(
    async (page = 1, filters = appliedFilters, isInitial = false) => {
      if (!token) {
        setLoading(false);
        setPageLoading(false);
        return;
      }
      if (isInitial) {
        setLoading(true);
      } else {
        setPageLoading(true);
      }
      setFetchError(null);

      try {
        const response = await activeMemberService.getMemberList(
          filters,
          page,
          token,
        );
        if (response && response.result !== false) {
          const parsed = extractPaginationData(response);
          memberStateService.registerMembers(parsed.rawMembers);
          const formatted = parsed.rawMembers
            .map(formatLiveMember)
            .filter(Boolean);
          setMembers(formatted);

          // Infer match gender from returned members
          for (const rawM of parsed.rawMembers) {
            const mg = normalizeGender(
              rawM?.gender ||
                rawM?.gender_text ||
                rawM?.sex ||
                rawM?.basic_info?.gender,
            );
            if (mg) {
              setInferredMatchGender(mg);
              setDetectedUserGender(mg === "Male" ? "Female" : "Male");
              break;
            }
          }

          setCurrentPage(parsed.currentPage || page);
          setTotalPages(Math.max(1, parsed.totalPages));
          setTotalItems(parsed.totalItems || formatted.length);
          setPerPage(parsed.perPage || PAGE_SIZE);
          setEmailUnverified(false);
          setFetchError(null);

          // Cache page 1 when default filters are active
          if (page === 1 && Object.keys(filters).length === 0) {
            AsyncStorage.setItem(
              CACHE_MEMBERS_KEY,
              JSON.stringify({
                members: formatted,
                totalPages: parsed.totalPages,
                totalItems: parsed.totalItems,
                perPage: parsed.perPage,
              }),
            ).catch(() => {});
          }
        }
      } catch (err) {
        console.log("Fetch member listing error:", err?.message);
        if (/not verified/i.test(err?.message)) {
          setEmailUnverified(true);
        } else {
          setFetchError(err?.message || "Failed to load active members");
        }
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    },
    [token, appliedFilters],
  );

  // Keep reference to latest fetchMembersPage for initial mount sync
  const fetchMembersPageRef = useRef(fetchMembersPage);
  useEffect(() => {
    fetchMembersPageRef.current = fetchMembersPage;
  }, [fetchMembersPage]);

  // Fetch live user profile to ensure up-to-date gender and details
  useEffect(() => {
    if (!token || !user?.id) return;
    profileService
      .getProfile(user.id, token)
      .then((res) => {
        const liveGender = normalizeGender(
          res?.data?.basic_info?.gender || res?.data?.member?.gender,
        );
        if (liveGender) {
          setDetectedUserGender(liveGender);
          updateUser({ gender: liveGender });
        }
      })
      .catch(() => {});
  }, [token, user?.id, updateUser]);

  // 1. Initial Load: Instant AsyncStorage Cache + Background Live Sync
  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    // STEP A: Fetch Profile Settings independently in background (never blocks member cards)
    activeMemberService
      .getProfileSettings(token)
      .then((res) => {
        if (isMounted && res && res.result !== false) {
          applySettings(res);
        }
      })
      .catch((err) => {
        console.log("Profile settings fetch notice:", err?.message);
      });

    // STEP B: Read from Cache for Instant 0ms Load & Fetch Live Members
    (async () => {
      let hasCachedMembers = false;
      try {
        const [
          cachedMembersRaw,
          cachedSettingsRaw,
          savedInterestsRaw,
          savedShortlistsRaw,
        ] = await Promise.all([
          AsyncStorage.getItem(CACHE_MEMBERS_KEY),
          AsyncStorage.getItem(CACHE_SETTINGS_KEY),
          AsyncStorage.getItem(SENT_INTERESTS_KEY),
          AsyncStorage.getItem(SHORTLIST_STORAGE_KEY),
        ]);

        if (isMounted) {
          if (savedInterestsRaw) {
            try {
              const parsedInterests = JSON.parse(savedInterestsRaw);
              if (parsedInterests && typeof parsedInterests === "object") {
                setInterestSentMap((prev) => ({ ...parsedInterests, ...prev }));
              }
            } catch {}
          }

          if (savedShortlistsRaw) {
            try {
              const parsedShortlists = JSON.parse(savedShortlistsRaw);
              if (parsedShortlists && typeof parsedShortlists === "object") {
                setShortlistMap((prev) => ({ ...parsedShortlists, ...prev }));
              }
            } catch {}
          }

          if (cachedSettingsRaw) {
            const parsedSettings = JSON.parse(cachedSettingsRaw);
            // never overwrite the full live data with the slim cache
            setServerFilterSettings((prev) =>
              prev && prev.states?.length ? prev : parsedSettings,
            );
            const cachedGender = normalizeGender(parsedSettings.member?.gender);

            if (cachedGender) {
              setDetectedUserGender(cachedGender);
            }
          }

          if (cachedMembersRaw) {
            const parsed = JSON.parse(cachedMembersRaw);
            const rawList = Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed?.members)
                ? parsed.members
                : [];
            if (rawList.length > 0) {
              const formatted = rawList.map(formatLiveMember).filter(Boolean);
              setMembers(formatted);
              if (parsed?.totalPages) setTotalPages(parsed.totalPages);
              if (parsed?.totalItems) setTotalItems(parsed.totalItems);
              if (parsed?.perPage) setPerPage(parsed.perPage);
              setLoading(false);
              hasCachedMembers = true;
            }
          }
        }
      } catch {
        // Non-blocking cache error
      }

      // STEP C: Live Fetch Page 1 Data from server
      if (isMounted) {
        await fetchMembersPageRef.current(1, {}, !hasCachedMembers);
      }
    })();

    // STEP D: Fetch live shortlisted members from backend
    activeMemberService
      .getMyShortlists(token)
      .then((res) => {
        if (isMounted && res && res.result !== false && res.data) {
          const list = Array.isArray(res.data)
            ? res.data
            : res.data?.data || [];
          const sMap = {};
          list.forEach((item) => {
            const id = item.user_id || item.id || item.member_id;
            if (id) sMap[String(id)] = true;
          });
          setShortlistMap(sMap);
          AsyncStorage.setItem(
            SHORTLIST_STORAGE_KEY,
            JSON.stringify(sMap),
          ).catch(() => {});
        }
      })
      .catch(() => {});

    // STEP E: Fetch live interests sent from backend
    activeMemberService
      .getMyInterests(token)
      .then((res) => {
        if (isMounted && res && res.result !== false && res.data) {
          const list = Array.isArray(res.data)
            ? res.data
            : res.data?.data || [];
          memberStateService.syncInterestItems(list, {
            currentUserId: user?.id,
          });
          const iMap = {};
          const currentUid = user?.id ? String(user.id) : null;
          list.forEach((item) => {
            let targetId = null;
            if (item.user?.id && String(item.user.id) !== currentUid) {
              targetId = item.user.id;
            } else if (
              item.interested_to &&
              String(item.interested_to) !== currentUid
            ) {
              targetId = item.interested_to;
            } else if (item.user_id && String(item.user_id) !== currentUid) {
              targetId = item.user_id;
            }
            const rawStatus = String(
              item.status || item.interest_status || "",
            ).toLowerCase();
            const isRejected =
              rawStatus.includes("reject") ||
              rawStatus.includes("decline") ||
              item.status === 2 ||
              item.interest_status === 2;
            if (targetId && !isRejected) {
              iMap[String(targetId)] = true;
            }
          });
          setInterestSentMap(iMap);
          AsyncStorage.setItem(SENT_INTERESTS_KEY, JSON.stringify(iMap)).catch(
            () => {},
          );
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [
    token,
    user?.id,
    SENT_INTERESTS_KEY,
    SHORTLIST_STORAGE_KEY,
    applySettings,
  ]);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await Promise.allSettled([
        activeMemberService.getProfileSettings(token).then((res) => {
          if (res && res.result !== false) applySettings(res);
        }),
        user?.id &&
          profileService.getProfile(user.id, token).then((res) => {
            const liveGender = normalizeGender(
              res?.data?.basic_info?.gender || res?.data?.member?.gender,
            );
            if (liveGender) {
              setDetectedUserGender(liveGender);
              updateUser({ gender: liveGender });
            }
          }),
        activeMemberService.getMyShortlists(token).then((res) => {
          if (res && res.result !== false && res.data) {
            const list = Array.isArray(res.data)
              ? res.data
              : res.data?.data || [];
            const sMap = {};
            list.forEach((item) => {
              const id = item.user_id || item.id || item.member_id;
              if (id) sMap[String(id)] = true;
            });
            setShortlistMap(sMap);
            AsyncStorage.setItem(
              SHORTLIST_STORAGE_KEY,
              JSON.stringify(sMap),
            ).catch(() => {});
          }
        }),
        activeMemberService.getMyInterests(token).then((res) => {
          if (res && res.result !== false && res.data) {
            const list = Array.isArray(res.data)
              ? res.data
              : res.data?.data || [];
            memberStateService.syncInterestItems(list, {
              currentUserId: user?.id,
            });
            const iMap = {};
            const currentUid = user?.id ? String(user.id) : null;
            list.forEach((item) => {
              let targetId = null;
              if (item.user?.id && String(item.user.id) !== currentUid) {
                targetId = item.user.id;
              } else if (
                item.interested_to &&
                String(item.interested_to) !== currentUid
              ) {
                targetId = item.interested_to;
              } else if (item.user_id && String(item.user_id) !== currentUid) {
                targetId = item.user_id;
              }
              const rawStatus = String(
                item.status || item.interest_status || "",
              ).toLowerCase();
              const isRejected =
                rawStatus.includes("reject") ||
                rawStatus.includes("decline") ||
                item.status === 2 ||
                item.interest_status === 2;
              if (targetId && !isRejected) {
                iMap[String(targetId)] = true;
              }
            });
            setInterestSentMap(iMap);
            AsyncStorage.setItem(
              SENT_INTERESTS_KEY,
              JSON.stringify(iMap),
            ).catch(() => {});
          }
        }),
        fetchMembersPage(currentPage, appliedFilters, false),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    token,
    user?.id,
    currentPage,
    appliedFilters,
    fetchMembersPage,
    applySettings,
    updateUser,
    SENT_INTERESTS_KEY,
    SHORTLIST_STORAGE_KEY,
  ]);

  // Client-side instant search filtering on active page
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (ignoredMap[m.id]) return false;

      const resolvedReligion = resolveName(m.rawReligion, lookupMaps.religions);
      const resolvedCaste = resolveName(m.rawCaste, lookupMaps.castes);
      const resolvedCountry = resolveName(m.rawCountry, lookupMaps.countries);
      const resolvedMarital = resolveName(
        m.rawMaritalStatus,
        lookupMaps.maritalStatuses,
      );
      const resolvedMotherTongue = resolveName(
        m.rawMotherTongue,
        lookupMaps.languages,
      );

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cleanCode = q.replace(/^hm-?/i, "");
        const nameStr = String(m.name || "").toLowerCase();
        const idStr = String(m.memberId || "").toLowerCase();
        const rawIdStr = String(m.id || "").toLowerCase();
        const religionStr = String(resolvedReligion || "").toLowerCase();
        const casteStr = String(resolvedCaste || "").toLowerCase();
        const countryStr = String(resolvedCountry || "").toLowerCase();
        const cityStr = String(m.city || m.rawCity || "").toLowerCase();
        const stateStr = String(m.state || m.rawState || "").toLowerCase();
        const locationStr = String(m.location || "").toLowerCase();
        const careerStr = String(m.career || "").toLowerCase();
        const maritalStr = String(resolvedMarital || "").toLowerCase();
        const motherTongueStr = String(
          resolvedMotherTongue || "",
        ).toLowerCase();
        const ageStr = String(m.age || "");

        const matches =
          nameStr.includes(q) ||
          idStr.includes(q) ||
          rawIdStr.includes(q) ||
          (cleanCode && idStr.includes(cleanCode)) ||
          religionStr.includes(q) ||
          casteStr.includes(q) ||
          countryStr.includes(q) ||
          cityStr.includes(q) ||
          stateStr.includes(q) ||
          locationStr.includes(q) ||
          careerStr.includes(q) ||
          maritalStr.includes(q) ||
          motherTongueStr.includes(q) ||
          ageStr === q;

        if (!matches) return false;
      }

      return true;
    });
  }, [members, ignoredMap, searchQuery, lookupMaps]);

  // Handle Page Change with smooth scroll to top and server fetch
  const handlePageChange = async (newPage) => {
    if (
      newPage < 1 ||
      newPage > totalPages ||
      newPage === currentPage ||
      pageLoading
    )
      return;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    await fetchMembersPage(newPage, appliedFilters, false);
  };

  // Calculate active filter count for the badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterMemberCode.trim()) count += 1;
    if (filterAgeFrom || filterAgeTo) count += 1;
    if (filterMaritalStatusId) count += 1;
    if (filterReligionId) count += 1;
    if (filterCasteId) count += 1;
    if (filterSubCasteId.trim()) count += 1;
    if (filterCountryId) count += 1;
    if (filterStateId.trim() || filterCityId.trim()) count += 1;
    if (filterMotherTongue) count += 1;
    if (filterProfession) count += 1;
    if (filterMinHeight || filterMaxHeight) count += 1;
    if (filterMemberType !== "") count += 1;
    return count;
  }, [
    filterMemberCode,
    filterAgeFrom,
    filterAgeTo,
    filterMaritalStatusId,
    filterReligionId,
    filterCasteId,
    filterSubCasteId,
    filterCountryId,
    filterStateId,
    filterCityId,
    filterMotherTongue,
    filterProfession,
    filterMinHeight,
    filterMaxHeight,
    filterMemberType,
  ]);

  // Search Query change
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    if (
      !text &&
      (appliedFilters.member_code ||
        appliedFilters.name ||
        appliedFilters.search)
    ) {
      const nextFilters = { ...appliedFilters };
      delete nextFilters.member_code;
      delete nextFilters.name;
      delete nextFilters.search;
      setAppliedFilters(nextFilters);
      fetchMembersPage(1, nextFilters, true);
    }
  };

  // Search Submit on Keyboard
  const handleSearchSubmit = async () => {
    Keyboard.dismiss();
    const q = searchQuery.trim();
    if (!q) return;

    const cleanedCode = q.replace(/^hm-?/i, "");
    const newFilters = { ...appliedFilters };

    if (/^\d+$/.test(cleanedCode)) {
      newFilters.member_code = cleanedCode;
      delete newFilters.name;
      delete newFilters.search;
    } else {
      delete newFilters.member_code;
      newFilters.name = q;
      newFilters.search = q;
    }

    setAppliedFilters(newFilters);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    await fetchMembersPage(1, newFilters, true);
  };

  // Clear search
  const handleClearSearch = async () => {
    Keyboard.dismiss();
    setSearchQuery("");
    if (
      appliedFilters.member_code ||
      appliedFilters.name ||
      appliedFilters.search
    ) {
      const nextFilters = { ...appliedFilters };
      delete nextFilters.member_code;
      delete nextFilters.name;
      delete nextFilters.search;
      setAppliedFilters(nextFilters);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      await fetchMembersPage(1, nextFilters, true);
    }
  };

  // Apply Filter & Send Payload to POST /api/member/member-listing?page=1
  const handleApplyFilters = async () => {
    setSyncingFilter(true);

    const ageFrom = filterAgeFrom.trim() === "" ? null : Number(filterAgeFrom);

    const ageTo = filterAgeTo.trim() === "" ? null : Number(filterAgeTo);

    const minHeight =
      filterMinHeight.trim() === "" ? null : Number(filterMinHeight);

    const maxHeight =
      filterMaxHeight.trim() === "" ? null : Number(filterMaxHeight);

    if (
      (ageFrom !== null &&
        (!Number.isInteger(ageFrom) || ageFrom < 18 || ageFrom > 100)) ||
      (ageTo !== null &&
        (!Number.isInteger(ageTo) || ageTo < 18 || ageTo > 100))
    ) {
      setSyncingFilter(false);
      Alert.alert("Invalid age", "Enter an age between 18 and 100.");
      return;
    }

    if (ageFrom !== null && ageTo !== null && ageFrom > ageTo) {
      setSyncingFilter(false);
      Alert.alert(
        "Invalid age range",
        "Age From cannot be greater than Age To.",
      );
      return;
    }

    if (
      (minHeight !== null && (!Number.isFinite(minHeight) || minHeight <= 0)) ||
      (maxHeight !== null && (!Number.isFinite(maxHeight) || maxHeight <= 0))
    ) {
      setSyncingFilter(false);
      Alert.alert("Invalid height", "Enter a valid positive height.");
      return;
    }

    if (minHeight !== null && maxHeight !== null && minHeight > maxHeight) {
      setSyncingFilter(false);
      Alert.alert(
        "Invalid height range",
        "Minimum height cannot exceed maximum height.",
      );
      return;
    }

    try {
      if (token) {
        const payload = {};
        if (filterMemberCode.trim())
          payload.member_code = filterMemberCode.trim();
        if (ageFrom !== null) payload.age_from = ageFrom;
        if (ageTo !== null) payload.age_to = ageTo;
        if (filterMaritalStatusId)
          payload.marital_status = Number(filterMaritalStatusId);
        if (filterReligionId) payload.religion_id = Number(filterReligionId);
        if (filterCasteId) payload.caste_id = Number(filterCasteId);
        if (filterSubCasteId.trim())
          payload.sub_caste_id = Number(filterSubCasteId);
        if (filterCountryId) payload.country_id = Number(filterCountryId);
        if (filterStateId.trim()) payload.state_id = Number(filterStateId);
        if (filterCityId.trim()) payload.city_id = Number(filterCityId);
        if (filterMotherTongue)
          payload.mother_tongue = Number(filterMotherTongue);
        if (filterProfession.trim())
          payload.profession = filterProfession.trim();
        if (minHeight !== null) payload.min_height = minHeight;
        if (maxHeight !== null) payload.max_height = maxHeight;
        if (filterMemberType !== "")
          payload.member_type = Number(filterMemberType);

        setAppliedFilters(payload);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        await fetchMembersPage(1, payload, true);
      }
    } catch (err) {
      Alert.alert("Filter notice", err.message || "Failed to filter members");
    } finally {
      setSyncingFilter(false);
      setFilterModalVisible(false);
    }
  };

  // Reset All Filters
  const handleResetFilters = async () => {
    setFilterMemberCode("");
    setFilterAgeFrom("");
    setFilterAgeTo("");
    setFilterMaritalStatusId("");
    setFilterReligionId("");
    setFilterCasteId("");
    setFilterSubCasteId("");
    setFilterCountryId("");
    setFilterStateId("");
    setFilterCityId("");
    setPicker(null);
    setFilterMotherTongue("");
    setFilterProfession("");
    setFilterMinHeight("");
    setFilterMaxHeight("");
    setFilterMemberType("");
    setSearchQuery("");
    setAppliedFilters({});
    setFilterModalVisible(false);

    if (token) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      await fetchMembersPage(1, {}, true);
    }
  };

  // Handle Express Interest (POST /api/member/express-interest)
  const handleSendInterest = async (member) => {
    const memberUid = member.id || member.userId || member.memberId;
    const isAccepted = Boolean(
      memberUid && memberStateService.isInterestAccepted(memberUid),
    );
    if (isAccepted) {
      Alert.alert(
        "Connection Accepted 💖",
        `You and ${member.name} are already connected! Would you like to view their full profile?`,
        [
          { text: "Close", style: "cancel" },
          {
            text: "View Profile",
            onPress: () => handleViewFullProfile(member),
          },
        ],
      );
      return;
    }

    const isSent = Boolean(
      interestSentMap[String(member.id)] ||
      interestSentMap[String(member.userId)],
    );
    if (isSent) {
      Alert.alert(
        "Withdraw Interest",
        `You have expressed interest in ${member.name}. Would you like to remove/withdraw this interest?`,
        [
          { text: "Keep Interest", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setInterestSentMap((prev) => {
                const next = { ...prev };
                delete next[String(member.id)];
                delete next[String(member.userId)];
                AsyncStorage.setItem(
                  SENT_INTERESTS_KEY,
                  JSON.stringify(next),
                ).catch(() => {});
                return next;
              });
              memberStateService.setInterestStatus(member.id, null);
              memberStateService.setInterestSent(member.id, false);
              emitMemberAction({
                userId: member.id,
                type: "interest",
                value: false,
              });
              Alert.alert(
                "Interest Removed",
                `Your interest in ${member.name} has been removed.`,
              );
            },
          },
        ],
      );
      return;
    }

    try {
      const response = await activeMemberService.expressInterest(
        member.id,
        token,
      );
      setInterestSentMap((prev) => {
        const next = {
          ...prev,
          [String(member.id)]: true,
          [String(member.userId)]: true,
        };
        AsyncStorage.setItem(SENT_INTERESTS_KEY, JSON.stringify(next)).catch(
          () => {},
        );
        return next;
      });
      memberStateService.setInterestSent(member.id, true);
      emitMemberAction({ userId: member.id, type: "interest", value: true });
      Alert.alert(
        "Interest Expressed! 💖",
        response?.message || `Your interest has been sent to ${member.name}.`,
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
          err.message || "Could not express interest at this moment.",
        );
      }
    }
  };

  // Handle Shortlist (POST /api/member/add-to-shortlist & /remove-from-shortlist)
  const handleToggleShortlist = async (member) => {
    const isShortlisted = Boolean(
      shortlistMap[String(member.id)] || shortlistMap[String(member.userId)],
    );

    try {
      if (isShortlisted) {
        const res = await activeMemberService.removeFromShortlist(
          member.id,
          token,
        );
        setShortlistMap((prev) => {
          const next = {
            ...prev,
            [String(member.id)]: false,
            [String(member.userId)]: false,
          };
          AsyncStorage.setItem(
            SHORTLIST_STORAGE_KEY,
            JSON.stringify(next),
          ).catch(() => {});
          return next;
        });
        emitMemberAction({
          userId: member.id,
          type: "shortlist",
          value: false,
        });
        Alert.alert(
          "Shortlist Updated",
          res?.message || "Removed from shortlist.",
        );
      } else {
        const res = await activeMemberService.addToShortlist(member.id, token);
        setShortlistMap((prev) => {
          const next = {
            ...prev,
            [String(member.id)]: true,
            [String(member.userId)]: true,
          };
          AsyncStorage.setItem(
            SHORTLIST_STORAGE_KEY,
            JSON.stringify(next),
          ).catch(() => {});
          return next;
        });
        emitMemberAction({ userId: member.id, type: "shortlist", value: true });
        Alert.alert(
          "Shortlisted! ⭐",
          res?.message || "Member added to your shortlist.",
        );
      }
    } catch (err) {
      Alert.alert("Notice", err.message || "Could not update shortlist.");
    }
  };

  // Handle Ignore Member (POST /api/member/add-to-ignore-list)
  const handleIgnoreMember = (member) => {
    Alert.alert(
      "Ignore Profile",
      `Are you sure you want to add ${member.name} to your ignored list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Ignore",
          style: "destructive",
          onPress: async () => {
            try {
              await activeMemberService.addToIgnoreList(member.id, token);
              setIgnoredMap((prev) => ({ ...prev, [member.id]: true }));
              Alert.alert(
                "Ignored",
                `${member.name} has been added to your ignore list.`,
              );
            } catch (err) {
              Alert.alert(
                "Notice",
                err.message || "Could not ignore this member.",
              );
            }
          },
        },
      ],
    );
  };

  // Handle Report Member (POST /api/member/report-member)
  const handleReportMember = (member) => {
    Alert.alert(
      "Report Profile",
      `Would you like to report ${member.name} (ID: ${member.memberId}) for admin safety review?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit Report",
          onPress: async () => {
            try {
              const res = await activeMemberService.reportMember(
                member.id,
                "Inappropriate profile",
                token,
              );
              Alert.alert(
                "Reported",
                res?.message ||
                  "Your report has been submitted to our safety team.",
              );
            } catch (err) {
              Alert.alert("Notice", err.message || "Could not submit report.");
            }
          },
        },
      ],
    );
  };

  // Open the separate Member Profile screen (it fetches live data by id)
  const handleViewFullProfile = (member) => {
    const interestStatus = memberStateService.getInterestStatus(
      member.id || member.userId || member.memberId,
    );
    const isAccepted = interestStatus === "Accepted";
    const isRejected = interestStatus === "Rejected";
    const isSent =
      !isRejected &&
      (isAccepted ||
        Boolean(
          interestSentMap[String(member.id)] ||
          interestSentMap[String(member.userId)] ||
          memberStateService.isInterestSent(
            member.id || member.userId || member.memberId,
          ),
        ));
    const isShortlisted = Boolean(
      shortlistMap[String(member.id)] || shortlistMap[String(member.userId)],
    );

    navigation.navigate("MemberProfile", {
      userId: member.id,
      interestStatus: isAccepted
        ? "Accepted"
        : isRejected
          ? "Rejected"
          : isSent
            ? "Pending"
            : null,
      member: {
        id: member.id,
        name: member.name,
        memberId: member.memberId,
        photo: member.photo,
        age: member.age,
        plan: member.plan,
        interestSent: isSent,
        interestStatus: isAccepted
          ? "Accepted"
          : isRejected
            ? "Rejected"
            : isSent
              ? "Pending"
              : null,
        shortlisted: isShortlisted,
        summary: {
          height: member.height,
          religion: resolveName(member.rawReligion, lookupMaps.religions),
          caste: resolveName(member.rawCaste, lookupMaps.castes),
          marital: resolveName(
            member.rawMaritalStatus,
            lookupMaps.maritalStatuses,
          ),
          country: resolveName(member.rawCountry, lookupMaps.countries),
          motherTongue: resolveName(
            member.rawMotherTongue,
            lookupMaps.languages,
          ),
        },
      },
    });
  };

  // Keep list in sync with actions done on the profile screen
  useEffect(() => {
    return subscribeMemberAction(({ userId, type, value }) => {
      const uid = String(userId);
      if (type === "interest") {
        setInterestSentMap((prev) => {
          const next = { ...prev, [uid]: value };
          AsyncStorage.setItem(SENT_INTERESTS_KEY, JSON.stringify(next)).catch(
            () => {},
          );
          return next;
        });
      } else if (type === "interest_status") {
        setInterestSentMap((prev) => ({ ...prev }));
      } else if (type === "shortlist") {
        setShortlistMap((prev) => {
          const next = { ...prev, [uid]: value };
          AsyncStorage.setItem(
            SHORTLIST_STORAGE_KEY,
            JSON.stringify(next),
          ).catch(() => {});
          return next;
        });
      } else if (type === "ignore") {
        setIgnoredMap((prev) => ({ ...prev, [uid]: value }));
      }
    });
  }, [SENT_INTERESTS_KEY, SHORTLIST_STORAGE_KEY]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      {/* ---------- STICKY APP HEADER ---------- */}
      <ScreenHeader
        title="Active Members"
        subtitle={`Showing verified ${targetOppositeGender || "member"} profiles`}
        badge={
          filteredMembers.length > 0
            ? `${filteredMembers.length} Active`
            : "Active Now"
        }
        badgeIcon="radio-button-on"
        badgeColor="#15803D"
        badgeBgColor="#DCFCE7"
        rightElement={
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilterCount > 0 && styles.filterButtonActive,
            ]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={activeFilterCount > 0 ? "#fff" : COLORS.text}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      >
        {/* Instant Search Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons
            name="search"
            size={18}
            color={COLORS.textLight}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${targetOppositeGender.toLowerCase()}s by name, ID, caste, city...`}
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleSearchSubmit}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={handleClearSearch}
              style={styles.clearSearchBtn}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={COLORS.textLight}
              />
            </TouchableOpacity>
          )}
        </View>
      </ScreenHeader>

      {/* ---------- SCROLLABLE ACTIVE MEMBERS FEED ---------- */}
      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        bottomPadding={120}
        showsVerticalScrollIndicator={true}
        persistentScrollbar={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Results Count & Match Pill */}
        <View style={styles.resultsHeaderRow}>
          <View style={styles.matchTagPill}>
            <Ionicons
              name={targetOppositeGender === "Female" ? "woman" : "man"}
              size={14}
              color={COLORS.primary}
            />
            <Text style={styles.matchTagText}>
              {loading && members.length === 0
                ? `Loading ${targetOppositeGender} Matches...`
                : searchQuery.trim()
                  ? `${filteredMembers.length} Found`
                  : `${targetOppositeGender} Matches (${totalItems || filteredMembers.length})`}
            </Text>
          </View>

          {searchQuery.trim() ? (
            <TouchableOpacity onPress={handleClearSearch}>
              <Text style={styles.clearFilterLink}>Clear Search</Text>
            </TouchableOpacity>
          ) : activeFilterCount > 0 ? (
            <TouchableOpacity onPress={handleResetFilters}>
              <Text style={styles.clearFilterLink}>
                Clear Filters ({activeFilterCount})
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Email Verification Banner */}
        {emailUnverified && (
          <View style={styles.verificationBanner}>
            <View style={styles.verificationIconWrap}>
              <Ionicons name="mail-unread-outline" size={22} color="#B45309" />
            </View>
            <View style={styles.verificationTextWrap}>
              <Text style={styles.verificationTitle}>
                Email Verification Pending
              </Text>
              <Text style={styles.verificationSubtitle}>
                Please verify your email on hindumatrimony.org.in to unlock full
                member listings.
              </Text>
            </View>
          </View>
        )}

        {/* Connection / Fetch Error State */}
        {fetchError && !emailUnverified && members.length === 0 && !loading && (
          <View style={styles.errorBox}>
            <Ionicons name="cloud-offline-outline" size={38} color="#DC2626" />
            <Text style={styles.errorTitle}>Unable to Load Members</Text>
            <Text style={styles.errorSubtitle}>{fetchError}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => fetchMembersPage(1, appliedFilters, true)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="refresh"
                size={16}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.retryBtnText}>Retry Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Unauthenticated / Guest State */}
        {!token && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name="lock-closed-outline"
                size={44}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>Sign In Required</Text>
            <Text style={styles.emptySubtitle}>
              Please log in to your account to browse active members and connect
              with compatible matches.
            </Text>
          </View>
        )}

        {/* Page Loading Banner */}
        {pageLoading && (
          <View style={styles.pageLoadingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.pageLoadingText}>
              Loading page {currentPage}...
            </Text>
          </View>
        )}

        {/* Skeleton Loading State */}
        {loading && members.length === 0 ? (
          <ActiveMembersSkeleton count={3} />
        ) : filteredMembers.length === 0 &&
          !fetchError &&
          !emailUnverified &&
          token ? (
          /* Clean Empty State */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name={searchQuery.trim() ? "search-outline" : "people-outline"}
                size={44}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery.trim()
                ? "No Matching Profiles"
                : "No Active Members Available"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.trim()
                ? `No active members found matching "${searchQuery}". Try searching by another name, caste, city, or ID.`
                : "There are currently no active profiles matching your filters. Try clearing your filters or pull down to refresh."}
            </Text>
            {searchQuery.trim() ? (
              <TouchableOpacity
                style={styles.refreshEmptyBtn}
                onPress={handleClearSearch}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.refreshEmptyBtnText}>Clear Search</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.refreshEmptyBtn}
                onPress={onRefresh}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="refresh"
                  size={16}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.refreshEmptyBtnText}>Refresh Now</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* Live Member Cards (Server-Side Paginated) */
          filteredMembers.map((m, index) => {
            const memberKey = String(
              m?.id ?? m?.userId ?? m?.memberId ?? `member_${index}`,
            );
            const memberUid = m?.id || m?.userId || m?.memberId;
            const interestStatus = memberUid
              ? memberStateService.getInterestStatus(memberUid)
              : null;
            const isAccepted = interestStatus === "Accepted";
            const isRejected = interestStatus === "Rejected";
            const isSent =
              !isRejected &&
              (isAccepted ||
                Boolean(
                  (m?.id && interestSentMap[String(m.id)]) ||
                  (m?.userId && interestSentMap[String(m.userId)]) ||
                  (memberUid && memberStateService.isInterestSent(memberUid)),
                ));
            const isShortlisted = Boolean(
              (m?.id && shortlistMap[String(m.id)]) ||
              (m?.userId && shortlistMap[String(m.userId)]) ||
              (memberUid && memberStateService.isShortlisted(memberUid)),
            );

            const displayReligion = resolveName(
              m.rawReligion,
              lookupMaps.religions,
            );
            const displayCaste = resolveName(m.rawCaste, lookupMaps.castes);
            const displayMarital = resolveName(
              m.rawMaritalStatus,
              lookupMaps.maritalStatuses,
            );
            const displayCountry = resolveName(
              m.rawCountry,
              lookupMaps.countries,
            );
            const displayMotherTongue = resolveName(
              m.rawMotherTongue,
              lookupMaps.languages,
            );
            const displayLocation =
              m.location ||
              [m.city, m.state, displayCountry].filter(Boolean).join(", ") ||
              displayCountry;

            return (
              <View key={memberKey} style={styles.card}>
                {/* Hero Photo with Badges */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => handleViewFullProfile(m)}
                  style={styles.photoContainer}
                >
                  <Image
                    source={{ uri: m.photo || DEFAULT_AVATAR }}
                    style={styles.cardPhoto}
                    resizeMode="cover"
                  />

                  {/* Top Overlay Badges */}
                  <View style={styles.photoOverlayTop}>
                    <View
                      style={[
                        styles.planBadge,
                        m.plan === "Premium"
                          ? styles.planPremium
                          : styles.planFree,
                      ]}
                    >
                      <Ionicons
                        name={m.plan === "Premium" ? "ribbon" : "sparkles"}
                        size={11}
                        color="#fff"
                        style={{ marginRight: 3 }}
                      />
                      <Text style={styles.planBadgeText}>{m.plan}</Text>
                    </View>

                    <View style={styles.onlineBadge}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.onlineBadgeText}>
                        {m.onlineStatus}
                      </Text>
                    </View>
                  </View>

                  {/* Bottom Overlays on Photo */}
                  <View style={styles.photoOverlayBottom}>
                    <View style={styles.verifiedBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color="#fff"
                      />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                    <View style={styles.memberIdBadge}>
                      <Text style={styles.memberIdText}>{m.memberId}</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Card Details Body */}
                <View style={styles.cardBody}>
                  {/* Name and Report Button Header */}
                  <View style={styles.nameRow}>
                    <TouchableOpacity
                      onPress={() => handleViewFullProfile(m)}
                      activeOpacity={0.7}
                      style={{ flex: 1, marginRight: 8 }}
                    >
                      <Text style={styles.cardName} numberOfLines={1}>
                        {m.name},{" "}
                        <Text style={styles.cardAge}>{m.age} yrs</Text>
                      </Text>
                    </TouchableOpacity>

                    {/* Subtle Report Button on Card Header */}
                    <TouchableOpacity
                      style={styles.reportBadgeBtn}
                      onPress={() => handleReportMember(m)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="flag-outline" size={12} color="#DC2626" />
                      <Text style={styles.reportBadgeText}>Report</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Attribute Chips with Names Resolved from Server IDs */}
                  <View style={styles.chipsContainer}>
                    {m.height ? (
                      <View style={styles.chip}>
                        <Ionicons
                          name="resize-outline"
                          size={12}
                          color={COLORS.primary}
                        />
                        <Text style={styles.chipText}>{m.height}</Text>
                      </View>
                    ) : null}
                    {displayReligion ? (
                      <View style={styles.chip}>
                        <Ionicons
                          name="flower-outline"
                          size={12}
                          color={COLORS.primary}
                        />
                        <Text style={styles.chipText}>
                          {displayReligion}{" "}
                          {displayCaste ? `• ${displayCaste}` : ""}
                        </Text>
                      </View>
                    ) : null}
                    {displayMarital ? (
                      <View style={styles.chip}>
                        <Ionicons
                          name="heart-outline"
                          size={12}
                          color={COLORS.primary}
                        />
                        <Text style={styles.chipText}>{displayMarital}</Text>
                      </View>
                    ) : null}
                    {displayLocation ? (
                      <View style={styles.chip}>
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color={COLORS.primary}
                        />
                        <Text style={styles.chipText} numberOfLines={1}>
                          {displayLocation}
                        </Text>
                      </View>
                    ) : null}
                    {displayMotherTongue ? (
                      <View style={styles.chip}>
                        <Ionicons
                          name="chatbubbles-outline"
                          size={12}
                          color={COLORS.primary}
                        />
                        <Text style={styles.chipText}>
                          {displayMotherTongue}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.cardDivider} />

                  {/* ---------- 4 CLEAN MODERN ACTION BUTTONS ---------- */}
                  <View style={styles.cardActionGrid}>
                    {/* Row 1: Primary Actions */}
                    <View style={styles.actionRow}>
                      {/* 1. Send Interest / Interest Sent / Accepted */}
                      <TouchableOpacity
                        style={[
                          styles.primaryActionBtn,
                          isAccepted
                            ? styles.interestBtnAccepted
                            : isSent
                              ? styles.interestBtnSent
                              : styles.interestBtnActive,
                        ]}
                        onPress={() => handleSendInterest(m)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={
                            isAccepted
                              ? "checkmark-done"
                              : isSent
                                ? "checkmark-circle"
                                : "heart"
                          }
                          size={16}
                          color={
                            isAccepted ? "#15803D" : isSent ? "#065F46" : "#fff"
                          }
                          style={styles.btnIcon}
                        />
                        <Text
                          style={[
                            styles.btnText,
                            isAccepted
                              ? styles.interestTextAccepted
                              : isSent
                                ? styles.interestTextSent
                                : styles.interestTextActive,
                          ]}
                        >
                          {isAccepted
                            ? "Accepted"
                            : isSent
                              ? "Interest Sent"
                              : "Send Interest"}
                        </Text>
                      </TouchableOpacity>

                      {/* 2. View Profile */}
                      <TouchableOpacity
                        style={[styles.primaryActionBtn, styles.viewProfileBtn]}
                        onPress={() => handleViewFullProfile(m)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="person-outline"
                          size={15}
                          color={COLORS.primary}
                          style={styles.btnIcon}
                        />
                        <Text style={[styles.btnText, styles.viewProfileText]}>
                          View Profile
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Row 2: Secondary Actions */}
                    <View style={styles.actionRow}>
                      {/* 3. Shortlist */}
                      <TouchableOpacity
                        style={[
                          styles.secondaryActionBtn,
                          isShortlisted && styles.shortlistBtnActive,
                        ]}
                        onPress={() => handleToggleShortlist(m)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={isShortlisted ? "star" : "star-outline"}
                          size={15}
                          color={isShortlisted ? "#B45309" : "#64748B"}
                          style={styles.btnIcon}
                        />
                        <Text
                          style={[
                            styles.btnText,
                            isShortlisted
                              ? styles.shortlistTextActive
                              : styles.secondaryBtnText,
                          ]}
                        >
                          {isShortlisted ? "Shortlisted" : "Shortlist"}
                        </Text>
                      </TouchableOpacity>

                      {/* 4. Ignore */}
                      <TouchableOpacity
                        style={[styles.secondaryActionBtn, styles.ignoreBtn]}
                        onPress={() => handleIgnoreMember(m)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="ban-outline"
                          size={15}
                          color="#64748B"
                          style={styles.btnIcon}
                        />
                        <Text style={[styles.btnText, styles.secondaryBtnText]}>
                          Ignore
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* ---------- RESPONSIVE PAGINATION CONTROLS (SERVER-SIDE) ---------- */}
        {!loading &&
          !searchQuery.trim() &&
          totalPages > 1 && (
            <View style={styles.paginationCard}>
              {/* Page info subtitle */}
              <Text style={styles.paginationInfoText}>
                Showing{" "}
                <Text style={styles.paginationInfoBold}>
                  {totalItems === 0 || filteredMembers.length === 0
                    ? 0
                    : (currentPage - 1) * perPage + 1}
                  –
                  {totalItems === 0 || filteredMembers.length === 0
                    ? 0
                    : Math.min(
                        (currentPage - 1) * perPage + filteredMembers.length,
                        totalItems || currentPage * perPage,
                      )}
                </Text>{" "}
                of{" "}
                <Text style={styles.paginationInfoBold}>
                  {totalItems || filteredMembers.length}
                </Text>{" "}
                profiles (Page {currentPage} of {totalPages})
              </Text>

              {/* Centered Pagination Row */}
              <View style={styles.paginationRow}>
                {/* Previous Button */}
                <TouchableOpacity
                  style={[
                    styles.navPageBtn,
                    (currentPage === 1 || pageLoading) &&
                      styles.navPageBtnDisabled,
                  ]}
                  onPress={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || pageLoading}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="chevron-back"
                    size={14}
                    color={
                      currentPage === 1 || pageLoading ? "#CBD5E1" : COLORS.text
                    }
                  />
                  <Text
                    style={[
                      styles.navPageBtnText,
                      (currentPage === 1 || pageLoading) &&
                        styles.navPageBtnTextDisabled,
                    ]}
                  >
                    Prev
                  </Text>
                </TouchableOpacity>

                {/* Numbers & Ellipses */}
                <View style={styles.pagePillsGroup}>
                  {getPaginationRange(currentPage, totalPages).map((p, idx) => {
                    if (p === "...") {
                      const isLeftEllipsis = idx === 1;
                      const targetPage = isLeftEllipsis
                        ? Math.max(1, currentPage - 5)
                        : Math.min(totalPages, currentPage + 5);
                      return (
                        <TouchableOpacity
                          key={`ellipsis_${idx}`}
                          style={styles.ellipsisWrap}
                          onPress={() => handlePageChange(targetPage)}
                          disabled={pageLoading}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.ellipsisText}>•••</Text>
                        </TouchableOpacity>
                      );
                    }

                    const isCurrent = p === currentPage;
                    return (
                      <TouchableOpacity
                        key={`page_${p}`}
                        style={[
                          styles.pageNumberBtn,
                          isCurrent && styles.pageNumberBtnActive,
                          pageLoading && styles.pageNumberBtnLoading,
                        ]}
                        onPress={() => handlePageChange(p)}
                        disabled={pageLoading || isCurrent}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.pageNumberText,
                            isCurrent && styles.pageNumberTextActive,
                          ]}
                        >
                          {p}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Next Button */}
                <TouchableOpacity
                  style={[
                    styles.navPageBtn,
                    (currentPage === totalPages || pageLoading) &&
                      styles.navPageBtnDisabled,
                  ]}
                  onPress={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || pageLoading}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.navPageBtnText,
                      (currentPage === totalPages || pageLoading) &&
                        styles.navPageBtnTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={
                      currentPage === totalPages || pageLoading
                        ? "#CBD5E1"
                        : COLORS.text
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
      </KeyboardAwareScrollView>

      {/* ---------- COMPREHENSIVE SEARCH & FILTER MODAL ---------- */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (picker) setPicker(null);
          else setFilterModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Active Member Filter</Text>
                <Text style={styles.modalSubtitle}>
                  Search Verified Matches
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setPicker(null);
                  setFilterModalVisible(false);
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Modal Filter Fields */}
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Member Code */}
              <Text style={styles.filterSectionTitle}>Member Code</Text>
              <TextInput
                style={styles.filterTextInput}
                placeholder="e.g. MX1234"
                placeholderTextColor={COLORS.textLight}
                value={filterMemberCode}
                onChangeText={setFilterMemberCode}
                autoCapitalize="characters"
              />

              {/* Member Type */}
              <Text style={styles.filterSectionTitle}>Member Type</Text>
              <View style={styles.optionRow}>
                <TouchableOpacity
                  style={[
                    styles.optionPill,
                    filterMemberType === "" && styles.optionPillActive,
                  ]}
                  onPress={() => setFilterMemberType("")}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      filterMemberType === "" && styles.optionPillTextActive,
                    ]}
                  >
                    All Members
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionPill,
                    filterMemberType === "0" && styles.optionPillActive,
                  ]}
                  onPress={() => setFilterMemberType("0")}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      filterMemberType === "0" && styles.optionPillTextActive,
                    ]}
                  >
                    Active (Type 0)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Marital Status */}
              <Text style={styles.filterSectionTitle}>Marital Status</Text>
              <SelectField
                value={labelOf(
                  filterOptions.maritalStatuses,
                  filterMaritalStatusId,
                )}
                placeholder="All Statuses"
                onClear={() => setFilterMaritalStatusId("")}
                onPress={() =>
                  setPicker({
                    title: "Marital Status",
                    options: filterOptions.maritalStatuses,
                    selectedId: filterMaritalStatusId,
                    anyLabel: "All Statuses",
                    onSelect: setFilterMaritalStatusId,
                  })
                }
              />

              {/* Religion */}
              <Text style={styles.filterSectionTitle}>Religion</Text>
              <SelectField
                value={labelOf(filterOptions.religions, filterReligionId)}
                placeholder="All Religions"
                onClear={() => {
                  setFilterReligionId("");
                  setFilterCasteId("");
                  setFilterSubCasteId("");
                }}
                onPress={() =>
                  setPicker({
                    title: "Religion",
                    options: filterOptions.religions,
                    selectedId: filterReligionId,
                    anyLabel: "All Religions",
                    onSelect: (id) => {
                      if (id !== filterReligionId) {
                        setFilterCasteId("");
                        setFilterSubCasteId("");
                      }
                      setFilterReligionId(id);
                    },
                  })
                }
              />

              {/* Caste */}
              <Text style={styles.filterSectionTitle}>Caste</Text>
              <SelectField
                value={labelOf(filterOptions.castes, filterCasteId)}
                placeholder="All Castes"
                onClear={() => {
                  setFilterCasteId("");
                  setFilterSubCasteId("");
                }}
                onPress={() =>
                  setPicker({
                    title: "Caste",
                    options: filterOptions.castes,
                    selectedId: filterCasteId,
                    anyLabel: "All Castes",
                    onSelect: (id) => {
                      if (id !== filterCasteId) setFilterSubCasteId("");
                      setFilterCasteId(id);
                      // keep religion in sync with the chosen caste
                      const caste = (serverFilterSettings?.castes || []).find(
                        (c) => String(c.id) === String(id),
                      );
                      if (caste?.religion_id)
                        setFilterReligionId(String(caste.religion_id));
                    },
                  })
                }
              />

              {/* Sub-Caste (enabled after caste) */}
              <Text style={styles.filterSectionTitle}>Sub-Caste</Text>
              <SelectField
                value={labelOf(filterOptions.subCastes, filterSubCasteId)}
                placeholder={
                  filterCasteId ? "All Sub-Castes" : "Select a caste first"
                }
                disabled={!filterCasteId}
                onClear={() => setFilterSubCasteId("")}
                onPress={() =>
                  setPicker({
                    title: "Sub-Caste",
                    options: filterOptions.subCastes,
                    selectedId: filterSubCasteId,
                    anyLabel: "All Sub-Castes",
                    emptyText: "No sub-castes available for this caste.",
                    onSelect: setFilterSubCasteId,
                  })
                }
              />

              {/* Age Range Input */}
              <Text style={styles.filterSectionTitle}>Age Range (Years)</Text>
              <View style={styles.inputRangeRow}>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Age From (e.g. 21)"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={filterAgeFrom}
                  onChangeText={setFilterAgeFrom}
                />
                <Text style={styles.rangeSeparator}>to</Text>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Age To (e.g. 35)"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={filterAgeTo}
                  onChangeText={setFilterAgeTo}
                />
              </View>

              {/* Height Range Input */}
              <Text style={styles.filterSectionTitle}>Height Range (Feet)</Text>
              <View style={styles.inputRangeRow}>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Min Height (e.g. 5.0)"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={filterMinHeight}
                  onChangeText={setFilterMinHeight}
                />
                <Text style={styles.rangeSeparator}>to</Text>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Max Height (e.g. 6.0)"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={filterMaxHeight}
                  onChangeText={setFilterMaxHeight}
                />
              </View>

              {/* Mother Tongue */}
              <Text style={styles.filterSectionTitle}>Mother Tongue</Text>
              <SelectField
                value={labelOf(filterOptions.languages, filterMotherTongue)}
                placeholder="All Languages"
                onClear={() => setFilterMotherTongue("")}
                onPress={() =>
                  setPicker({
                    title: "Mother Tongue",
                    options: filterOptions.languages,
                    selectedId: filterMotherTongue,
                    anyLabel: "All Languages",
                    onSelect: setFilterMotherTongue,
                  })
                }
              />

              {/* Country */}
              <Text style={styles.filterSectionTitle}>Country</Text>
              <SelectField
                value={labelOf(filterOptions.countries, filterCountryId)}
                placeholder="All Countries"
                onClear={() => {
                  setFilterCountryId("");
                  setFilterStateId("");
                  setFilterCityId("");
                }}
                onPress={() =>
                  setPicker({
                    title: "Country",
                    options: filterOptions.countries,
                    selectedId: filterCountryId,
                    anyLabel: "All Countries",
                    emptyText: "Countries are still loading. Please try again.",
                    onSelect: (id) => {
                      if (id !== filterCountryId) {
                        setFilterStateId("");
                        setFilterCityId("");
                      }
                      setFilterCountryId(id);
                    },
                  })
                }
              />

              {/* State (enabled after country) */}
              <Text style={styles.filterSectionTitle}>State</Text>
              <SelectField
                value={labelOf(filterOptions.states, filterStateId)}
                placeholder={
                  filterCountryId ? "All States" : "Select a country first"
                }
                disabled={!filterCountryId}
                loading={Boolean(filterCountryId) && locationDataLoading}
                onClear={() => {
                  setFilterStateId("");
                  setFilterCityId("");
                }}
                onPress={() =>
                  setPicker({
                    title: "State",
                    options: filterOptions.states,
                    selectedId: filterStateId,
                    anyLabel: "All States",
                    emptyText: locationDataLoading
                      ? "States are still loading. Please try again."
                      : "No states available for this country.",
                    onSelect: (id) => {
                      if (id !== filterStateId) setFilterCityId("");
                      setFilterStateId(id);
                    },
                  })
                }
              />

              {/* City (enabled after state) */}
              <Text style={styles.filterSectionTitle}>City</Text>
              <SelectField
                value={labelOf(filterOptions.cities, filterCityId)}
                placeholder={
                  filterStateId ? "All Cities" : "Select a state first"
                }
                disabled={!filterStateId}
                onClear={() => setFilterCityId("")}
                onPress={() =>
                  setPicker({
                    title: "City",
                    options: filterOptions.cities,
                    selectedId: filterCityId,
                    anyLabel: "All Cities",
                    emptyText: "No cities available for this state.",
                    onSelect: setFilterCityId,
                  })
                }
              />

              {/* Profession input */}
              <Text style={styles.filterSectionTitle}>
                Profession / Occupation
              </Text>
              <TextInput
                style={styles.filterTextInput}
                placeholder="e.g. Engineer, Doctor, CA"
                placeholderTextColor={COLORS.textLight}
                value={filterProfession}
                onChangeText={setFilterProfession}
              />
            </ScrollView>

            {/* Modal Action Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalResetBtn}
                onPress={handleResetFilters}
              >
                <Text style={styles.modalResetBtnText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={handleApplyFilters}
                disabled={syncingFilter}
                activeOpacity={0.8}
              >
                {syncingFilter ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalApplyBtnText}>Apply Filters</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Searchable dropdown sheet (overlays the filter modal) */}
            {picker && (
              <PickerSheet
                key={picker.title}
                picker={picker}
                onClose={() => setPicker(null)}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  filterHint: {
    fontSize: 12,
    color: COLORS.textLight,
    paddingVertical: 6,
  },

  /* Dropdown field */
  selectField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
    backgroundColor: "#FAF5F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EAE0DA",
    paddingHorizontal: 12,
    marginBottom: 6,
    gap: 8,
  },
  selectFieldDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  selectFieldText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  selectFieldPlaceholder: {
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
  },
  selectFieldTextDisabled: {
    color: "#94A3B8",
  },

  /* Searchable picker sheet */
  pickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  pickerBackBtn: {
    padding: 4,
  },
  pickerTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  pickerSubtitle: {
    fontSize: 11.5,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 1,
  },
  pickerSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#FAF5F2",
    borderWidth: 1,
    borderColor: "#EAE0DA",
    gap: 8,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    height: "100%",
  },
  pickerListContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  pickerRowActive: {
    backgroundColor: "#FFF1F2",
    borderRadius: 8,
  },
  pickerRowText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  pickerRowTextActive: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  pickerEmpty: {
    textAlign: "center",
    paddingVertical: 30,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerTitleGroup: {
    flex: 1,
  },
  titleWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  livePulseContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 4,
  },
  livePulseText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: "#059669",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 2,
  },
  genderHighlight: {
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  filterBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: "#fff",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    height: "100%",
  },
  clearSearchBtn: {
    padding: 4,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  resultsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  matchTagPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FBCFE8",
    gap: 6,
  },
  matchTagText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  clearFilterLink: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
    textDecorationLine: "underline",
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 24,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 18,
  },
  refreshEmptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  refreshEmptyBtnText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: "#fff",
  },

  /* Email Verification Notice */
  verificationBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  verificationIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  verificationTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  verificationTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#B45309",
  },
  verificationSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: "#78350F",
    marginTop: 2,
    lineHeight: 16,
  },

  /* Connection / Fetch Error State */
  errorBox: {
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 24,
    marginTop: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: "#DC2626",
    marginTop: 10,
    marginBottom: 4,
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: "#fff",
  },

  /* Card Styling */
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1E8E2",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  photoContainer: {
    width: "100%",
    height: 230,
    backgroundColor: "#FFF1F2",
    position: "relative",
  },
  cardPhoto: {
    width: "100%",
    height: "100%",
  },
  photoFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FCE7F3",
  },
  photoOverlayTop: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planPremium: {
    backgroundColor: "#E11D48",
  },
  planFree: {
    backgroundColor: "#475569",
  },
  planBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: "#fff",
    textTransform: "uppercase",
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 4,
  },
  onlineBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: "#fff",
  },
  photoOverlayBottom: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#15803D",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  verifiedText: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: "#fff",
  },
  memberIdBadge: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  memberIdText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  cardBody: {
    padding: 14,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  cardAge: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  reportBadgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 3,
  },
  reportBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: "#DC2626",
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF5F2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F1E8E2",
    gap: 4,
  },
  chipText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: "#475569",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F1E8E2",
    marginVertical: 10,
  },

  /* 4-Button Clean Grid Layout */
  cardActionGrid: {
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  btnIcon: {
    marginRight: 5,
  },
  btnText: {
    fontSize: 12.5,
    fontFamily: FONTS.semiBold,
  },
  interestBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  interestBtnSent: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  interestBtnAccepted: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  interestTextActive: {
    color: "#fff",
  },
  interestTextSent: {
    color: "#15803D",
  },
  interestTextAccepted: {
    color: "#15803D",
    fontFamily: FONTS.bold,
  },
  viewProfileBtn: {
    backgroundColor: "#fff",
    borderColor: "#FBCFE8",
  },
  viewProfileText: {
    color: COLORS.primary,
  },
  shortlistBtnActive: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
  },
  shortlistTextActive: {
    color: "#B45309",
  },
  secondaryBtnText: {
    color: "#475569",
  },
  ignoreBtn: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
  },

  /* Page Loading Indicator */
  pageLoadingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  pageLoadingText: {
    fontSize: 12.5,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  pageNumberBtnLoading: {
    opacity: 0.6,
  },

  /* Responsive Centered Pagination (Never out of bounds) */
  paginationCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F1E8E2",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  paginationInfoText: {
    fontSize: 11.5,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  paginationInfoBold: {
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    flexWrap: "nowrap",
    gap: 3,
  },
  navPageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
    height: 30,
    borderRadius: 7,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  navPageBtnDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
    opacity: 0.6,
  },
  navPageBtnText: {
    fontSize: 11.5,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    marginHorizontal: 2,
  },
  navPageBtnTextDisabled: {
    color: "#94A3B8",
  },
  pagePillsGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  pageNumberBtn: {
    minWidth: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 3,
  },
  pageNumberBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pageNumberText: {
    fontSize: 11.5,
    fontFamily: FONTS.semiBold,
    color: "#334155",
  },
  pageNumberTextActive: {
    color: "#fff",
  },
  ellipsisWrap: {
    width: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ellipsisText: {
    fontSize: 10,
    color: "#94A3B8",
    letterSpacing: 0.5,
  },

  /* Filter Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "85%",
    paddingTop: 16,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1E8E2",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalScrollContent: {
    paddingVertical: 14,
    paddingBottom: 30,
  },
  filterSectionTitle: {
    fontSize: 13.5,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  optionPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FAF5F2",
    borderWidth: 1,
    borderColor: "#EAE0DA",
  },
  optionPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionPillText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  optionPillTextActive: {
    color: "#fff",
    fontFamily: FONTS.bold,
  },
  inputRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  rangeInput: {
    flex: 1,
    height: 40,
    backgroundColor: "#FAF5F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EAE0DA",
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  rangeSeparator: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  filterTextInput: {
    height: 40,
    backgroundColor: "#FAF5F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EAE0DA",
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginBottom: 10,
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1E8E2",
    gap: 12,
    backgroundColor: "#fff",
  },
  modalResetBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FAF5F2",
    borderWidth: 1,
    borderColor: "#EAE0DA",
    alignItems: "center",
    justifyContent: "center",
  },
  modalResetBtnText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  modalApplyBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  modalApplyBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: "#fff",
  },

  /* Full Profile Modal */
  modalDetailSafe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  detailNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  detailBackBtn: {
    padding: 4,
  },
  detailNavTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  detailFlagBtn: {
    padding: 4,
  },
  detailLoadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  detailLoadingText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  detailScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  detailHeroCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  detailHeroPhoto: {
    width: "100%",
    height: 260,
  },
  detailHeroPlaceholder: {
    width: "100%",
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F2",
  },
  detailHeroInfo: {
    padding: 16,
  },
  detailHeroName: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  detailHeroCode: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  verifiedBadgeLabel: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: "#15803D",
  },
  detailSectionCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 6,
  },
  detailRowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  detailItemKey: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  detailItemVal: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  subItemBlock: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  subItemTitle: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  subItemSub: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
  },
  emptyDetailText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    fontStyle: "italic",
  },
  expectationText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: "#334155",
    lineHeight: 19,
  },
  detailModalFooter: {
    marginTop: 10,
  },
  modalInterestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    height: 46,
    borderRadius: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  modalInterestBtnSent: {
    backgroundColor: "#15803D",
    shadowColor: "#15803D",
  },
  modalInterestBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: "#fff",
  },
});
