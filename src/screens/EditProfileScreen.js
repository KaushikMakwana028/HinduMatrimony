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

export default function EditProfileScreen({ navigation, route }) {
    const { user, token, updateUser } = useAuth();
    const initialSection = route?.params?.section || "basic";

    const [expandedSection, setExpandedSection] = useState(initialSection);
    const [loading, setLoading] = useState(false);
    const [savingSection, setSavingSection] = useState(null);
    const [memberCode, setMemberCode] = useState(user?.code || "");

    // Section-specific inline error banners and missing field highlights
    const [sectionErrors, setSectionErrors] = useState({});
    const [missingFields, setMissingFields] = useState({});

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
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Derived settings dropdown lists
    const countryList = useMemo(() => serverSettings?.countries || [], [serverSettings]);
    const stateList = useMemo(() => serverSettings?.states || [], [serverSettings]);
    const cityList = useMemo(() => serverSettings?.cities || [], [serverSettings]);
    const religionList = useMemo(() => serverSettings?.religions || [], [serverSettings]);
    const casteList = useMemo(() => serverSettings?.castes || [], [serverSettings]);
    const subCasteList = useMemo(() => serverSettings?.sub_castes || [], [serverSettings]);
    const maritalStatusList = useMemo(
        () => (serverSettings?.marital_statuses?.length ? serverSettings.marital_statuses : DEFAULT_MARITAL_STATUSES),
        [serverSettings]
    );
    const onBehalfList = useMemo(
        () => (serverSettings?.on_behalves?.length ? serverSettings.on_behalves : DEFAULT_ON_BEHALVES),
        [serverSettings]
    );
    const familyValueList = useMemo(
        () => (serverSettings?.family_values?.length ? serverSettings.family_values : DEFAULT_FAMILY_VALUES),
        [serverSettings]
    );
    const languageList = useMemo(() => serverSettings?.languages || [], [serverSettings]);

    // Helpers to get display names
    const getOptionName = (list, id, fallback = "") => {
        if (!id) return fallback;
        const item = (list || []).find((x) => String(x.id) === String(id));
        return item ? item.name : fallback || String(id);
    };

    // Calculate missing fields in Basic Information (RED PILL)
    const basicMissingFields = useMemo(() => {
        const missing = [];
        if (!String(basicInfo.first_name || "").trim()) missing.push({ key: "first_name", label: "First Name" });
        if (!String(basicInfo.gender || "").trim()) missing.push({ key: "gender", label: "Gender" });
        if (!String(basicInfo.date_of_birth || "").trim()) missing.push({ key: "date_of_birth", label: "Date of Birth" });
        if (!basicInfo.marital_status) missing.push({ key: "marital_status", label: "Marital Status" });
        if (!basicInfo.on_behalf) missing.push({ key: "on_behalf", label: "On Behalf" });
        if (!String(contactInfo.phone || basicInfo.phone || "").trim() && !String(contactInfo.email || basicInfo.email || "").trim()) {
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

    // Client-side validator before saving any section
    const validateSection = (sectionKey) => {
        const missing = {};
        const missingNames = [];

        switch (sectionKey) {
            case "introduction": {
                if (!String(introduction || "").trim()) {
                    missing.introduction = true;
                    missingNames.push("Introduction Bio");
                }
                break;
            }
            case "basic": {
                if (!String(basicInfo.first_name || "").trim()) {
                    missing.first_name = true;
                    missingNames.push("First Name");
                }
                if (!String(basicInfo.gender || "").trim()) {
                    missing.gender = true;
                    missingNames.push("Gender");
                }
                if (!String(basicInfo.date_of_birth || "").trim()) {
                    missing.date_of_birth = true;
                    missingNames.push("Date of Birth");
                }
                if (!basicInfo.marital_status) {
                    missing.marital_status = true;
                    missingNames.push("Marital Status");
                }
                if (!basicInfo.on_behalf) {
                    missing.on_behalf = true;
                    missingNames.push("On Behalf");
                }
                if (!String(basicInfo.phone || contactInfo.phone || "").trim() && !String(basicInfo.email || contactInfo.email || "").trim()) {
                    missing.contact = true;
                    missingNames.push("Phone or Email");
                }
                break;
            }
            case "contact": {
                if (!String(contactInfo.phone || "").trim()) {
                    missing.phone = true;
                    missingNames.push("Phone Number");
                }
                if (!String(contactInfo.email || "").trim()) {
                    missing.email = true;
                    missingNames.push("Email Address");
                }
                break;
            }
            case "address": {
                const addr = addressType === "present" ? presentAddress : permanentAddress;
                if (!addr.country_id) {
                    missing.country_id = true;
                    missingNames.push("Country");
                }
                if (!addr.state_id) {
                    missing.state_id = true;
                    missingNames.push("State");
                }
                if (!addr.city_id) {
                    missing.city_id = true;
                    missingNames.push("City");
                }
                if (!String(addr.postal_code || "").trim()) {
                    missing.postal_code = true;
                    missingNames.push("Postal Code");
                }
                break;
            }
            case "physical": {
                if (!String(physical.height || "").trim()) {
                    missing.height = true;
                    missingNames.push("Height");
                }
                if (!String(physical.weight || "").trim()) {
                    missing.weight = true;
                    missingNames.push("Weight");
                }
                break;
            }
            case "language": {
                if (!String(language.mothere_tongue || "").trim()) {
                    missing.mothere_tongue = true;
                    missingNames.push("Mother Tongue");
                }
                if (!String(language.known_languages || "").trim()) {
                    missing.known_languages = true;
                    missingNames.push("Known Languages");
                }
                break;
            }
            case "spiritual": {
                if (!spiritual.member_religion_id) {
                    missing.member_religion_id = true;
                    missingNames.push("Religion");
                }
                if (!spiritual.member_caste_id) {
                    missing.member_caste_id = true;
                    missingNames.push("Caste");
                }
                break;
            }
            case "partner": {
                if (!String(partnerExpectation.partner_height || "").trim()) {
                    missing.partner_height = true;
                    missingNames.push("Preferred Height");
                }
                if (!String(partnerExpectation.partner_weight || "").trim()) {
                    missing.partner_weight = true;
                    missingNames.push("Preferred Weight");
                }
                if (!partnerExpectation.partner_religion_id) {
                    missing.partner_religion_id = true;
                    missingNames.push("Partner Religion");
                }
                if (!partnerExpectation.partner_country_id) {
                    missing.partner_country_id = true;
                    missingNames.push("Partner Country");
                }
                if (!partnerExpectation.partner_state_id) {
                    missing.partner_state_id = true;
                    missingNames.push("Partner State");
                }
                if (!partnerExpectation.partner_marital_status) {
                    missing.partner_marital_status = true;
                    missingNames.push("Partner Marital Status");
                }
                break;
            }
            default:
                break;
        }

        const isValid = missingNames.length === 0;
        const errorMessage = isValid ? null : `${missingNames.join(", ")} missing. Please fill in to save.`;
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

                if (isMounted && settingsRes.status === "fulfilled" && settingsRes.value) {
                    setServerSettings(settingsRes.value.data || settingsRes.value);
                }

                if (isMounted && profileRes.status === "fulfilled" && profileRes.value?.data) {
                    const d = profileRes.value.data;

                    // Introduction
                    if (d.introduction || d.intoduction?.introduction) {
                        setIntroduction(String(d.introduction || d.intoduction?.introduction || ""));
                    }

                    // Basic Info
                    if (d.basic_info) {
                        const b = d.basic_info;
                        setBasicInfo((prev) => ({
                            ...prev,
                            first_name: b.first_name || b.firs_name || prev.first_name,
                            last_name: b.last_name || prev.last_name,
                            gender: b.gender || prev.gender,
                            date_of_birth: b.date_of_birth || b.birthday || prev.date_of_birth,
                            marital_status: b.marital_status || b.maritial_status || prev.marital_status,
                            children: b.children !== undefined ? String(b.children) : (b.no_of_children !== undefined ? String(b.no_of_children) : prev.children),
                            on_behalf: b.on_behalf || b.onbehalf || prev.on_behalf,
                            phone: b.phone || prev.phone,
                            email: b.email || prev.email,
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
                        setPresentAddress((prev) => ({
                            ...prev,
                            country_id: d.present_address.country_id || prev.country_id,
                            state_id: d.present_address.state_id || prev.state_id,
                            city_id: d.present_address.city_id || prev.city_id,
                            postal_code:
                                d.present_address.postal_code !== null && d.present_address.postal_code !== undefined
                                    ? String(d.present_address.postal_code)
                                    : prev.postal_code || "",
                        }));
                    }

                    // Permanent Address
                    if (d.permanent_address) {
                        setPermanentAddress((prev) => ({
                            ...prev,
                            country_id: d.permanent_address.country_id || prev.country_id,
                            state_id: d.permanent_address.state_id || prev.state_id,
                            city_id: d.permanent_address.city_id || prev.city_id,
                            postal_code:
                                d.permanent_address.postal_code !== null && d.permanent_address.postal_code !== undefined
                                    ? String(d.permanent_address.postal_code)
                                    : prev.postal_code || "",
                        }));
                    }

                    // Physical
                    if (d.physical_attributes) {
                        const p = d.physical_attributes;
                        setPhysical((prev) => ({
                            ...prev,
                            height: p.height !== null && p.height !== undefined ? String(p.height) : prev.height || "",
                            weight: p.weight !== null && p.weight !== undefined ? String(p.weight) : prev.weight || "",
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
                    if (d.mother_tongue || d.known_languages || d.basic_info?.mothere_tongue) {
                        setLanguage((prev) => ({
                            ...prev,
                            mothere_tongue: d.mother_tongue || d.basic_info?.mothere_tongue || prev.mothere_tongue,
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
                            fitness_activities: h.fitness_activities || prev.fitness_activities,
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
                            recidency_country_id: r.recidency_country_id || prev.recidency_country_id,
                            growup_country_id: r.growup_country_id || prev.growup_country_id,
                            immigration_status: r.immigration_status || prev.immigration_status,
                        }));
                    }

                    // Spiritual
                    if (d.spiritual_background || d.spiritual_backgrounds) {
                        const s = d.spiritual_background || d.spiritual_backgrounds;
                        setSpiritual((prev) => ({
                            ...prev,
                            member_religion_id: s.member_religion_id || prev.member_religion_id,
                            member_caste_id: s.member_caste_id || prev.member_caste_id,
                            member_sub_caste_id: s.member_sub_caste_id || prev.member_sub_caste_id,
                            ethnicity: s.ethnicity || prev.ethnicity,
                            personal_value: s.personal_value || prev.personal_value,
                            family_value_id: s.family_value_id || prev.family_value_id,
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
                            partner_marital_status: pe.partner_marital_status || prev.partner_marital_status,
                            partner_children_acceptable: pe.partner_children_acceptable || prev.partner_children_acceptable,
                            residence_country_id: pe.residence_country_id || prev.residence_country_id,
                            partner_religion_id: pe.partner_religion_id || prev.partner_religion_id,
                            partner_caste_id: pe.partner_caste_id || prev.partner_caste_id,
                            partner_sub_caste_id: pe.partner_sub_caste_id || prev.partner_sub_caste_id,
                            pertner_education: pe.pertner_education || prev.pertner_education,
                            partner_profession: pe.partner_profession || prev.partner_profession,
                            smoking_acceptable: pe.smoking_acceptable || prev.smoking_acceptable,
                            drinking_acceptable: pe.drinking_acceptable || prev.drinking_acceptable,
                            partner_diet: pe.partner_diet || prev.partner_diet,
                            partner_body_type: pe.partner_body_type || prev.partner_body_type,
                            partner_personal_value: pe.partner_personal_value || prev.partner_personal_value,
                            partner_manglik: pe.partner_manglik || prev.partner_manglik,
                            language_id: pe.language_id || prev.language_id,
                            family_value_id: pe.family_value_id || prev.family_value_id,
                            partner_country_id: pe.partner_country_id || prev.partner_country_id,
                            partner_state_id: pe.partner_state_id || prev.partner_state_id,
                            pertner_complexion: pe.pertner_complexion || prev.pertner_complexion,
                        }));
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
            setMissingFields((prev) => ({ ...prev, [sectionKey]: validation.missing }));
            setSectionErrors((prev) => ({ ...prev, [sectionKey]: validation.errorMessage }));
            return;
        }

        // Clear any previous error for this section
        clearFieldError(sectionKey);

        setSavingSection(sectionKey);
        try {
            switch (sectionKey) {
                case "introduction": {
                    await memberService.updateIntroduction({ introduction }, token);
                    Alert.alert("Success 🎉", "Introduction bio updated successfully!");
                    break;
                }
                case "basic": {
                    // Normalize marital_status & on_behalf to numeric ID
                    const maritalId =
                        Number(basicInfo.marital_status) ||
                        maritalStatusList.find((m) => String(m.name).toLowerCase() === String(basicInfo.marital_status).toLowerCase())?.id ||
                        1;
                    const onBehalfId =
                        Number(basicInfo.on_behalf) ||
                        onBehalfList.find((o) => String(o.name).toLowerCase() === String(basicInfo.on_behalf).toLowerCase())?.id ||
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
                            marital_status: maritalId,
                            children: String(basicInfo.children || 0),
                        },
                        token
                    );

                    if (updateUser) {
                        updateUser({
                            name: `${basicInfo.first_name} ${basicInfo.last_name}`.trim(),
                            gender: basicInfo.gender,
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
                        token
                    );
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
                    const addr = addressType === "present" ? presentAddress : permanentAddress;
                    await memberService.updateAddress(
                        {
                            country_id: addr.country_id || 1,
                            state_id: addr.state_id || 1,
                            city_id: addr.city_id || 1,
                            postal_code: addr.postal_code || "110001",
                            address_type: addressType,
                        },
                        token
                    );
                    Alert.alert(
                        "Success 🎉",
                        `${addressType === "present" ? "Present" : "Permanent"} address updated successfully!`
                    );
                    break;
                }
                case "physical": {
                    await memberService.updatePhysicalAttributes(
                        {
                            height: Number(physical.height) || 5.8,
                            weight: Number(physical.weight) || 65,
                            eye_color: physical.eye_color,
                            hair_color: physical.hair_color,
                            complexion: physical.complexion,
                            blood_group: physical.blood_group,
                            body_type: physical.body_type,
                            body_art: physical.body_art,
                            disability: physical.disability,
                        },
                        token
                    );
                    Alert.alert("Success 🎉", "Physical attributes updated successfully!");
                    break;
                }
                case "language": {
                    await memberService.updateLanguage(
                        {
                            mothere_tongue: language.mothere_tongue,
                            known_languages: language.known_languages,
                        },
                        token
                    );
                    Alert.alert("Success 🎉", "Language details updated successfully!");
                    break;
                }
                case "hobbies": {
                    await memberService.updateHobbies(hobbies, token);
                    Alert.alert("Success 🎉", "Hobbies and interests updated successfully!");
                    break;
                }
                case "attitude": {
                    await memberService.updateAttitudeBehavior(attitude, token);
                    Alert.alert("Success 🎉", "Attitude and behavior updated successfully!");
                    break;
                }
                case "residency": {
                    await memberService.updateResidencyInfo(residency, token);
                    Alert.alert("Success 🎉", "Residency details updated successfully!");
                    break;
                }
                case "spiritual": {
                    await memberService.updateSpiritualBackground(spiritual, token);
                    Alert.alert("Success 🎉", "Spiritual background updated successfully!");
                    break;
                }
                case "lifestyle": {
                    await memberService.updateLifestyle(lifestyle, token);
                    Alert.alert("Success 🎉", "Lifestyle updated successfully!");
                    break;
                }
                case "astronomic": {
                    await memberService.updateAstronomic(astronomic, token);
                    Alert.alert("Success 🎉", "Astronomic / horoscope details updated successfully!");
                    break;
                }
                case "family": {
                    await memberService.updateFamilyInfo(family, token);
                    Alert.alert("Success 🎉", "Family information updated successfully!");
                    break;
                }
                case "partner": {
                    const partnerPayload = {
                        ...partnerExpectation,
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
                        partner_state_id: Number(partnerExpectation.partner_state_id) || Number(presentAddress.state_id) || 1,
                        partner_religion_id: Number(partnerExpectation.partner_religion_id) || Number(spiritual.member_religion_id) || 1,
                        partner_caste_id: Number(partnerExpectation.partner_caste_id) || Number(spiritual.member_caste_id) || 1,
                        partner_sub_caste_id: Number(partnerExpectation.partner_sub_caste_id) || Number(spiritual.member_sub_caste_id) || 1,
                        partner_marital_status: Number(partnerExpectation.partner_marital_status) || 1,
                        language_id: Number(partnerExpectation.language_id) || 1,
                        family_value_id: Number(partnerExpectation.family_value_id) || Number(spiritual.family_value_id) || 1,
                        pertner_education: partnerExpectation.pertner_education || partnerExpectation.partner_education || "Graduate",
                        partner_education: partnerExpectation.pertner_education || partnerExpectation.partner_education || "Graduate",
                        pertner_complexion: partnerExpectation.pertner_complexion || partnerExpectation.partner_complexion || "Fair",
                        partner_complexion: partnerExpectation.pertner_complexion || partnerExpectation.partner_complexion || "Fair",
                    };
                    await memberService.updatePartnerExpectation(partnerPayload, token);
                    Alert.alert("Success 🎉", "Partner expectations updated successfully!");
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
            if (!friendly || lower.includes("server error") || lower.includes("500") || lower.includes("request failed with status")) {
                const recheck = validateSection(sectionKey);
                if (!recheck.isValid) {
                    friendly = recheck.errorMessage;
                    setMissingFields((prev) => ({ ...prev, [sectionKey]: recheck.missing }));
                } else {
                    friendly = "Unable to save details. Please verify your entries and try again.";
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
                            const { status } = await ImagePicker.requestCameraPermissionsAsync();
                            if (status !== "granted") {
                                Alert.alert("Permission Required", "Camera access is needed to take a profile picture.");
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
                            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                            if (status !== "granted") {
                                Alert.alert("Permission Required", "Photo library access is needed to choose a profile picture.");
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
                            Alert.alert("Error", err?.message || "Could not open photo library.");
                        }
                    },
                },
            ]
        );
    };

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
                    first_name: basicInfo.first_name,
                    last_name: basicInfo.last_name,
                    email: contactInfo.email || basicInfo.email,
                    phone: contactInfo.phone || basicInfo.phone,
                    gender: basicInfo.gender,
                    date_of_birth: basicInfo.date_of_birth,
                    on_behalf: basicInfo.on_behalf,
                    marital_status: basicInfo.marital_status,
                },
                token
            );

            const serverUrl = response?.data?.photo || response?.photo || asset.uri;
            setLocalAvatar(serverUrl);
            if (updateUser) {
                updateUser({ avatar: serverUrl, avatar_original: serverUrl });
            }
            emitMemberAction({ type: "profile_updated", photo: serverUrl });
            Alert.alert("Success 🎉", "Profile photo updated successfully!");
        } catch (err) {
            console.log("EditProfile avatar upload error:", err?.message);
            Alert.alert("Upload Notice", err?.message || "Profile photo updated locally.");
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSaveCurrent = () => {
        handleSaveSection(expandedSection || "basic");
    };

    const fullName = `${basicInfo.first_name} ${basicInfo.last_name}`.trim() || user?.name || "Member Profile";
    const userEmail = contactInfo.email || basicInfo.email || user?.email || "";
    const userPhone = contactInfo.phone || basicInfo.phone || user?.phone || "";
    const userAvatar = localAvatar || user?.avatar_original || user?.avatar || DEFAULT_AVATAR;

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            <ScreenHeader
                title="Edit Profile"
                subtitle="Complete all details for ideal matches"
                showBack
                onBack={() => navigation.goBack()}
                rightElement={
                    <TouchableOpacity
                        style={[styles.saveBtn, Boolean(savingSection) && styles.saveBtnDisabled]}
                        onPress={handleSaveCurrent}
                        disabled={Boolean(savingSection)}
                        activeOpacity={0.8}
                    >
                        {savingSection ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.saveBtnText}>Save</Text>
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
                {/* Top Profile Summary Card */}
                <View style={styles.userCard}>
                    <View style={styles.userCardTop}>
                        <View style={styles.avatarWrap}>
                            <Image
                                source={{ uri: userAvatar }}
                                style={styles.avatarImg}
                                resizeMode="cover"
                            />
                            {uploadingAvatar ? (
                                <View style={styles.avatarLoadingOverlay}>
                                    <ActivityIndicator size="small" color="#fff" />
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.cameraIconWrap}
                                    onPress={promptProfilePhoto}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="camera" size={14} color="#fff" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.userInfoCol}>
                            <Text style={styles.userName}>{fullName}</Text>
                            {userEmail ? <Text style={styles.userEmail}>{userEmail}</Text> : null}
                            {userPhone ? <Text style={styles.userPhone}>{userPhone}</Text> : null}
                            {memberCode ? (
                                <View style={styles.badgePill}>
                                    <Text style={styles.badgeText}>ID: {memberCode}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </View>

                {loading && (
                    <View style={styles.loadingBanner}>
                        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.loadingBannerText}>Loading profile data from server...</Text>
                    </View>
                )}

                {/* ============================================================== */}
                {/* 1. Introduction (About Me)                                      */}
                {/* ============================================================== */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("introduction")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#FFF0F5" }]}>
                            <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>About Me (Introduction)</Text>
                            <Text style={styles.sectionStatus}>
                                {introduction ? `${introduction.length} characters` : "Write brief bio"}
                            </Text>
                        </View>
                        {introduction ? (
                            <View style={styles.completedPill}>
                                <Text style={styles.completedPillText}>Filled</Text>
                            </View>
                        ) : null}
                        <Ionicons
                            name={expandedSection === "introduction" ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={COLORS.textLight}
                            style={{ marginLeft: 6 }}
                        />
                    </TouchableOpacity>

                    {expandedSection === "introduction" && (
                        <View style={styles.accordionBody}>
                            {sectionErrors.introduction ? (
                                <View style={styles.sectionErrorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2, marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionErrorTitle}>Please Fix Required Details</Text>
                                        <Text style={styles.sectionErrorText}>{sectionErrors.introduction}</Text>
                                    </View>
                                </View>
                            ) : null}

                            <Text style={styles.inputLabel}>Introduction Bio</Text>
                            <TextInput
                                style={[styles.input, styles.textArea, isFieldMissing("introduction", "introduction") && styles.inputMissing]}
                                value={introduction}
                                onChangeText={(t) => {
                                    clearFieldError("introduction", "introduction");
                                    setIntroduction(t);
                                }}
                                placeholder="Tell prospective matches about your personality, background, and what you are looking for..."
                                placeholderTextColor={COLORS.textLight}
                                multiline
                                numberOfLines={4}
                            />
                            {isFieldMissing("introduction", "introduction") && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* Introduction bio missing</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.sectionSaveBtn, savingSection === "introduction" && styles.saveBtnDisabled]}
                                onPress={() => handleSaveSection("introduction")}
                                disabled={savingSection === "introduction"}
                                activeOpacity={0.8}
                            >
                                {savingSection === "introduction" ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sectionSaveBtnText}>Save Introduction</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ============================================================== */}
                {/* 2. Basic Information (WITH RED PILL MISSING BADGE)             */}
                {/* ============================================================== */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("basic")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#FFE8EE" }]}>
                            <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Basic Information</Text>
                            <Text style={styles.sectionStatus}>Name, DOB, Gender, Marital Status</Text>
                        </View>

                        {/* RED PILL / COMPLETED BADGE */}
                        {basicMissingFields.length > 0 ? (
                            <View style={styles.missingPill}>
                                <Ionicons name="alert-circle" size={11} color="#DC2626" style={{ marginRight: 3 }} />
                                <Text style={styles.missingPillText}>{basicMissingFields.length} info missing</Text>
                            </View>
                        ) : (
                            <View style={styles.completedPill}>
                                <Ionicons name="checkmark-circle" size={11} color="#059669" style={{ marginRight: 3 }} />
                                <Text style={styles.completedPillText}>Completed</Text>
                            </View>
                        )}

                        <Ionicons
                            name={expandedSection === "basic" ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={COLORS.textLight}
                            style={{ marginLeft: 6 }}
                        />
                    </TouchableOpacity>

                    {expandedSection === "basic" && (
                        <View style={styles.accordionBody}>
                            {/* Inline Section Error Banner */}
                            {sectionErrors.basic ? (
                                <View style={styles.sectionErrorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2, marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionErrorTitle}>Please Fix Required Details</Text>
                                        <Text style={styles.sectionErrorText}>{sectionErrors.basic}</Text>
                                    </View>
                                </View>
                            ) : null}

                            {/* Missing Alert Prompt */}
                            {basicMissingFields.length > 0 && !sectionErrors.basic && (
                                <View style={styles.missingBanner}>
                                    <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                                    <Text style={styles.missingBannerText}>
                                        Missing: {basicMissingFields.map((f) => f.label).join(", ")}
                                    </Text>
                                </View>
                            )}

                            {/* First Name */}
                            <Text style={styles.inputLabel}>
                                First Name <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TextInput
                                style={[styles.input, (!basicInfo.first_name || isFieldMissing("basic", "first_name")) && styles.inputMissing]}
                                value={basicInfo.first_name}
                                onChangeText={(t) => {
                                    clearFieldError("basic", "first_name");
                                    setBasicInfo((p) => ({ ...p, first_name: t }));
                                }}
                                placeholder="Enter first name"
                                placeholderTextColor={COLORS.textLight}
                            />
                            {(!basicInfo.first_name || isFieldMissing("basic", "first_name")) && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* First Name missing</Text>
                                </View>
                            )}

                            {/* Last Name */}
                            <Text style={styles.inputLabel}>Last Name</Text>
                            <TextInput
                                style={styles.input}
                                value={basicInfo.last_name}
                                onChangeText={(t) => setBasicInfo((p) => ({ ...p, last_name: t }))}
                                placeholder="Enter last name"
                                placeholderTextColor={COLORS.textLight}
                            />

                            {/* Gender */}
                            <Text style={styles.inputLabel}>
                                Gender <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <View style={styles.toggleRow}>
                                {["Male", "Female"].map((g) => {
                                    const active = String(basicInfo.gender).toLowerCase() === g.toLowerCase();
                                    return (
                                        <TouchableOpacity
                                            key={g}
                                            style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                                            onPress={() => {
                                                clearFieldError("basic", "gender");
                                                setBasicInfo((p) => ({ ...p, gender: g }));
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.toggleBtnText, active && styles.toggleBtnTextActive]}>
                                                {g === "Male" ? "👨 Male" : "👩 Female"}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Date of Birth */}
                            <Text style={styles.inputLabel}>
                                Date of Birth (YYYY-MM-DD) <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TextInput
                                style={[styles.input, (!basicInfo.date_of_birth || isFieldMissing("basic", "date_of_birth")) && styles.inputMissing]}
                                value={basicInfo.date_of_birth}
                                onChangeText={(t) => {
                                    clearFieldError("basic", "date_of_birth");
                                    setBasicInfo((p) => ({ ...p, date_of_birth: t }));
                                }}
                                placeholder="YYYY-MM-DD (e.g. 1995-05-15)"
                                placeholderTextColor={COLORS.textLight}
                            />
                            {(!basicInfo.date_of_birth || isFieldMissing("basic", "date_of_birth")) && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* Date of Birth missing</Text>
                                </View>
                            )}

                            {/* Marital Status */}
                            <Text style={styles.inputLabel}>
                                Marital Status <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TouchableOpacity
                                style={[styles.selectorBtn, (!basicInfo.marital_status || isFieldMissing("basic", "marital_status")) && styles.inputMissing]}
                                onPress={() =>
                                    setPickerModal({
                                        visible: true,
                                        title: "Select Marital Status",
                                        options: maritalStatusList,
                                        selectedId: basicInfo.marital_status,
                                        onSelect: (item) => {
                                            clearFieldError("basic", "marital_status");
                                            setBasicInfo((p) => ({ ...p, marital_status: item.id }));
                                            setPickerModal((prev) => ({ ...prev, visible: false }));
                                        },
                                    })
                                }
                                activeOpacity={0.7}
                            >
                                <Text style={styles.selectorBtnText}>
                                    {getOptionName(maritalStatusList, basicInfo.marital_status, "Select Marital Status")}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>
                            {(!basicInfo.marital_status || isFieldMissing("basic", "marital_status")) && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* Marital Status missing</Text>
                                </View>
                            )}

                            {/* Profile Created By (On Behalf) */}
                            <Text style={styles.inputLabel}>
                                Profile Created By (On Behalf) <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TouchableOpacity
                                style={[styles.selectorBtn, (!basicInfo.on_behalf || isFieldMissing("basic", "on_behalf")) && styles.inputMissing]}
                                onPress={() =>
                                    setPickerModal({
                                        visible: true,
                                        title: "Select Profile Created For",
                                        options: onBehalfList,
                                        selectedId: basicInfo.on_behalf,
                                        onSelect: (item) => {
                                            clearFieldError("basic", "on_behalf");
                                            setBasicInfo((p) => ({ ...p, on_behalf: item.id }));
                                            setPickerModal((prev) => ({ ...prev, visible: false }));
                                        },
                                    })
                                }
                                activeOpacity={0.7}
                            >
                                <Text style={styles.selectorBtnText}>
                                    {getOptionName(onBehalfList, basicInfo.on_behalf, "Select On Behalf")}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>
                            {(!basicInfo.on_behalf || isFieldMissing("basic", "on_behalf")) && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* On Behalf missing</Text>
                                </View>
                            )}

                            {/* Number of Children */}
                            <Text style={styles.inputLabel}>Number of Children</Text>
                            <TextInput
                                style={styles.input}
                                value={String(basicInfo.children || "")}
                                onChangeText={(t) => setBasicInfo((p) => ({ ...p, children: t }))}
                                placeholder="0"
                                placeholderTextColor={COLORS.textLight}
                                keyboardType="numeric"
                            />

                            <TouchableOpacity
                                style={[styles.sectionSaveBtn, savingSection === "basic" && styles.saveBtnDisabled]}
                                onPress={() => handleSaveSection("basic")}
                                disabled={savingSection === "basic"}
                                activeOpacity={0.8}
                            >
                                {savingSection === "basic" ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sectionSaveBtnText}>Save Basic Info</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ============================================================== */}
                {/* 3. Contact Information                                         */}
                {/* ============================================================== */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("contact")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#EBF9F5" }]}>
                            <Ionicons name="call-outline" size={18} color="#059669" />
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Contact Information</Text>
                            <Text style={styles.sectionStatus}>Phone & Email Address</Text>
                        </View>
                        {contactInfo.phone && contactInfo.email ? (
                            <View style={styles.completedPill}>
                                <Text style={styles.completedPillText}>Verified</Text>
                            </View>
                        ) : null}
                        <Ionicons
                            name={expandedSection === "contact" ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={COLORS.textLight}
                            style={{ marginLeft: 6 }}
                        />
                    </TouchableOpacity>

                    {expandedSection === "contact" && (
                        <View style={styles.accordionBody}>
                            {/* Inline Section Error Banner */}
                            {sectionErrors.contact ? (
                                <View style={styles.sectionErrorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2, marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionErrorTitle}>Please Fix Required Details</Text>
                                        <Text style={styles.sectionErrorText}>{sectionErrors.contact}</Text>
                                    </View>
                                </View>
                            ) : null}

                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput
                                style={[styles.input, isFieldMissing("contact", "phone") && styles.inputMissing]}
                                value={contactInfo.phone}
                                onChangeText={(t) => {
                                    clearFieldError("contact", "phone");
                                    setContactInfo((p) => ({ ...p, phone: t }));
                                }}
                                placeholder="Enter phone number"
                                placeholderTextColor={COLORS.textLight}
                                keyboardType="phone-pad"
                            />
                            {isFieldMissing("contact", "phone") && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* Phone Number missing</Text>
                                </View>
                            )}

                            <Text style={styles.inputLabel}>Email Address</Text>
                            <TextInput
                                style={[styles.input, isFieldMissing("contact", "email") && styles.inputMissing]}
                                value={contactInfo.email}
                                onChangeText={(t) => {
                                    clearFieldError("contact", "email");
                                    setContactInfo((p) => ({ ...p, email: t }));
                                }}
                                placeholder="Enter email address"
                                placeholderTextColor={COLORS.textLight}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                            {isFieldMissing("contact", "email") && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* Email Address missing</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.sectionSaveBtn, savingSection === "contact" && styles.saveBtnDisabled]}
                                onPress={() => handleSaveSection("contact")}
                                disabled={savingSection === "contact"}
                                activeOpacity={0.8}
                            >
                                {savingSection === "contact" ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sectionSaveBtnText}>Save Contact Info</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ============================================================== */}
                {/* 4. Address Details (Present / Permanent)                       */}
                {/* ============================================================== */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("address")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#EFF6FF" }]}>
                            <Ionicons name="location-outline" size={18} color="#2563EB" />
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Address Details</Text>
                            <Text style={styles.sectionStatus}>Present & Permanent Addresses</Text>
                        </View>
                        {addressMissingCount > 0 ? (
                            <View style={styles.missingPill}>
                                <Text style={styles.missingPillText}>{addressMissingCount} missing</Text>
                            </View>
                        ) : (
                            <View style={styles.completedPill}>
                                <Text style={styles.completedPillText}>Filled</Text>
                            </View>
                        )}
                        <Ionicons
                            name={expandedSection === "address" ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={COLORS.textLight}
                            style={{ marginLeft: 6 }}
                        />
                    </TouchableOpacity>

                    {expandedSection === "address" && (
                        <View style={styles.accordionBody}>
                            {/* Inline Section Error Banner */}
                            {sectionErrors.address ? (
                                <View style={styles.sectionErrorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2, marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionErrorTitle}>Please Fix Required Details</Text>
                                        <Text style={styles.sectionErrorText}>{sectionErrors.address}</Text>
                                    </View>
                                </View>
                            ) : null}

                            <View style={styles.addressTabRow}>
                                <TouchableOpacity
                                    style={[styles.addressTabBtn, addressType === "present" && styles.addressTabBtnActive]}
                                    onPress={() => setAddressType("present")}
                                >
                                    <Text style={[styles.addressTabText, addressType === "present" && styles.addressTabTextActive]}>
                                        Present Address
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.addressTabBtn, addressType === "permanent" && styles.addressTabBtnActive]}
                                    onPress={() => setAddressType("permanent")}
                                >
                                    <Text style={[styles.addressTabText, addressType === "permanent" && styles.addressTabTextActive]}>
                                        Permanent Address
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {(() => {
                                const activeAddr = addressType === "present" ? presentAddress : permanentAddress;
                                const setAddr = addressType === "present" ? setPresentAddress : setPermanentAddress;
                                const filteredStates = stateList.filter(
                                    (s) => !activeAddr.country_id || String(s.country_id) === String(activeAddr.country_id)
                                );
                                const filteredCities = cityList.filter(
                                    (c) => !activeAddr.state_id || String(c.state_id) === String(activeAddr.state_id)
                                );

                                return (
                                    <>
                                        {/* Country */}
                                        <Text style={styles.inputLabel}>
                                            Country <Text style={styles.requiredStar}>*</Text>
                                        </Text>
                                        <TouchableOpacity
                                            style={[styles.selectorBtn, isFieldMissing("address", "country_id") && styles.inputMissing]}
                                            onPress={() =>
                                                setPickerModal({
                                                    visible: true,
                                                    title: "Select Country",
                                                    options: countryList,
                                                    selectedId: activeAddr.country_id,
                                                    onSelect: (item) => {
                                                        clearFieldError("address", "country_id");
                                                        setAddr((p) => ({ ...p, country_id: item.id, state_id: null, city_id: null }));
                                                        setPickerModal((prev) => ({ ...prev, visible: false }));
                                                    },
                                                })
                                            }
                                        >
                                            <Text style={styles.selectorBtnText}>
                                                {getOptionName(countryList, activeAddr.country_id, "Select Country")}
                                            </Text>
                                            <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                                        </TouchableOpacity>
                                        {isFieldMissing("address", "country_id") && (
                                            <View style={styles.missingUnderRow}>
                                                <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                                <Text style={styles.missingUnderText}>* Country missing</Text>
                                            </View>
                                        )}

                                        {/* State */}
                                        <Text style={styles.inputLabel}>
                                            State <Text style={styles.requiredStar}>*</Text>
                                        </Text>
                                        <TouchableOpacity
                                            style={[styles.selectorBtn, isFieldMissing("address", "state_id") && styles.inputMissing]}
                                            onPress={() =>
                                                setPickerModal({
                                                    visible: true,
                                                    title: "Select State",
                                                    options: filteredStates.length ? filteredStates : stateList,
                                                    selectedId: activeAddr.state_id,
                                                    onSelect: (item) => {
                                                        clearFieldError("address", "state_id");
                                                        setAddr((p) => ({ ...p, state_id: item.id, city_id: null }));
                                                        setPickerModal((prev) => ({ ...prev, visible: false }));
                                                    },
                                                })
                                            }
                                        >
                                            <Text style={styles.selectorBtnText}>
                                                {getOptionName(stateList, activeAddr.state_id, "Select State")}
                                            </Text>
                                            <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                                        </TouchableOpacity>
                                        {isFieldMissing("address", "state_id") && (
                                            <View style={styles.missingUnderRow}>
                                                <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                                <Text style={styles.missingUnderText}>* State missing</Text>
                                            </View>
                                        )}

                                        {/* City */}
                                        <Text style={styles.inputLabel}>
                                            City <Text style={styles.requiredStar}>*</Text>
                                        </Text>
                                        <TouchableOpacity
                                            style={[styles.selectorBtn, isFieldMissing("address", "city_id") && styles.inputMissing]}
                                            onPress={() =>
                                                setPickerModal({
                                                    visible: true,
                                                    title: "Select City",
                                                    options: filteredCities.length ? filteredCities : cityList,
                                                    selectedId: activeAddr.city_id,
                                                    onSelect: (item) => {
                                                        clearFieldError("address", "city_id");
                                                        setAddr((p) => ({ ...p, city_id: item.id }));
                                                        setPickerModal((prev) => ({ ...prev, visible: false }));
                                                    },
                                                })
                                            }
                                        >
                                            <Text style={styles.selectorBtnText}>
                                                {getOptionName(cityList, activeAddr.city_id, "Select City")}
                                            </Text>
                                            <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                                        </TouchableOpacity>
                                        {isFieldMissing("address", "city_id") && (
                                            <View style={styles.missingUnderRow}>
                                                <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                                <Text style={styles.missingUnderText}>* City missing</Text>
                                            </View>
                                        )}

                                        {/* Postal Code */}
                                        <Text style={styles.inputLabel}>
                                            Postal / PIN Code <Text style={styles.requiredStar}>*</Text>
                                        </Text>
                                        <TextInput
                                            style={[styles.input, (!activeAddr.postal_code || isFieldMissing("address", "postal_code")) && styles.inputMissing]}
                                            value={activeAddr.postal_code}
                                            onChangeText={(t) => {
                                                clearFieldError("address", "postal_code");
                                                setAddr((p) => ({ ...p, postal_code: t }));
                                            }}
                                            placeholder="e.g. 110001"
                                            placeholderTextColor={COLORS.textLight}
                                            keyboardType="numeric"
                                        />
                                        {(!activeAddr.postal_code || isFieldMissing("address", "postal_code")) && (
                                            <View style={styles.missingUnderRow}>
                                                <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                                <Text style={styles.missingUnderText}>* Postal / PIN Code missing</Text>
                                            </View>
                                        )}
                                    </>
                                );
                            })()}

                            <TouchableOpacity
                                style={[styles.sectionSaveBtn, savingSection === "address" && styles.saveBtnDisabled]}
                                onPress={() => handleSaveSection("address")}
                                disabled={savingSection === "address"}
                                activeOpacity={0.8}
                            >
                                {savingSection === "address" ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sectionSaveBtnText}>
                                        Save {addressType === "present" ? "Present" : "Permanent"} Address
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ============================================================== */}
                {/* 5. Physical Attributes                                         */}
                {/* ============================================================== */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("physical")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#FDF4FF" }]}>
                            <Ionicons name="body-outline" size={18} color="#A855F7" />
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Physical Attributes</Text>
                            <Text style={styles.sectionStatus}>{physical.height} ft • {physical.weight} kg</Text>
                        </View>
                        <Ionicons
                            name={expandedSection === "physical" ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={COLORS.textLight}
                        />
                    </TouchableOpacity>

                    {expandedSection === "physical" && (
                        <View style={styles.accordionBody}>
                            {/* Inline Section Error Banner */}
                            {sectionErrors.physical ? (
                                <View style={styles.sectionErrorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2, marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionErrorTitle}>Please Fix Required Details</Text>
                                        <Text style={styles.sectionErrorText}>{sectionErrors.physical}</Text>
                                    </View>
                                </View>
                            ) : null}

                            <View style={styles.twoColRow}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.inputLabel}>
                                        Height (ft) <Text style={styles.requiredStar}>*</Text>
                                    </Text>
                                    <TextInput
                                        style={[styles.input, (!physical.height || isFieldMissing("physical", "height")) && styles.inputMissing]}
                                        value={String(physical.height)}
                                        onChangeText={(t) => {
                                            clearFieldError("physical", "height");
                                            setPhysical((p) => ({ ...p, height: t }));
                                        }}
                                        placeholder="5.8"
                                        placeholderTextColor={COLORS.textLight}
                                        keyboardType="decimal-pad"
                                    />
                                    {(!physical.height || isFieldMissing("physical", "height")) && (
                                        <View style={styles.missingUnderRow}>
                                            <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                            <Text style={styles.missingUnderText}>* Height missing</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={styles.inputLabel}>
                                        Weight (kg) <Text style={styles.requiredStar}>*</Text>
                                    </Text>
                                    <TextInput
                                        style={[styles.input, (!physical.weight || isFieldMissing("physical", "weight")) && styles.inputMissing]}
                                        value={String(physical.weight)}
                                        onChangeText={(t) => {
                                            clearFieldError("physical", "weight");
                                            setPhysical((p) => ({ ...p, weight: t }));
                                        }}
                                        placeholder="65"
                                        placeholderTextColor={COLORS.textLight}
                                        keyboardType="decimal-pad"
                                    />
                                    {(!physical.weight || isFieldMissing("physical", "weight")) && (
                                        <View style={styles.missingUnderRow}>
                                            <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                            <Text style={styles.missingUnderText}>* Weight missing</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Blood Group</Text>
                            <View style={styles.toggleRowWrap}>
                                {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => {
                                    const active = physical.blood_group === bg;
                                    return (
                                        <TouchableOpacity
                                            key={bg}
                                            style={[styles.chipBtn, active && styles.chipBtnActive]}
                                            onPress={() => setPhysical((p) => ({ ...p, blood_group: bg }))}
                                        >
                                            <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>
                                                {bg}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.inputLabel}>Complexion</Text>
                            <View style={styles.toggleRowWrap}>
                                {["Very Fair", "Fair", "Wheatish", "Dusky", "Dark"].map((c) => {
                                    const active = physical.complexion === c;
                                    return (
                                        <TouchableOpacity
                                            key={c}
                                            style={[styles.chipBtn, active && styles.chipBtnActive]}
                                            onPress={() => setPhysical((p) => ({ ...p, complexion: c }))}
                                        >
                                            <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>
                                                {c}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.inputLabel}>Body Type</Text>
                            <View style={styles.toggleRowWrap}>
                                {["Slim", "Athletic", "Average", "Heavy"].map((bt) => {
                                    const active = physical.body_type === bt;
                                    return (
                                        <TouchableOpacity
                                            key={bt}
                                            style={[styles.chipBtn, active && styles.chipBtnActive]}
                                            onPress={() => setPhysical((p) => ({ ...p, body_type: bt }))}
                                        >
                                            <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>
                                                {bt}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <TouchableOpacity
                                style={[styles.sectionSaveBtn, savingSection === "physical" && styles.saveBtnDisabled]}
                                onPress={() => handleSaveSection("physical")}
                                disabled={savingSection === "physical"}
                                activeOpacity={0.8}
                            >
                                {savingSection === "physical" ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sectionSaveBtnText}>Save Physical Attributes</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ============================================================== */}
                {/* 6. Language Details                                            */}
                {/* ============================================================== */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("language")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#FEF3C7" }]}>
                            <Ionicons name="chatbubbles-outline" size={18} color="#D97706" />
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Language Details</Text>
                            <Text style={styles.sectionStatus}>{language.mothere_tongue || "Mother tongue"}</Text>
                        </View>
                        <Ionicons
                            name={expandedSection === "language" ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={COLORS.textLight}
                        />
                    </TouchableOpacity>

                    {expandedSection === "language" && (
                        <View style={styles.accordionBody}>
                            {/* Inline Section Error Banner */}
                            {sectionErrors.language ? (
                                <View style={styles.sectionErrorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2, marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionErrorTitle}>Please Fix Required Details</Text>
                                        <Text style={styles.sectionErrorText}>{sectionErrors.language}</Text>
                                    </View>
                                </View>
                            ) : null}

                            <Text style={styles.inputLabel}>
                                Mother Tongue <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            {languageList.length > 0 ? (
                                <TouchableOpacity
                                    style={[styles.selectorBtn, (!language.mothere_tongue || isFieldMissing("language", "mothere_tongue")) && styles.inputMissing]}
                                    onPress={() =>
                                        setPickerModal({
                                            visible: true,
                                            title: "Select Mother Tongue",
                                            options: languageList,
                                            selectedId: language.mothere_tongue,
                                            onSelect: (item) => {
                                                clearFieldError("language", "mothere_tongue");
                                                setLanguage((p) => ({ ...p, mothere_tongue: item.name }));
                                                setPickerModal((prev) => ({ ...prev, visible: false }));
                                            },
                                        })
                                    }
                                >
                                    <Text style={styles.selectorBtnText}>
                                        {language.mothere_tongue || "Select Mother Tongue"}
                                    </Text>
                                    <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                                </TouchableOpacity>
                            ) : (
                                <TextInput
                                    style={[styles.input, (!language.mothere_tongue || isFieldMissing("language", "mothere_tongue")) && styles.inputMissing]}
                                    value={language.mothere_tongue}
                                    onChangeText={(t) => {
                                        clearFieldError("language", "mothere_tongue");
                                        setLanguage((p) => ({ ...p, mothere_tongue: t }));
                                    }}
                                    placeholder="e.g. Hindi, Tamil, Bengali, Telugu"
                                    placeholderTextColor={COLORS.textLight}
                                />
                            )}
                            {(!language.mothere_tongue || isFieldMissing("language", "mothere_tongue")) && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* Mother Tongue missing</Text>
                                </View>
                            )}

                            <Text style={styles.inputLabel}>
                                Known Languages <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TextInput
                                style={[styles.input, (!language.known_languages || isFieldMissing("language", "known_languages")) && styles.inputMissing]}
                                value={language.known_languages}
                                onChangeText={(t) => {
                                    clearFieldError("language", "known_languages");
                                    setLanguage((p) => ({ ...p, known_languages: t }));
                                }}
                                placeholder="e.g. English, Hindi, Punjabi"
                                placeholderTextColor={COLORS.textLight}
                            />
                            {(!language.known_languages || isFieldMissing("language", "known_languages")) && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* Known Languages missing</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.sectionSaveBtn, savingSection === "language" && styles.saveBtnDisabled]}
                                onPress={() => handleSaveSection("language")}
                                disabled={savingSection === "language"}
                                activeOpacity={0.8}
                            >
                                {savingSection === "language" ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sectionSaveBtnText}>Save Language Details</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ============================================================== */}
                {/* 7. Spiritual & Community Background                            */}
                {/* ============================================================== */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("spiritual")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#FFF7ED" }]}>
                            <Ionicons name="flower-outline" size={18} color="#EA580C" />
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Spiritual & Community Background</Text>
                            <Text style={styles.sectionStatus}>
                                {spiritual.member_religion_id
                                    ? `${getOptionName(religionList, spiritual.member_religion_id, "Religion")}${
                                          spiritual.member_caste_id
                                              ? ` • ${getOptionName(casteList, spiritual.member_caste_id, "")}`
                                              : ""
                                      }`
                                    : "Religion, Caste & Values"}
                            </Text>
                        </View>
                        {spiritualMissingCount > 0 ? (
                            <View style={styles.missingPill}>
                                <Text style={styles.missingPillText}>{spiritualMissingCount} missing</Text>
                            </View>
                        ) : (
                            <View style={styles.completedPill}>
                                <Text style={styles.completedPillText}>Filled</Text>
                            </View>
                        )}
                        <Ionicons
                            name={expandedSection === "spiritual" ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={COLORS.textLight}
                            style={{ marginLeft: 6 }}
                        />
                    </TouchableOpacity>

                    {expandedSection === "spiritual" && (
                        <View style={styles.accordionBody}>
                            {/* Inline Section Error Banner */}
                            {sectionErrors.spiritual ? (
                                <View style={styles.sectionErrorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2, marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionErrorTitle}>Please Fix Required Details</Text>
                                        <Text style={styles.sectionErrorText}>{sectionErrors.spiritual}</Text>
                                    </View>
                                </View>
                            ) : null}

                            {/* Religion */}
                            <Text style={styles.inputLabel}>
                                Religion <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TouchableOpacity
                                style={[styles.selectorBtn, (!spiritual.member_religion_id || isFieldMissing("spiritual", "member_religion_id")) && styles.inputMissing]}
                                onPress={() =>
                                    setPickerModal({
                                        visible: true,
                                        title: "Select Religion",
                                        options: religionList,
                                        selectedId: spiritual.member_religion_id,
                                        onSelect: (item) => {
                                            clearFieldError("spiritual", "member_religion_id");
                                            setSpiritual((p) => ({
                                                ...p,
                                                member_religion_id: item.id,
                                                member_caste_id: null,
                                                member_sub_caste_id: null,
                                            }));
                                            setPickerModal((prev) => ({ ...prev, visible: false }));
                                        },
                                    })
                                }
                            >
                                <Text style={styles.selectorBtnText}>
                                    {getOptionName(religionList, spiritual.member_religion_id, "Select Religion")}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>
                            {(!spiritual.member_religion_id || isFieldMissing("spiritual", "member_religion_id")) && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* Religion missing</Text>
                                </View>
                            )}

                            {/* Caste */}
                            {(() => {
                                const filteredCastes = casteList.filter(
                                    (c) => !spiritual.member_religion_id || String(c.religion_id) === String(spiritual.member_religion_id)
                                );
                                const castesToUse = filteredCastes.length ? filteredCastes : casteList;

                                return (
                                    <>
                                        <Text style={styles.inputLabel}>
                                            Caste <Text style={styles.requiredStar}>*</Text>
                                        </Text>
                                        <TouchableOpacity
                                            style={[styles.selectorBtn, (!spiritual.member_caste_id || isFieldMissing("spiritual", "member_caste_id")) && styles.inputMissing]}
                                            onPress={() =>
                                                setPickerModal({
                                                    visible: true,
                                                    title: "Select Caste",
                                                    options: castesToUse,
                                                    selectedId: spiritual.member_caste_id,
                                                    onSelect: (item) => {
                                                        clearFieldError("spiritual", "member_caste_id");
                                                        setSpiritual((p) => ({
                                                            ...p,
                                                            member_caste_id: item.id,
                                                            member_sub_caste_id: null,
                                                        }));
                                                        setPickerModal((prev) => ({ ...prev, visible: false }));
                                                    },
                                                })
                                            }
                                        >
                                            <Text style={styles.selectorBtnText}>
                                                {getOptionName(casteList, spiritual.member_caste_id, "Select Caste")}
                                            </Text>
                                            <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                                        </TouchableOpacity>
                                        {(!spiritual.member_caste_id || isFieldMissing("spiritual", "member_caste_id")) && (
                                            <View style={styles.missingUnderRow}>
                                                <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                                <Text style={styles.missingUnderText}>* Caste missing</Text>
                                            </View>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Sub Caste */}
                            {(() => {
                                const filteredSubCastes = subCasteList.filter(
                                    (sc) => !spiritual.member_caste_id || String(sc.caste_id) === String(spiritual.member_caste_id)
                                );
                                const subToUse = filteredSubCastes.length ? filteredSubCastes : subCasteList;

                                return (
                                    <>
                                        <Text style={styles.inputLabel}>Sub-Caste</Text>
                                        <TouchableOpacity
                                            style={styles.selectorBtn}
                                            onPress={() =>
                                                setPickerModal({
                                                    visible: true,
                                                    title: "Select Sub-Caste",
                                                    options: subToUse,
                                                    selectedId: spiritual.member_sub_caste_id,
                                                    onSelect: (item) => {
                                                        setSpiritual((p) => ({ ...p, member_sub_caste_id: item.id }));
                                                        setPickerModal((prev) => ({ ...prev, visible: false }));
                                                    },
                                                })
                                            }
                                        >
                                            <Text style={styles.selectorBtnText}>
                                                {getOptionName(subCasteList, spiritual.member_sub_caste_id, "Select Sub-Caste (Optional)")}
                                            </Text>
                                            <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                                        </TouchableOpacity>
                                    </>
                                );
                            })()}

                            {/* Family Value */}
                            <Text style={styles.inputLabel}>Family Value</Text>
                            <TouchableOpacity
                                style={styles.selectorBtn}
                                onPress={() =>
                                    setPickerModal({
                                        visible: true,
                                        title: "Select Family Value",
                                        options: familyValueList,
                                        selectedId: spiritual.family_value_id,
                                        onSelect: (item) => {
                                            setSpiritual((p) => ({ ...p, family_value_id: item.id }));
                                            setPickerModal((prev) => ({ ...prev, visible: false }));
                                        },
                                    })
                                }
                            >
                                <Text style={styles.selectorBtnText}>
                                    {getOptionName(familyValueList, spiritual.family_value_id, "Select Family Value")}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>

                            {/* Ethnicity */}
                            <Text style={styles.inputLabel}>Ethnicity</Text>
                            <TextInput
                                style={styles.input}
                                value={spiritual.ethnicity}
                                onChangeText={(t) => setSpiritual((p) => ({ ...p, ethnicity: t }))}
                                placeholder="e.g. Asian, Indian"
                                placeholderTextColor={COLORS.textLight}
                            />

                            {/* Personal Values */}
                            <Text style={styles.inputLabel}>Personal Values</Text>
                            <View style={styles.toggleRow}>
                                {["Traditional", "Moderate", "Liberal"].map((pv) => {
                                    const active = spiritual.personal_value === pv;
                                    return (
                                        <TouchableOpacity
                                            key={pv}
                                            style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                                            onPress={() => setSpiritual((p) => ({ ...p, personal_value: pv }))}
                                        >
                                            <Text style={[styles.toggleBtnText, active && styles.toggleBtnTextActive]}>
                                                {pv}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <TouchableOpacity
                                style={[styles.sectionSaveBtn, savingSection === "spiritual" && styles.saveBtnDisabled]}
                                onPress={() => handleSaveSection("spiritual")}
                                disabled={savingSection === "spiritual"}
                                activeOpacity={0.8}
                            >
                                {savingSection === "spiritual" ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sectionSaveBtnText}>Save Spiritual Background</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ============================================================== */}
                {/* 8. Lifestyle Details                                           */}
                {/* ============================================================== */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("lifestyle")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#F0FDFA" }]}>
                            <Ionicons name="cafe-outline" size={18} color="#0D9488" />
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Lifestyle & Habits</Text>
                            <Text style={styles.sectionStatus}>{lifestyle.diet}, Living with {lifestyle.living_with}</Text>
                        </View>
                        <Ionicons
                            name={expandedSection === "lifestyle" ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={COLORS.textLight}
                        />
                    </TouchableOpacity>

                    {expandedSection === "lifestyle" && (
                        <View style={styles.accordionBody}>
                            {/* Inline Section Error Banner */}
                            {sectionErrors.lifestyle ? (
                                <View style={styles.sectionErrorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2, marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionErrorTitle}>Please Fix Required Details</Text>
                                        <Text style={styles.sectionErrorText}>{sectionErrors.lifestyle}</Text>
                                    </View>
                                </View>
                            ) : null}

                            <Text style={styles.inputLabel}>Diet Preference</Text>
                            <View style={styles.toggleRowWrap}>
                                {["Vegetarian", "Non-Vegetarian", "Eggetarian", "Vegan", "Jain"].map((d) => {
                                    const active = lifestyle.diet === d;
                                    return (
                                        <TouchableOpacity
                                            key={d}
                                            style={[styles.chipBtn, active && styles.chipBtnActive]}
                                            onPress={() => setLifestyle((p) => ({ ...p, diet: d }))}
                                        >
                                            <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>
                                                {d}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.inputLabel}>Drink</Text>
                            <View style={styles.toggleRow}>
                                {["No", "Occasionally", "Yes"].map((dr) => {
                                    const active = lifestyle.drink === dr;
                                    return (
                                        <TouchableOpacity
                                            key={dr}
                                            style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                                            onPress={() => setLifestyle((p) => ({ ...p, drink: dr }))}
                                        >
                                            <Text style={[styles.toggleBtnText, active && styles.toggleBtnTextActive]}>
                                                {dr}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.inputLabel}>Smoke</Text>
                            <View style={styles.toggleRow}>
                                {["No", "Occasionally", "Yes"].map((sm) => {
                                    const active = lifestyle.smoke === sm;
                                    return (
                                        <TouchableOpacity
                                            key={sm}
                                            style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                                            onPress={() => setLifestyle((p) => ({ ...p, smoke: sm }))}
                                        >
                                            <Text style={[styles.toggleBtnText, active && styles.toggleBtnTextActive]}>
                                                {sm}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.inputLabel}>Living With</Text>
                            <View style={styles.toggleRow}>
                                {["Family", "Alone", "Friends"].map((lw) => {
                                    const active = lifestyle.living_with === lw;
                                    return (
                                        <TouchableOpacity
                                            key={lw}
                                            style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                                            onPress={() => setLifestyle((p) => ({ ...p, living_with: lw }))}
                                        >
                                            <Text style={[styles.toggleBtnText, active && styles.toggleBtnTextActive]}>
                                                {lw}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <TouchableOpacity
                                style={[styles.sectionSaveBtn, savingSection === "lifestyle" && styles.saveBtnDisabled]}
                                onPress={() => handleSaveSection("lifestyle")}
                                disabled={savingSection === "lifestyle"}
                                activeOpacity={0.8}
                            >
                                {savingSection === "lifestyle" ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sectionSaveBtnText}>Save Lifestyle</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ============================================================== */}
                {/* 9. Astronomic / Horoscope                                      */}
                {/* ============================================================== */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("astronomic")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#F5F3FF" }]}>
                            <Ionicons name="planet-outline" size={18} color="#7C3AED" />
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Astronomic / Horoscope</Text>
                            <Text style={styles.sectionStatus}>{astronomic.sun_sign} • {astronomic.moon_sign}</Text>
                        </View>
                        <Ionicons
                            name={expandedSection === "astronomic" ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={COLORS.textLight}
                        />
                    </TouchableOpacity>

                    {expandedSection === "astronomic" && (
                        <View style={styles.accordionBody}>
                            {/* Inline Section Error Banner */}
                            {sectionErrors.astronomic ? (
                                <View style={styles.sectionErrorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2, marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionErrorTitle}>Please Fix Required Details</Text>
                                        <Text style={styles.sectionErrorText}>{sectionErrors.astronomic}</Text>
                                    </View>
                                </View>
                            ) : null}

                            <View style={styles.twoColRow}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.inputLabel}>Sun Sign (Rashi)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={astronomic.sun_sign}
                                        onChangeText={(t) => setAstronomic((p) => ({ ...p, sun_sign: t }))}
                                        placeholder="e.g. Leo"
                                        placeholderTextColor={COLORS.textLight}
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={styles.inputLabel}>Moon Sign (Nakshatra)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={astronomic.moon_sign}
                                        onChangeText={(t) => setAstronomic((p) => ({ ...p, moon_sign: t }))}
                                        placeholder="e.g. Cancer"
                                        placeholderTextColor={COLORS.textLight}
                                    />
                                </View>
                            </View>

                            <View style={styles.twoColRow}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.inputLabel}>Time of Birth</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={astronomic.time_of_birth}
                                        onChangeText={(t) => setAstronomic((p) => ({ ...p, time_of_birth: t }))}
                                        placeholder="e.g. 10:30 AM"
                                        placeholderTextColor={COLORS.textLight}
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={styles.inputLabel}>City of Birth</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={astronomic.city_of_birth}
                                        onChangeText={(t) => setAstronomic((p) => ({ ...p, city_of_birth: t }))}
                                        placeholder="e.g. Delhi"
                                        placeholderTextColor={COLORS.textLight}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.sectionSaveBtn, savingSection === "astronomic" && styles.saveBtnDisabled]}
                                onPress={() => handleSaveSection("astronomic")}
                                disabled={savingSection === "astronomic"}
                                activeOpacity={0.8}
                            >
                                {savingSection === "astronomic" ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sectionSaveBtnText}>Save Astronomic Info</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ============================================================== */}
                {/* 10. Family Information                                         */}
                {/* ============================================================== */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("family")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#FEF2F2" }]}>
                            <Ionicons name="people-outline" size={18} color="#DC2626" />
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Family Information</Text>
                            <Text style={styles.sectionStatus}>Parents & Siblings</Text>
                        </View>
                        <Ionicons
                            name={expandedSection === "family" ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={COLORS.textLight}
                        />
                    </TouchableOpacity>

                    {expandedSection === "family" && (
                        <View style={styles.accordionBody}>
                            {/* Inline Section Error Banner */}
                            {sectionErrors.family ? (
                                <View style={styles.sectionErrorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2, marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionErrorTitle}>Please Fix Required Details</Text>
                                        <Text style={styles.sectionErrorText}>{sectionErrors.family}</Text>
                                    </View>
                                </View>
                            ) : null}

                            <Text style={styles.inputLabel}>{"Father's Occupation"}</Text>
                            <TextInput
                                style={styles.input}
                                value={family.father}
                                onChangeText={(t) => setFamily((p) => ({ ...p, father: t }))}
                                placeholder="e.g. Business, Govt Service, Retired"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <Text style={styles.inputLabel}>{"Mother's Occupation"}</Text>
                            <TextInput
                                style={styles.input}
                                value={family.mother}
                                onChangeText={(t) => setFamily((p) => ({ ...p, mother: t }))}
                                placeholder="e.g. Homemaker, Teacher, Doctor"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <Text style={styles.inputLabel}>Sibling Details</Text>
                            <TextInput
                                style={styles.input}
                                value={family.sibling}
                                onChangeText={(t) => setFamily((p) => ({ ...p, sibling: t }))}
                                placeholder="e.g. 1 Brother (Married), 1 Sister"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <TouchableOpacity
                                style={[styles.sectionSaveBtn, savingSection === "family" && styles.saveBtnDisabled]}
                                onPress={() => handleSaveSection("family")}
                                disabled={savingSection === "family"}
                                activeOpacity={0.8}
                            >
                                {savingSection === "family" ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sectionSaveBtnText}>Save Family Info</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ============================================================== */}
                {/* 11. Hobbies & Interests                                        */}
                {/* ============================================================== */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("hobbies")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#F0FDF4" }]}>
                            <Ionicons name="happy-outline" size={18} color="#16A34A" />
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Hobbies & Interests</Text>
                            <Text style={styles.sectionStatus}>{hobbies.hobbies || "Personal interests"}</Text>
                        </View>
                        <Ionicons
                            name={expandedSection === "hobbies" ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={COLORS.textLight}
                        />
                    </TouchableOpacity>

                    {expandedSection === "hobbies" && (
                        <View style={styles.accordionBody}>
                            {/* Inline Section Error Banner */}
                            {sectionErrors.hobbies ? (
                                <View style={styles.sectionErrorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2, marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionErrorTitle}>Please Fix Required Details</Text>
                                        <Text style={styles.sectionErrorText}>{sectionErrors.hobbies}</Text>
                                    </View>
                                </View>
                            ) : null}

                            <Text style={styles.inputLabel}>Hobbies</Text>
                            <TextInput
                                style={styles.input}
                                value={hobbies.hobbies}
                                onChangeText={(t) => setHobbies((p) => ({ ...p, hobbies: t }))}
                                placeholder="e.g. Reading, Photography, Gardening"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <Text style={styles.inputLabel}>Interests</Text>
                            <TextInput
                                style={styles.input}
                                value={hobbies.interests}
                                onChangeText={(t) => setHobbies((p) => ({ ...p, interests: t }))}
                                placeholder="e.g. Traveling, Technology, Cooking"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <Text style={styles.inputLabel}>Favorite Music</Text>
                            <TextInput
                                style={styles.input}
                                value={hobbies.music}
                                onChangeText={(t) => setHobbies((p) => ({ ...p, music: t }))}
                                placeholder="e.g. Classical, Bollywood, Sufi, Pop"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <Text style={styles.inputLabel}>Sports & Fitness</Text>
                            <TextInput
                                style={styles.input}
                                value={hobbies.sports}
                                onChangeText={(t) => setHobbies((p) => ({ ...p, sports: t }))}
                                placeholder="e.g. Cricket, Badminton, Yoga, Gym"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <TouchableOpacity
                                style={[styles.sectionSaveBtn, savingSection === "hobbies" && styles.saveBtnDisabled]}
                                onPress={() => handleSaveSection("hobbies")}
                                disabled={savingSection === "hobbies"}
                                activeOpacity={0.8}
                            >
                                {savingSection === "hobbies" ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sectionSaveBtnText}>Save Hobbies</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ============================================================== */}
                {/* 12. Partner Expectations                                       */}
                {/* ============================================================== */}
                <View style={styles.accordionCard}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleSection("partner")}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.sectionIconWrap, { backgroundColor: "#FFF1F2" }]}>
                            <Ionicons name="heart-circle-outline" size={18} color={COLORS.primary} />
                        </View>
                        <View style={styles.sectionTitleCol}>
                            <Text style={styles.sectionTitle}>Partner Expectations</Text>
                            <Text style={styles.sectionStatus}>Match preferences & criteria</Text>
                        </View>
                        <Ionicons
                            name={expandedSection === "partner" ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={COLORS.textLight}
                        />
                    </TouchableOpacity>

                    {expandedSection === "partner" && (
                        <View style={styles.accordionBody}>
                            {/* Inline Section Error Banner */}
                            {sectionErrors.partner ? (
                                <View style={styles.sectionErrorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginTop: 2, marginRight: 8 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionErrorTitle}>Please Fix Required Details</Text>
                                        <Text style={styles.sectionErrorText}>{sectionErrors.partner}</Text>
                                    </View>
                                </View>
                            ) : null}

                            {/* General Expectations */}
                            <Text style={styles.inputLabel}>General Expectations</Text>
                            <TextInput
                                style={[styles.input, styles.textArea, isFieldMissing("partner", "general") && styles.inputMissing]}
                                value={partnerExpectation.general}
                                onChangeText={(t) => {
                                    clearFieldError("partner", "general");
                                    setPartnerExpectation((p) => ({ ...p, general: t }));
                                }}
                                placeholder="Looking for an educated, caring, and understanding partner..."
                                placeholderTextColor={COLORS.textLight}
                                multiline
                                numberOfLines={3}
                            />
                            {isFieldMissing("partner", "general") && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* General expectations missing</Text>
                                </View>
                            )}

                            {/* Preferred Height & Weight */}
                            <View style={styles.twoColRow}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.inputLabel}>
                                        Preferred Height (ft) <Text style={styles.requiredStar}>*</Text>
                                    </Text>
                                    <TextInput
                                        style={[styles.input, isFieldMissing("partner", "partner_height") && styles.inputMissing]}
                                        value={partnerExpectation.partner_height}
                                        onChangeText={(t) => {
                                            clearFieldError("partner", "partner_height");
                                            setPartnerExpectation((p) => ({ ...p, partner_height: t }));
                                        }}
                                        placeholder="e.g. 5.6"
                                        placeholderTextColor={COLORS.textLight}
                                    />
                                    {isFieldMissing("partner", "partner_height") && (
                                        <View style={styles.missingUnderRow}>
                                            <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                            <Text style={styles.missingUnderText}>* Height missing</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={styles.inputLabel}>
                                        Preferred Weight (kg) <Text style={styles.requiredStar}>*</Text>
                                    </Text>
                                    <TextInput
                                        style={[styles.input, isFieldMissing("partner", "partner_weight") && styles.inputMissing]}
                                        value={partnerExpectation.partner_weight}
                                        onChangeText={(t) => {
                                            clearFieldError("partner", "partner_weight");
                                            setPartnerExpectation((p) => ({ ...p, partner_weight: t }));
                                        }}
                                        placeholder="e.g. 60"
                                        placeholderTextColor={COLORS.textLight}
                                    />
                                    {isFieldMissing("partner", "partner_weight") && (
                                        <View style={styles.missingUnderRow}>
                                            <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                            <Text style={styles.missingUnderText}>* Weight missing</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Partner Preferred Country */}
                            <Text style={styles.inputLabel}>
                                Preferred Country <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TouchableOpacity
                                style={[styles.selectorBtn, isFieldMissing("partner", "partner_country_id") && styles.inputMissing]}
                                onPress={() =>
                                    setPickerModal({
                                        visible: true,
                                        title: "Select Preferred Country",
                                        options: countryList,
                                        selectedId: partnerExpectation.partner_country_id,
                                        onSelect: (item) => {
                                            clearFieldError("partner", "partner_country_id");
                                            setPartnerExpectation((p) => ({
                                                ...p,
                                                partner_country_id: item.id,
                                                residence_country_id: item.id,
                                                partner_state_id: null,
                                            }));
                                            setPickerModal((prev) => ({ ...prev, visible: false }));
                                        },
                                    })
                                }
                            >
                                <Text style={styles.selectorBtnText}>
                                    {getOptionName(countryList, partnerExpectation.partner_country_id, "Select Country")}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>
                            {isFieldMissing("partner", "partner_country_id") && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* Country missing</Text>
                                </View>
                            )}

                            {/* Partner Preferred State */}
                            <Text style={styles.inputLabel}>
                                Preferred State <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TouchableOpacity
                                style={[styles.selectorBtn, isFieldMissing("partner", "partner_state_id") && styles.inputMissing]}
                                onPress={() => {
                                    const filtered = stateList.filter(
                                        (s) => !partnerExpectation.partner_country_id || String(s.country_id) === String(partnerExpectation.partner_country_id)
                                    );
                                    setPickerModal({
                                        visible: true,
                                        title: "Select Preferred State",
                                        options: filtered.length ? filtered : stateList,
                                        selectedId: partnerExpectation.partner_state_id,
                                        onSelect: (item) => {
                                            clearFieldError("partner", "partner_state_id");
                                            setPartnerExpectation((p) => ({ ...p, partner_state_id: item.id }));
                                            setPickerModal((prev) => ({ ...prev, visible: false }));
                                        },
                                    });
                                }}
                            >
                                <Text style={styles.selectorBtnText}>
                                    {getOptionName(stateList, partnerExpectation.partner_state_id, "Select State")}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>
                            {isFieldMissing("partner", "partner_state_id") && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* State missing</Text>
                                </View>
                            )}

                            {/* Partner Religion */}
                            <Text style={styles.inputLabel}>
                                Partner Religion <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TouchableOpacity
                                style={[styles.selectorBtn, isFieldMissing("partner", "partner_religion_id") && styles.inputMissing]}
                                onPress={() =>
                                    setPickerModal({
                                        visible: true,
                                        title: "Select Partner Religion",
                                        options: religionList,
                                        selectedId: partnerExpectation.partner_religion_id,
                                        onSelect: (item) => {
                                            clearFieldError("partner", "partner_religion_id");
                                            setPartnerExpectation((p) => ({
                                                ...p,
                                                partner_religion_id: item.id,
                                                partner_caste_id: null,
                                                partner_sub_caste_id: null,
                                            }));
                                            setPickerModal((prev) => ({ ...prev, visible: false }));
                                        },
                                    })
                                }
                            >
                                <Text style={styles.selectorBtnText}>
                                    {getOptionName(religionList, partnerExpectation.partner_religion_id, "Select Religion")}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>
                            {isFieldMissing("partner", "partner_religion_id") && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* Religion missing</Text>
                                </View>
                            )}

                            {/* Partner Caste */}
                            <Text style={styles.inputLabel}>Partner Caste</Text>
                            <TouchableOpacity
                                style={styles.selectorBtn}
                                onPress={() => {
                                    const filtered = casteList.filter(
                                        (c) => !partnerExpectation.partner_religion_id || String(c.religion_id) === String(partnerExpectation.partner_religion_id)
                                    );
                                    setPickerModal({
                                        visible: true,
                                        title: "Select Partner Caste",
                                        options: filtered.length ? filtered : casteList,
                                        selectedId: partnerExpectation.partner_caste_id,
                                        onSelect: (item) => {
                                            setPartnerExpectation((p) => ({
                                                ...p,
                                                partner_caste_id: item.id,
                                                partner_sub_caste_id: null,
                                            }));
                                            setPickerModal((prev) => ({ ...prev, visible: false }));
                                        },
                                    });
                                }}
                            >
                                <Text style={styles.selectorBtnText}>
                                    {getOptionName(casteList, partnerExpectation.partner_caste_id, "Any Caste / Select")}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>

                            {/* Partner Sub Caste */}
                            <Text style={styles.inputLabel}>Partner Sub-Caste</Text>
                            <TouchableOpacity
                                style={styles.selectorBtn}
                                onPress={() => {
                                    const filtered = subCasteList.filter(
                                        (sc) => !partnerExpectation.partner_caste_id || String(sc.caste_id) === String(partnerExpectation.partner_caste_id)
                                    );
                                    setPickerModal({
                                        visible: true,
                                        title: "Select Partner Sub-Caste",
                                        options: filtered.length ? filtered : subCasteList,
                                        selectedId: partnerExpectation.partner_sub_caste_id,
                                        onSelect: (item) => {
                                            setPartnerExpectation((p) => ({ ...p, partner_sub_caste_id: item.id }));
                                            setPickerModal((prev) => ({ ...prev, visible: false }));
                                        },
                                    });
                                }}
                            >
                                <Text style={styles.selectorBtnText}>
                                    {getOptionName(subCasteList, partnerExpectation.partner_sub_caste_id, "Any Sub-Caste / Select")}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>

                            {/* Partner Marital Status */}
                            <Text style={styles.inputLabel}>
                                Partner Marital Status <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TouchableOpacity
                                style={[styles.selectorBtn, isFieldMissing("partner", "partner_marital_status") && styles.inputMissing]}
                                onPress={() =>
                                    setPickerModal({
                                        visible: true,
                                        title: "Select Partner Marital Status",
                                        options: maritalStatusList,
                                        selectedId: partnerExpectation.partner_marital_status,
                                        onSelect: (item) => {
                                            clearFieldError("partner", "partner_marital_status");
                                            setPartnerExpectation((p) => ({ ...p, partner_marital_status: item.id }));
                                            setPickerModal((prev) => ({ ...prev, visible: false }));
                                        },
                                    })
                                }
                            >
                                <Text style={styles.selectorBtnText}>
                                    {getOptionName(maritalStatusList, partnerExpectation.partner_marital_status, "Select Marital Status")}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>
                            {isFieldMissing("partner", "partner_marital_status") && (
                                <View style={styles.missingUnderRow}>
                                    <Ionicons name="alert-circle" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.missingUnderText}>* Marital Status missing</Text>
                                </View>
                            )}

                            {/* Partner Children Acceptable (Using wrap chips so "Doesn't Matter" fits comfortably) */}
                            <Text style={styles.inputLabel}>Children Acceptable</Text>
                            <View style={styles.toggleRowWrap}>
                                {["No", "Yes", "Doesn't Matter"].map((opt) => {
                                    const active = partnerExpectation.partner_children_acceptable === opt;
                                    return (
                                        <TouchableOpacity
                                            key={opt}
                                            style={[styles.chipBtn, active && styles.chipBtnActive]}
                                            onPress={() => setPartnerExpectation((p) => ({ ...p, partner_children_acceptable: opt }))}
                                        >
                                            <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>
                                                {opt}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Partner Education */}
                            <Text style={styles.inputLabel}>Partner Education</Text>
                            <TextInput
                                style={styles.input}
                                value={partnerExpectation.pertner_education}
                                onChangeText={(t) => setPartnerExpectation((p) => ({ ...p, pertner_education: t, partner_education: t }))}
                                placeholder="e.g. Graduate, Master's, Any"
                                placeholderTextColor={COLORS.textLight}
                            />

                            {/* Partner Profession */}
                            <Text style={styles.inputLabel}>Partner Profession</Text>
                            <TextInput
                                style={styles.input}
                                value={partnerExpectation.partner_profession}
                                onChangeText={(t) => setPartnerExpectation((p) => ({ ...p, partner_profession: t }))}
                                placeholder="e.g. Engineer, Doctor, CA, Any"
                                placeholderTextColor={COLORS.textLight}
                            />

                            {/* Partner Complexion */}
                            <Text style={styles.inputLabel}>Partner Complexion</Text>
                            <View style={styles.toggleRowWrap}>
                                {["Very Fair", "Fair", "Wheatish", "Dusky", "Dark", "Any"].map((c) => {
                                    const active = (partnerExpectation.pertner_complexion || partnerExpectation.partner_complexion) === c;
                                    return (
                                        <TouchableOpacity
                                            key={c}
                                            style={[styles.chipBtn, active && styles.chipBtnActive]}
                                            onPress={() => setPartnerExpectation((p) => ({ ...p, pertner_complexion: c, partner_complexion: c }))}
                                        >
                                            <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>{c}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Partner Body Type */}
                            <Text style={styles.inputLabel}>Partner Body Type</Text>
                            <View style={styles.toggleRowWrap}>
                                {["Slim", "Athletic", "Average", "Heavy", "Any"].map((bt) => {
                                    const active = partnerExpectation.partner_body_type === bt;
                                    return (
                                        <TouchableOpacity
                                            key={bt}
                                            style={[styles.chipBtn, active && styles.chipBtnActive]}
                                            onPress={() => setPartnerExpectation((p) => ({ ...p, partner_body_type: bt }))}
                                        >
                                            <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>{bt}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Partner Personal Values */}
                            <Text style={styles.inputLabel}>Personal Values</Text>
                            <View style={styles.toggleRowWrap}>
                                {["Traditional", "Moderate", "Liberal", "Any"].map((pv) => {
                                    const active = partnerExpectation.partner_personal_value === pv;
                                    return (
                                        <TouchableOpacity
                                            key={pv}
                                            style={[styles.chipBtn, active && styles.chipBtnActive]}
                                            onPress={() => setPartnerExpectation((p) => ({ ...p, partner_personal_value: pv }))}
                                        >
                                            <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>{pv}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Partner Diet */}
                            <Text style={styles.inputLabel}>Partner Diet</Text>
                            <View style={styles.toggleRowWrap}>
                                {["Vegetarian", "Non-Vegetarian", "Any"].map((d) => {
                                    const active = partnerExpectation.partner_diet === d;
                                    return (
                                        <TouchableOpacity
                                            key={d}
                                            style={[styles.chipBtn, active && styles.chipBtnActive]}
                                            onPress={() => setPartnerExpectation((p) => ({ ...p, partner_diet: d }))}
                                        >
                                            <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>
                                                {d}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Partner Manglik (With Doesn't Matter in chips) */}
                            <Text style={styles.inputLabel}>Partner Manglik</Text>
                            <View style={styles.toggleRowWrap}>
                                {["No", "Yes", "Doesn't Matter"].map((m) => {
                                    const active = partnerExpectation.partner_manglik === m;
                                    return (
                                        <TouchableOpacity
                                            key={m}
                                            style={[styles.chipBtn, active && styles.chipBtnActive]}
                                            onPress={() => setPartnerExpectation((p) => ({ ...p, partner_manglik: m }))}
                                        >
                                            <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>
                                                {m}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Smoking Acceptable (With Doesn't Matter in chips) */}
                            <Text style={styles.inputLabel}>Smoking Acceptable</Text>
                            <View style={styles.toggleRowWrap}>
                                {["No", "Occasionally", "Yes", "Doesn't Matter"].map((sm) => {
                                    const active = partnerExpectation.smoking_acceptable === sm;
                                    return (
                                        <TouchableOpacity
                                            key={sm}
                                            style={[styles.chipBtn, active && styles.chipBtnActive]}
                                            onPress={() => setPartnerExpectation((p) => ({ ...p, smoking_acceptable: sm }))}
                                        >
                                            <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>
                                                {sm}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Drinking Acceptable (With Doesn't Matter in chips) */}
                            <Text style={styles.inputLabel}>Drinking Acceptable</Text>
                            <View style={styles.toggleRowWrap}>
                                {["No", "Occasionally", "Yes", "Doesn't Matter"].map((dr) => {
                                    const active = partnerExpectation.drinking_acceptable === dr;
                                    return (
                                        <TouchableOpacity
                                            key={dr}
                                            style={[styles.chipBtn, active && styles.chipBtnActive]}
                                            onPress={() => setPartnerExpectation((p) => ({ ...p, drinking_acceptable: dr }))}
                                        >
                                            <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>
                                                {dr}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Preferred Mother Tongue */}
                            <Text style={styles.inputLabel}>Preferred Mother Tongue</Text>
                            <TouchableOpacity
                                style={styles.selectorBtn}
                                onPress={() =>
                                    setPickerModal({
                                        visible: true,
                                        title: "Select Preferred Language",
                                        options: languageList,
                                        selectedId: partnerExpectation.language_id,
                                        onSelect: (item) => {
                                            setPartnerExpectation((p) => ({ ...p, language_id: item.id }));
                                            setPickerModal((prev) => ({ ...prev, visible: false }));
                                        },
                                    })
                                }
                            >
                                <Text style={styles.selectorBtnText}>
                                    {getOptionName(languageList, partnerExpectation.language_id, "Any / Select Language")}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>

                            {/* Preferred Family Value */}
                            <Text style={styles.inputLabel}>Preferred Family Value</Text>
                            <TouchableOpacity
                                style={styles.selectorBtn}
                                onPress={() =>
                                    setPickerModal({
                                        visible: true,
                                        title: "Select Preferred Family Value",
                                        options: familyValueList,
                                        selectedId: partnerExpectation.family_value_id,
                                        onSelect: (item) => {
                                            setPartnerExpectation((p) => ({ ...p, family_value_id: item.id }));
                                            setPickerModal((prev) => ({ ...prev, visible: false }));
                                        },
                                    })
                                }
                            >
                                <Text style={styles.selectorBtnText}>
                                    {getOptionName(familyValueList, partnerExpectation.family_value_id, "Any / Select Family Value")}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.sectionSaveBtn, savingSection === "partner" && styles.saveBtnDisabled]}
                                onPress={() => handleSaveSection("partner")}
                                disabled={savingSection === "partner"}
                                activeOpacity={0.8}
                            >
                                {savingSection === "partner" ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sectionSaveBtnText}>Save Partner Expectations</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Danger Section Navigation */}
                <View style={styles.dangerSection}>
                    <TouchableOpacity
                        style={styles.dangerNavBtn}
                        onPress={() => navigation.navigate("ChangePassword")}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="key-outline" size={18} color={COLORS.text} style={{ marginRight: 10 }} />
                        <Text style={styles.dangerNavText}>Change Password</Text>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.dangerNavBtn}
                        onPress={() => navigation.navigate("DeactivateAccount")}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="pause-circle-outline" size={18} color="#D97706" style={{ marginRight: 10 }} />
                        <Text style={[styles.dangerNavText, { color: "#D97706" }]}>Temporarily Deactivate Account</Text>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.dangerNavBtn, { borderBottomWidth: 0 }]}
                        onPress={() => navigation.navigate("DeleteAccount")}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="trash-outline" size={18} color="#DC2626" style={{ marginRight: 10 }} />
                        <Text style={[styles.dangerNavText, { color: "#DC2626" }]}>Delete Account Permanently</Text>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
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

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    saveBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 20,
        minWidth: 64,
        alignItems: "center",
        justifyContent: "center",
    },
    saveBtnDisabled: {
        opacity: 0.6,
    },
    saveBtnText: {
        color: "#fff",
        fontFamily: FONTS.semiBold,
        fontSize: 13,
    },
    userCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginVertical: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    userCardTop: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatarWrap: {
        position: "relative",
    },
    avatarImg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.border,
    },
    avatarLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.45)",
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
    },
    cameraIconWrap: {
        position: "absolute",
        bottom: 0,
        right: 0,
        backgroundColor: COLORS.primary,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#fff",
    },
    userInfoCol: {
        marginLeft: 14,
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    userEmail: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginTop: 2,
    },
    userPhone: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginTop: 1,
    },
    badgePill: {
        alignSelf: "flex-start",
        backgroundColor: COLORS.primarySoft,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 4,
    },
    badgeText: {
        fontSize: 10,
        fontFamily: FONTS.semiBold,
        color: COLORS.primary,
    },
    loadingBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFF0F5",
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 10,
    },
    loadingBannerText: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: COLORS.primary,
    },
    accordionCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: "hidden",
    },
    accordionHeader: {
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
    },
    sectionIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    sectionTitleCol: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 14,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
    },
    sectionStatus: {
        fontSize: 11,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginTop: 1,
    },
    missingPill: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FEE2E2",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#FCA5A5",
    },
    missingPillText: {
        fontSize: 10,
        fontFamily: FONTS.semiBold,
        color: "#DC2626",
    },
    completedPill: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#EBF9F5",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    completedPillText: {
        fontSize: 10,
        fontFamily: FONTS.semiBold,
        color: "#059669",
    },
    accordionBody: {
        paddingHorizontal: 14,
        paddingBottom: 16,
        paddingTop: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.border,
    },
    sectionErrorBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "#FEF2F2",
        borderWidth: 1,
        borderColor: "#FCA5A5",
        borderRadius: 10,
        padding: 12,
        marginBottom: 14,
    },
    sectionErrorTitle: {
        fontSize: 13,
        fontFamily: FONTS.bold,
        color: "#991B1B",
        marginBottom: 2,
    },
    sectionErrorText: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: "#B91C1C",
        lineHeight: 17,
    },
    missingUnderRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
        marginLeft: 2,
        marginBottom: 4,
    },
    missingUnderText: {
        fontSize: 11,
        fontFamily: FONTS.medium,
        color: "#DC2626",
    },
    missingBanner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FEF2F2",
        padding: 10,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#FECACA",
    },
    missingBannerText: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: "#DC2626",
        flex: 1,
    },
    inputLabel: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: COLORS.text,
        marginTop: 12,
        marginBottom: 6,
    },
    requiredStar: {
        color: "#DC2626",
    },
    input: {
        backgroundColor: "#FAFAFA",
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        fontFamily: FONTS.regular,
        color: COLORS.text,
    },
    inputMissing: {
        borderColor: "#DC2626",
        backgroundColor: "#FFF5F5",
    },
    missingHelperText: {
        fontSize: 10,
        fontFamily: FONTS.regular,
        color: "#DC2626",
        marginTop: 3,
        marginLeft: 2,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: "top",
    },
    selectorBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FAFAFA",
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    selectorBtnText: {
        fontSize: 14,
        fontFamily: FONTS.regular,
        color: COLORS.text,
        flex: 1,
    },
    twoColRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    toggleRow: {
        flexDirection: "row",
        gap: 8,
    },
    toggleRowWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    toggleBtn: {
        flex: 1,
        backgroundColor: "#FAFAFA",
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    toggleBtnActive: {
        backgroundColor: COLORS.primarySoft,
        borderColor: COLORS.primary,
    },
    toggleBtnText: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.text,
    },
    toggleBtnTextActive: {
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    chipBtn: {
        backgroundColor: "#FAFAFA",
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    chipBtnActive: {
        backgroundColor: COLORS.primarySoft,
        borderColor: COLORS.primary,
    },
    chipBtnText: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.text,
    },
    chipBtnTextActive: {
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    addressTabRow: {
        flexDirection: "row",
        backgroundColor: "#F3F4F6",
        borderRadius: 10,
        padding: 3,
        marginBottom: 10,
    },
    addressTabBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: "center",
        borderRadius: 8,
    },
    addressTabBtnActive: {
        backgroundColor: "#fff",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    addressTabText: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: COLORS.textLight,
    },
    addressTabTextActive: {
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    sectionSaveBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 18,
    },
    sectionSaveBtnText: {
        fontSize: 14,
        fontFamily: FONTS.semiBold,
        color: "#fff",
    },
    dangerSection: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        marginTop: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: "hidden",
    },
    dangerNavBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    dangerNavText: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.text,
        flex: 1,
    },
});
