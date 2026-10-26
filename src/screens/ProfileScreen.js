import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Image,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
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
import { subscribeMemberAction, emitMemberAction } from "../services/memberEvents";
import { COLORS, FONTS, DEFAULT_AVATAR } from "../theme";

const ON_BEHALF_MAP = {
    "1": "Self",
    "2": "Daughter",
    "3": "Son",
    "4": "Sister",
    "5": "Brother",
    "6": "Relative",
    "7": "Friend",
};

function calculateAge(dob) {
    if (!dob) return "";
    let birthDate;
    if (String(dob).includes("/")) {
        const parts = String(dob).split("/");
        if (parts.length === 3) birthDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
        birthDate = new Date(dob);
    }
    if (!birthDate || isNaN(birthDate.getTime())) return "";
    const diff = Date.now() - birthDate.getTime();
    const ageDate = new Date(diff);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);
    return age > 0 && age < 120 ? String(age) : "";
}

const ACCOUNT_ITEMS = [
    { label: "Edit / Manage Profile", icon: "📝", route: "EditProfile" },
    { label: "Gallery", icon: "🖼️", route: "Gallery" },
    { label: "Happy Story", icon: "💍", route: "HappyStory" },
    { label: "Packages", icon: "💎", route: "Packages" },
    { label: "Ignored User List", icon: "🚫", route: "IgnoredUsers" },
    { label: "Profile Viewer", icon: "👁️", route: "ProfileViewer" },
];

const SECURITY_ITEMS = [
    { label: "Change Password", icon: "🔑", route: "ChangePassword" },
];

const DANGER_ITEMS = [
    { label: "Deactivate Account", icon: "⏸️", route: "DeactivateAccount" },
    { label: "Delete Account", icon: "🗑️", route: "DeleteAccount", destructive: true },
];

function MenuRow({ item, isLast, onPress }) {
    const destructive = item.destructive;
    return (
        <TouchableOpacity
            style={[styles.item, !isLast && styles.itemBorder]}
            onPress={onPress}
            activeOpacity={0.6}
        >
            <View style={[styles.itemIconWrap, destructive && { backgroundColor: COLORS.dangerSoft }]}>
                <Text style={styles.itemIcon}>{item.icon}</Text>
            </View>
            <Text style={[styles.itemLabel, destructive && { color: COLORS.danger }]}>{item.label}</Text>
            <Text style={[styles.itemChevron, destructive && { color: COLORS.danger }]}>›</Text>
        </TouchableOpacity>
    );
}

function Section({ title, children }) {
    return (
        <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.listCard}>{children}</View>
        </View>
    );
}

export default function ProfileScreen({ navigation }) {
    const { user, token, logout, updateUser } = useAuth();
    const [profileData, setProfileData] = useState(null);
    const [galleryImages, setGalleryImages] = useState([]);
    const [happyStoryData, setHappyStoryData] = useState({ hasStory: false, story: null });
    const [emailUnverified, setEmailUnverified] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [localAvatar, setLocalAvatar] = useState(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

    // Refresh gallery and happy story whenever the screen comes into focus
    useFocusEffect(
        useCallback(() => {
            fetchGallery();
            fetchHappyStory();
        }, [fetchGallery, fetchHappyStory])
    );

    // Subscribe to cross-screen gallery, profile, and happy story updates
    useEffect(() => {
        const unsubscribe = subscribeMemberAction((event) => {
            if (event?.type === "gallery_updated") {
                fetchGallery();
            }
            if (event?.type === "happy_story_updated") {
                fetchHappyStory();
            }
            if (event?.type === "profile_updated" || event?.type === "profile_photo_updated") {
                if (event?.photo) {
                    setLocalAvatar(event.photo);
                }
                if (user?.id && token) {
                    profileService.getMyProfile(user.id, token).then((res) => {
                        if (res?.data) setProfileData(res.data);
                    }).catch(() => { });
                }
            }
        });
        return unsubscribe;
    }, [fetchGallery, fetchHappyStory, user?.id, token]);

    useEffect(() => {
        let isMounted = true;
        const userId = user?.id;
        if (!userId || !token) return;

        (async () => {
            try {
                const response = await profileService.getMyProfile(userId, token);
                if (isMounted && response && response.result !== false && response.data) {
                    setProfileData(response.data);
                    setEmailUnverified(false);
                }
            } catch (err) {
                if (/not verified/i.test(err?.message)) {
                    if (isMounted) setEmailUnverified(true);
                    console.log("Profile: Account email pending verification.");
                } else {
                    console.log("Could not fetch profile data:", err.message);
                }
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [user?.id, token]);

    const onRefresh = useCallback(async () => {
        const userId = user?.id;
        if (!token) return;

        setRefreshing(true);
        try {
            if (userId) {
                const response = await profileService.getMyProfile(userId, token);
                if (response && response.result !== false && response.data) {
                    setProfileData(response.data);
                    setEmailUnverified(false);
                }
            }
            const galList = await galleryService.getGalleryImages(token);
            if (Array.isArray(galList)) {
                setGalleryImages(galList);
            }
            const storyRes = await happyStoryService.checkHappyStory(token);
            setHappyStoryData({
                hasStory: Boolean(storyRes?.hasStory),
                story: storyRes?.story || null,
            });
        } catch (err) {
            if (/not verified/i.test(err?.message)) {
                setEmailUnverified(true);
                console.log("Profile: Account email pending verification.");
            } else {
                console.log("Could not refresh profile data:", err.message);
            }
        } finally {
            setRefreshing(false);
        }
    }, [user?.id, token]);

    const handleNavigate = (route) => {
        if (route === "ManageProfile" || route === "EditProfile") {
            return navigation.navigate("EditProfile");
        }
        if (route === "DeleteAccount") {
            return navigation.navigate("DeleteAccount");
        }
        if (route === "DeactivateAccount") {
            return navigation.navigate("DeactivateAccount");
        }
        if (route === "ChangePassword") {
            return navigation.navigate("ChangePassword");
        }
        if (route === "Gallery") {
            return navigation.navigate("Gallery");
        }
        if (route === "HappyStory") {
            return navigation.navigate("HappyStory");
        }
        if (route === "Packages") {
            return navigation.navigate("Packages");
        }
        if (route === "IgnoredUsers" || route === "IgnoredUserList") {
            return navigation.navigate("IgnoredUsers");
        }
        if (route === "MyInterest" || route === "Interests") {
            return navigation.navigate("MyInterest");
        }
        if (route === "ProfileViewer") {
            return navigation.navigate("ProfileViewer");
        }
        if (navigation?.navigate) {
            try {
                navigation.navigate(route);
            } catch {
                Alert.alert("Coming soon", `${route} screen is not available yet.`);
            }
        }
    };


    const handleLogout = () => {
        Alert.alert(
            "Sign Out",
            "Are you sure you want to sign out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out",
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
            ]
        );
    };

    const onMenuPress = (item) => {
        if (item.route === "DeleteAccount") {
            return navigation.navigate("DeleteAccount");
        }
        return handleNavigate(item.route);
    };

    // Extract dynamic fields from profileData or fallback to user
    const basicInfo = profileData?.basic_info;
    const contactDetails = profileData?.contact_details;
    const spiritual = profileData?.spiritual_background;
    const presentAddress = profileData?.present_address;
    const physical = profileData?.physical_attributes;
    const educationArr = profileData?.education;
    const careerArr = profileData?.career;

    const firstName = basicInfo?.first_name || basicInfo?.firs_name || user?.first_name || "";
    const lastName = basicInfo?.last_name || user?.last_name || "";
    const fullName = (firstName || lastName)
        ? `${firstName} ${lastName}`.trim()
        : user?.name || "Member Profile";

    const memberCode = basicInfo?.code || user?.code || user?.member_code || (user?.id ? `HM-${user.id}` : "");
    const memberDob = basicInfo?.date_of_birth || user?.date_of_birth || user?.dob || "";
    const memberAge = basicInfo?.age ? String(basicInfo.age) : (user?.age ? String(user.age) : calculateAge(memberDob));
    const memberGenderRaw = basicInfo?.gender || user?.gender || "";
    const memberGender = memberGenderRaw ? (memberGenderRaw.charAt(0).toUpperCase() + memberGenderRaw.slice(1).toLowerCase()) : "";
    const maritalStatus = basicInfo?.maritial_status || basicInfo?.marital_status || user?.marital_status || user?.maritial_status || "";
    const onBehalfKey = String(basicInfo?.on_behalf || user?.on_behalf || "");
    const onBehalfName = basicInfo?.onbehalf?.name || ON_BEHALF_MAP[onBehalfKey] || (user?.on_behalf && isNaN(user.on_behalf) ? user.on_behalf : null);
    const motherTongue = basicInfo?.mothere_tongue || basicInfo?.mother_tongue || user?.mothere_tongue || user?.mother_tongue || "";

    const userPhoto = localAvatar || basicInfo?.photo || user?.avatar_original || user?.avatar || DEFAULT_AVATAR;
    const userPhone = contactDetails?.phone || user?.phone || "";
    const userEmail = contactDetails?.email || user?.email || "";
    const planName = user?.membership ? "Premium Member" : "Free Plan";

    const promptProfilePhoto = () => {
        Alert.alert(
            "Update Profile Photo 📷",
            "Choose an option to update your main profile picture:",
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
                                quality: 0.85,
                            });
                            if (!res.canceled && res.assets && res.assets.length > 0) {
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
                    first_name: basicInfo?.firs_name || basicInfo?.first_name || user?.name?.split(" ")[0],
                    last_name: basicInfo?.last_name || user?.name?.split(" ").slice(1).join(" "),
                    email: user?.email,
                    phone: user?.phone,
                    gender: basicInfo?.gender || user?.gender || "male",
                    date_of_birth: basicInfo?.date_of_birth || "",
                    on_behalf: basicInfo?.onbehalf || "1",
                    marital_status: basicInfo?.maritial_status || "Never Married",
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
            console.log("Profile photo upload error:", err?.message);
            Alert.alert("Upload Notice", err?.message || "Profile photo updated locally.");
        } finally {
            setUploadingAvatar(false);
        }
    };

    const introductionBio = profileData?.introduction || profileData?.intoduction?.introduction || "";
    const religionName = spiritual?.religion?.name || (typeof spiritual?.religion === "string" ? spiritual.religion : "") || user?.religion || "";
    const casteName = spiritual?.caste?.name || (typeof spiritual?.caste === "string" ? spiritual.caste : "") || user?.caste || "";
    const subCasteName = spiritual?.sub_caste?.name || (typeof spiritual?.sub_caste === "string" ? spiritual.sub_caste : "") || "";

    const city = presentAddress?.city?.name || presentAddress?.city || user?.city || "";
    const state = presentAddress?.state?.name || presentAddress?.state || user?.state || "";
    const country = presentAddress?.country?.name || presentAddress?.country || user?.country || "";
    const locationStr = [city, state, country].filter(Boolean).join(", ") || user?.location || "";

    const permanentAddress = profileData?.permanent_address;
    const permCity = permanentAddress?.city?.name || permanentAddress?.city || "";
    const permState = permanentAddress?.state?.name || permanentAddress?.state || "";
    const permCountry = permanentAddress?.country?.name || permanentAddress?.country || "";
    const permLocationStr = [permCity, permState, permCountry].filter(Boolean).join(", ");

    const lifestyle = profileData?.lifestyles || profileData?.lifestyle;
    const astronomic = profileData?.astrologies || profileData?.astronomic;
    const family = profileData?.families_information || profileData?.family_info;
    const hobbies = profileData?.hobbies_interest || profileData?.hobbies;
    const attitude = profileData?.attitude_behavior;
    const residency = profileData?.residence_info;
    const partnerExpectation = profileData?.partner_expectation;
    const knownLanguages = profileData?.known_languages || "";

    const heightStr = physical?.height || user?.height || "";
    const weightStr = physical?.weight || user?.weight || "";
    const educationStr = Array.isArray(educationArr) && educationArr[0]?.degree ? educationArr[0].degree : (typeof educationArr === "string" ? educationArr : "") || user?.education || "";
    const careerStr = Array.isArray(careerArr) && careerArr[0]?.designation ? careerArr[0].designation : (typeof careerArr === "string" ? careerArr : "") || user?.profession || user?.career || "";

    // Calculate missing fields in Personal / Basic Information (RED PILL)
    const basicMissingFields = useMemo(() => {
        const missing = [];
        if (!firstName) missing.push({ key: "first_name", label: "First Name" });
        if (!memberGender) missing.push({ key: "gender", label: "Gender" });
        if (!memberDob) missing.push({ key: "date_of_birth", label: "Date of Birth" });
        if (!maritalStatus) missing.push({ key: "marital_status", label: "Marital Status" });
        if (!onBehalfName) missing.push({ key: "on_behalf", label: "Profile Created For" });
        if (!userPhone && !userEmail) missing.push({ key: "contact", label: "Phone or Email" });
        return missing;
    }, [firstName, memberGender, memberDob, maritalStatus, onBehalfName, userPhone, userEmail]);

    const planMaxGallery = user?.membership ? 5 : 2;

    const handleGalleryAddPress = () => {
        if (galleryImages.length >= planMaxGallery) {
            Alert.alert(
                "Upload Limit Reached",
                `Your ${planName} allows a maximum of ${planMaxGallery} gallery photos. You currently have ${galleryImages.length} photos uploaded. Please upgrade your package or manage existing photos.`,
                [
                    { text: "Manage Photos", onPress: () => navigation.navigate("Gallery") },
                    { text: "Upgrade Plan 💎", onPress: () => navigation.navigate("Packages") },
                ]
            );
            return;
        }
        navigation.navigate("Gallery");
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            {/* ---------- STICKY HEADER ---------- */}
            <ScreenHeader
                title="My Profile"
                subtitle="Your account & matrimonial profile"
                badge={planName}
                badgeColor={user?.membership ? "#7C3AED" : COLORS.primary}
                badgeBgColor={user?.membership ? "#F3E8FF" : "#FFF0F5"}
                rightElement={
                    <TouchableOpacity
                        style={styles.headerEditBtn}
                        onPress={() => navigation.navigate("EditProfile")}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="create-outline" size={15} color={COLORS.primary} style={{ marginRight: 4 }} />
                        <Text style={styles.headerEditText}>Edit</Text>
                    </TouchableOpacity>
                }
            />

            {/* ---------- SCROLLABLE CONTENT ---------- */}
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
                {/* Email Verification Notice */}
                {emailUnverified && (
                    <View style={styles.verificationBanner}>
                        <View style={styles.verificationIconWrap}>
                            <Text style={styles.verificationIcon}>✉️</Text>
                        </View>
                        <View style={styles.verificationTextWrap}>
                            <Text style={styles.verificationTitle}>Email Verification Pending</Text>
                            <Text style={styles.verificationSubtitle}>
                                Please verify your email on hindumatrimony.org.in to unlock your full profile details and gallery.
                            </Text>
                        </View>
                    </View>
                )}

                <View style={styles.profileCard}>
                    <View style={styles.avatarWrap}>
                        <Image
                            source={{ uri: userPhoto }}
                            style={styles.avatarImage}
                            resizeMode="cover"
                        />
                        {uploadingAvatar ? (
                            <View style={styles.avatarLoadingOverlay}>
                                <ActivityIndicator size="small" color="#fff" />
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.avatarEditBtn}
                                onPress={promptProfilePhoto}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="camera" size={14} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.name}>{fullName}</Text>

                    {memberCode ? (
                        <View style={styles.codeBadge}>
                            <Text style={styles.codeText}>ID: {memberCode}</Text>
                        </View>
                    ) : null}

                    {memberAge || memberGender ? (
                        <Text style={styles.meta}>
                            {[memberAge ? `${memberAge} yrs` : null, memberGender]
                                .filter(Boolean)
                                .join(" • ")}
                        </Text>
                    ) : (
                        <Text style={styles.meta}>{userEmail || userPhone || "Welcome"}</Text>
                    )}

                    <View style={styles.badgeRow}>
                        <View style={styles.planBadge}>
                            <Text style={styles.planBadgeText}>{planName}</Text>
                        </View>
                        {onBehalfName ? (
                            <View style={styles.onBehalfBadge}>
                                <Text style={styles.onBehalfBadgeText}>
                                    For {onBehalfName}
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    <TouchableOpacity
                        style={styles.editProfileBtn}
                        onPress={() => navigation.navigate("EditProfile")}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.editProfileBtnText}>Edit Profile</Text>
                    </TouchableOpacity>
                </View>

                {/* Photo Gallery Section */}
                <View style={styles.galleryCard}>
                    <View style={styles.galleryCardHeader}>
                        <View style={styles.galleryHeaderLeft}>
                            <Ionicons name="images-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
                            <Text style={styles.galleryCardTitle}>Photo Gallery</Text>
                            {galleryImages.length > 0 && (
                                <View style={[styles.galleryCountBadge, galleryImages.length >= planMaxGallery && { backgroundColor: "#FEE2E2" }]}>
                                    <Text style={[styles.galleryCountBadgeText, galleryImages.length >= planMaxGallery && { color: "#DC2626" }]}>
                                        {galleryImages.length}/{planMaxGallery}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={() => navigation.navigate("Gallery")}
                            activeOpacity={0.7}
                            style={styles.galleryManageBtn}
                        >
                            <Text style={styles.galleryManageText}>Manage</Text>
                            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>

                    {galleryImages.length > 0 ? (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.galleryScrollContent}
                        >
                            {galleryImages.map((img, idx) => (
                                <TouchableOpacity
                                    key={String(img?.id ?? img?.image_path ?? `gallery_${idx}`)}
                                    style={styles.galleryThumbTouch}
                                    onPress={() => navigation.navigate("Gallery")}
                                    activeOpacity={0.85}
                                >
                                    <Image
                                        source={{ uri: img.image_path }}
                                        style={styles.galleryThumbImg}
                                        resizeMode="cover"
                                    />
                                </TouchableOpacity>
                            ))}

                            <TouchableOpacity
                                style={styles.galleryAddMoreCard}
                                onPress={handleGalleryAddPress}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={galleryImages.length >= planMaxGallery ? "diamond" : "add-circle-outline"}
                                    size={22}
                                    color={COLORS.primary}
                                />
                                <Text style={styles.galleryAddMoreText}>
                                    {galleryImages.length >= planMaxGallery ? "Upgrade" : "Add More"}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    ) : (
                        <TouchableOpacity
                            style={styles.galleryEmptyBox}
                            onPress={handleGalleryAddPress}
                            activeOpacity={0.75}
                        >
                            <View style={styles.galleryEmptyIconCircle}>
                                <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
                            </View>
                            <View style={styles.galleryEmptyTextWrap}>
                                <Text style={styles.galleryEmptyTitle}>No gallery photos yet</Text>
                                <Text style={styles.galleryEmptySubtitle}>
                                    Add photos to get up to 5x more profile responses
                                </Text>
                            </View>
                            <View style={styles.galleryEmptyAddBtn}>
                                <Text style={styles.galleryEmptyAddBtnText}>+ Add</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Happy Story Section */}
                <View style={styles.happyStoryCard}>
                    <View style={styles.happyStoryHeader}>
                        <View style={styles.happyStoryHeaderLeft}>
                            <Text style={styles.happyStoryHeaderEmoji}>💍</Text>
                            <Text style={styles.happyStoryTitle}>Happy Story</Text>
                            {happyStoryData.hasStory && (
                                <View style={styles.happyStoryBadge}>
                                    <Text style={styles.happyStoryBadgeText}>Published</Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={() => navigation.navigate("HappyStory")}
                            activeOpacity={0.7}
                            style={styles.happyStoryActionBtn}
                        >
                            <Text style={styles.happyStoryActionText}>
                                {happyStoryData.hasStory ? "View Story" : "+ Add Story"}
                            </Text>
                            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>

                    {happyStoryData.hasStory && happyStoryData.story ? (
                        <TouchableOpacity
                            style={styles.storyPreviewRow}
                            onPress={() => navigation.navigate("HappyStory")}
                            activeOpacity={0.85}
                        >
                            {happyStoryData.story.photos ? (
                                <Image
                                    source={{ uri: happyStoryData.story.photos }}
                                    style={styles.storyPreviewPhoto}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={styles.storyPreviewPhotoFallback}>
                                    <Text style={{ fontSize: 24 }}>💍</Text>
                                </View>
                            )}
                            <View style={styles.storyPreviewTextWrap}>
                                <Text style={styles.storyPreviewTitle} numberOfLines={1}>
                                    {happyStoryData.story.title || "Our Happy Journey"}
                                </Text>
                                <View style={styles.storyPartnerPill}>
                                    <Ionicons name="heart" size={11} color={COLORS.primary} />
                                    <Text style={styles.storyPartnerText} numberOfLines={1}>
                                        With {happyStoryData.story.partner_name || "Partner"}
                                    </Text>
                                </View>
                                {happyStoryData.story.details ? (
                                    <Text style={styles.storyPreviewSnippet} numberOfLines={2}>
                                        {happyStoryData.story.details}
                                    </Text>
                                ) : null}
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.happyStoryEmptyBox}
                            onPress={() => navigation.navigate("HappyStory")}
                            activeOpacity={0.75}
                        >
                            <View style={styles.happyStoryEmptyIconWrap}>
                                <Text style={{ fontSize: 22 }}>💖</Text>
                            </View>
                            <View style={styles.happyStoryEmptyTextWrap}>
                                <Text style={styles.happyStoryEmptyTitle}>Share Your Happy Story</Text>
                                <Text style={styles.happyStoryEmptySubtitle}>
                                    Found your partner on HinduMatrimony? Share your journey so everyone can see!
                                </Text>
                            </View>
                            <View style={styles.happyStoryEmptyBtn}>
                                <Text style={styles.happyStoryEmptyBtnText}>Share</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ======================================================= */}
                {/* 1. About Me (Introduction)                              */}
                {/* ======================================================= */}
                <View style={styles.overviewCard}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionHeaderLeft}>
                            <Text style={styles.sectionHeaderIcon}>📝</Text>
                            <Text style={styles.overviewTitle}>About Me</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => navigation.navigate("EditProfile", { section: "introduction" })}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.sectionEditAction}>Edit</Text>
                        </TouchableOpacity>
                    </View>

                    {introductionBio ? (
                        <Text style={styles.bioText}>{introductionBio}</Text>
                    ) : (
                        <TouchableOpacity
                            onPress={() => navigation.navigate("EditProfile", { section: "introduction" })}
                            style={styles.addSectionPrompt}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="add-circle-outline" size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
                            <Text style={styles.addSectionPromptText}>Add an introduction bio to get up to 3x more responses</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ======================================================= */}
                {/* 2. Personal Information (WITH RED MISSING INFO PILL)    */}
                {/* ======================================================= */}
                <View style={styles.overviewCard}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionHeaderLeft}>
                            <Text style={styles.sectionHeaderIcon}>👤</Text>
                            <Text style={styles.overviewTitle}>Personal Information</Text>

                            {/* RED PILL / COMPLETE BADGE */}
                            {basicMissingFields.length > 0 ? (
                                <View style={styles.missingBadgePill}>
                                    <Ionicons name="alert-circle" size={11} color="#DC2626" style={{ marginRight: 3 }} />
                                    <Text style={styles.missingBadgeText}>{basicMissingFields.length} info missing</Text>
                                </View>
                            ) : (
                                <View style={styles.completeBadgePill}>
                                    <Ionicons name="checkmark-circle" size={11} color="#059669" style={{ marginRight: 3 }} />
                                    <Text style={styles.completeBadgeText}>Complete</Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={() => navigation.navigate("EditProfile", { section: "basic" })}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.sectionEditAction}>Edit</Text>
                        </TouchableOpacity>
                    </View>

                    {firstName || lastName ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Full Name</Text>
                            <Text style={styles.overviewValue}>{fullName}</Text>
                        </View>
                    ) : null}

                    {memberGender ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Gender</Text>
                            <Text style={styles.overviewValue}>{memberGender}</Text>
                        </View>
                    ) : null}

                    {memberDob ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Date of Birth</Text>
                            <Text style={styles.overviewValue}>{memberDob}{memberAge ? ` (${memberAge} yrs)` : ""}</Text>
                        </View>
                    ) : memberAge ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Age</Text>
                            <Text style={styles.overviewValue}>{memberAge} yrs</Text>
                        </View>
                    ) : null}

                    {maritalStatus ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Marital Status</Text>
                            <Text style={styles.overviewValue}>{maritalStatus}</Text>
                        </View>
                    ) : null}

                    {onBehalfName ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Profile Created For</Text>
                            <Text style={styles.overviewValue}>{onBehalfName}</Text>
                        </View>
                    ) : null}

                    {motherTongue ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Mother Tongue</Text>
                            <Text style={styles.overviewValue}>{motherTongue}</Text>
                        </View>
                    ) : null}

                    {/* Prominent Missing Fields List */}
                    {basicMissingFields.length > 0 && (
                        <View style={styles.missingItemsContainer}>
                            <Text style={styles.missingSectionHeader}>Missing details to complete:</Text>
                            {basicMissingFields.map((f) => (
                                <View key={f.key} style={styles.missingItemRow}>
                                    <View style={styles.missingItemTextCol}>
                                        <Text style={styles.missingItemLabel}>{f.label}</Text>
                                        <Text style={styles.missingItemNotice}>Not specified</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.missingAddBtn}
                                        onPress={() => navigation.navigate("EditProfile", { section: "basic" })}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.missingAddBtnText}>+ Add</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* ======================================================= */}
                {/* 3. Religion & Community                                 */}
                {/* ======================================================= */}
                <View style={styles.overviewCard}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionHeaderLeft}>
                            <Text style={styles.sectionHeaderIcon}>🪔</Text>
                            <Text style={styles.overviewTitle}>Religion & Community</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => navigation.navigate("EditProfile", { section: "spiritual" })}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.sectionEditAction}>Edit</Text>
                        </TouchableOpacity>
                    </View>

                    {religionName ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Religion</Text>
                            <Text style={styles.overviewValue}>{religionName}</Text>
                        </View>
                    ) : null}

                    {casteName ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Caste</Text>
                            <Text style={styles.overviewValue}>
                                {casteName}{subCasteName ? ` • ${subCasteName}` : ""}
                            </Text>
                        </View>
                    ) : null}

                    {spiritual?.ethnicity ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Ethnicity</Text>
                            <Text style={styles.overviewValue}>{spiritual.ethnicity}</Text>
                        </View>
                    ) : null}

                    {spiritual?.personal_value ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Personal Value</Text>
                            <Text style={styles.overviewValue}>{spiritual.personal_value}</Text>
                        </View>
                    ) : null}

                    {!religionName && !casteName && (
                        <TouchableOpacity
                            onPress={() => navigation.navigate("EditProfile", { section: "spiritual" })}
                            style={styles.addSectionPrompt}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="add-circle-outline" size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
                            <Text style={styles.addSectionPromptText}>Add religion and caste details</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ======================================================= */}
                {/* 4. Contact & Address Details                            */}
                {/* ======================================================= */}
                <View style={styles.overviewCard}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionHeaderLeft}>
                            <Text style={styles.sectionHeaderIcon}>📍</Text>
                            <Text style={styles.overviewTitle}>Contact & Location</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => navigation.navigate("EditProfile", { section: "address" })}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.sectionEditAction}>Edit</Text>
                        </TouchableOpacity>
                    </View>

                    {userPhone ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Phone</Text>
                            <Text style={styles.overviewValue}>{userPhone}</Text>
                        </View>
                    ) : null}

                    {userEmail ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Email</Text>
                            <Text style={styles.overviewValue}>{userEmail}</Text>
                        </View>
                    ) : null}

                    {locationStr ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Present Location</Text>
                            <Text style={styles.overviewValue}>{locationStr}</Text>
                        </View>
                    ) : null}

                    {permLocationStr ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Permanent Location</Text>
                            <Text style={styles.overviewValue}>{permLocationStr}</Text>
                        </View>
                    ) : null}
                </View>

                {/* ======================================================= */}
                {/* 5. Physical Attributes                                 */}
                {/* ======================================================= */}
                <View style={styles.overviewCard}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionHeaderLeft}>
                            <Text style={styles.sectionHeaderIcon}>🏃</Text>
                            <Text style={styles.overviewTitle}>Physical Attributes</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => navigation.navigate("EditProfile", { section: "physical" })}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.sectionEditAction}>Edit</Text>
                        </TouchableOpacity>
                    </View>

                    {heightStr ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Height</Text>
                            <Text style={styles.overviewValue}>{heightStr} ft</Text>
                        </View>
                    ) : null}

                    {weightStr ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Weight</Text>
                            <Text style={styles.overviewValue}>{weightStr} kg</Text>
                        </View>
                    ) : null}

                    {physical?.blood_group ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Blood Group</Text>
                            <Text style={styles.overviewValue}>{physical.blood_group}</Text>
                        </View>
                    ) : null}

                    {physical?.complexion ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Complexion</Text>
                            <Text style={styles.overviewValue}>{physical.complexion}</Text>
                        </View>
                    ) : null}

                    {physical?.body_type ? (
                        <View style={styles.overviewRow}>
                            <Text style={styles.overviewLabel}>Body Type</Text>
                            <Text style={styles.overviewValue}>{physical.body_type}</Text>
                        </View>
                    ) : null}

                    {!heightStr && !weightStr && !physical?.blood_group && (
                        <TouchableOpacity
                            onPress={() => navigation.navigate("EditProfile", { section: "physical" })}
                            style={styles.addSectionPrompt}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="add-circle-outline" size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
                            <Text style={styles.addSectionPromptText}>Add height, weight, and physical attributes</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ======================================================= */}
                {/* 6. Education & Profession                               */}
                {/* ======================================================= */}
                {(educationStr || careerStr) ? (
                    <View style={styles.overviewCard}>
                        <View style={styles.sectionHeaderRow}>
                            <View style={styles.sectionHeaderLeft}>
                                <Text style={styles.sectionHeaderIcon}>💼</Text>
                                <Text style={styles.overviewTitle}>Education & Profession</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => navigation.navigate("EditProfile", { section: "partner" })}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.sectionEditAction}>Edit</Text>
                            </TouchableOpacity>
                        </View>

                        {educationStr ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Education</Text>
                                <Text style={styles.overviewValue}>{educationStr}</Text>
                            </View>
                        ) : null}

                        {careerStr ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Profession</Text>
                                <Text style={styles.overviewValue}>{careerStr}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {/* ======================================================= */}
                {/* 7. Language Details                                     */}
                {/* ======================================================= */}
                {(motherTongue || knownLanguages) ? (
                    <View style={styles.overviewCard}>
                        <View style={styles.sectionHeaderRow}>
                            <View style={styles.sectionHeaderLeft}>
                                <Text style={styles.sectionHeaderIcon}>🗣️</Text>
                                <Text style={styles.overviewTitle}>Language Details</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => navigation.navigate("EditProfile", { section: "language" })}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.sectionEditAction}>Edit</Text>
                            </TouchableOpacity>
                        </View>

                        {motherTongue ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Mother Tongue</Text>
                                <Text style={styles.overviewValue}>{motherTongue}</Text>
                            </View>
                        ) : null}

                        {knownLanguages ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Known Languages</Text>
                                <Text style={styles.overviewValue}>{knownLanguages}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {/* ======================================================= */}
                {/* 6. Lifestyle & Habits                                  */}
                {/* ======================================================= */}
                {lifestyle ? (
                    <View style={styles.overviewCard}>
                        <View style={styles.sectionHeaderRow}>
                            <View style={styles.sectionHeaderLeft}>
                                <Text style={styles.sectionHeaderIcon}>🥗</Text>
                                <Text style={styles.overviewTitle}>Lifestyle & Habits</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => navigation.navigate("EditProfile", { section: "lifestyle" })}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.sectionEditAction}>Edit</Text>
                            </TouchableOpacity>
                        </View>

                        {lifestyle.diet ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Diet</Text>
                                <Text style={styles.overviewValue}>{lifestyle.diet}</Text>
                            </View>
                        ) : null}

                        {lifestyle.drink ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Drink</Text>
                                <Text style={styles.overviewValue}>{lifestyle.drink}</Text>
                            </View>
                        ) : null}

                        {lifestyle.smoke ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Smoke</Text>
                                <Text style={styles.overviewValue}>{lifestyle.smoke}</Text>
                            </View>
                        ) : null}

                        {lifestyle.living_with ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Living With</Text>
                                <Text style={styles.overviewValue}>{lifestyle.living_with}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {/* ======================================================= */}
                {/* 7. Astronomic / Horoscope                              */}
                {/* ======================================================= */}
                {astronomic ? (
                    <View style={styles.overviewCard}>
                        <View style={styles.sectionHeaderRow}>
                            <View style={styles.sectionHeaderLeft}>
                                <Text style={styles.sectionHeaderIcon}>✨</Text>
                                <Text style={styles.overviewTitle}>Horoscope & Astrology</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => navigation.navigate("EditProfile", { section: "astronomic" })}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.sectionEditAction}>Edit</Text>
                            </TouchableOpacity>
                        </View>

                        {astronomic.sun_sign ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Sun Sign (Rashi)</Text>
                                <Text style={styles.overviewValue}>{astronomic.sun_sign}</Text>
                            </View>
                        ) : null}

                        {astronomic.moon_sign ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Moon Sign</Text>
                                <Text style={styles.overviewValue}>{astronomic.moon_sign}</Text>
                            </View>
                        ) : null}

                        {astronomic.time_of_birth ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Time of Birth</Text>
                                <Text style={styles.overviewValue}>{astronomic.time_of_birth}</Text>
                            </View>
                        ) : null}

                        {astronomic.city_of_birth ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Birth City</Text>
                                <Text style={styles.overviewValue}>{astronomic.city_of_birth}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {/* ======================================================= */}
                {/* 8. Family Details                                      */}
                {/* ======================================================= */}
                {family ? (
                    <View style={styles.overviewCard}>
                        <View style={styles.sectionHeaderRow}>
                            <View style={styles.sectionHeaderLeft}>
                                <Text style={styles.sectionHeaderIcon}>👨‍👩‍👦</Text>
                                <Text style={styles.overviewTitle}>Family Details</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => navigation.navigate("EditProfile", { section: "family" })}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.sectionEditAction}>Edit</Text>
                            </TouchableOpacity>
                        </View>

                        {family.father ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Father</Text>
                                <Text style={styles.overviewValue}>{family.father}</Text>
                            </View>
                        ) : null}

                        {family.mother ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Mother</Text>
                                <Text style={styles.overviewValue}>{family.mother}</Text>
                            </View>
                        ) : null}

                        {family.sibling ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Siblings</Text>
                                <Text style={styles.overviewValue}>{family.sibling}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {/* ======================================================= */}
                {/* 11. Hobbies & Interests                                 */}
                {/* ======================================================= */}
                {hobbies && (hobbies.hobbies || hobbies.interests || hobbies.music || hobbies.sports) ? (
                    <View style={styles.overviewCard}>
                        <View style={styles.sectionHeaderRow}>
                            <View style={styles.sectionHeaderLeft}>
                                <Text style={styles.sectionHeaderIcon}>🎨</Text>
                                <Text style={styles.overviewTitle}>Hobbies & Interests</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => navigation.navigate("EditProfile", { section: "hobbies" })}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.sectionEditAction}>Edit</Text>
                            </TouchableOpacity>
                        </View>

                        {hobbies.hobbies ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Hobbies</Text>
                                <Text style={styles.overviewValue}>{hobbies.hobbies}</Text>
                            </View>
                        ) : null}

                        {hobbies.interests ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Interests</Text>
                                <Text style={styles.overviewValue}>{hobbies.interests}</Text>
                            </View>
                        ) : null}

                        {hobbies.music ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Favorite Music</Text>
                                <Text style={styles.overviewValue}>{hobbies.music}</Text>
                            </View>
                        ) : null}

                        {hobbies.sports ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Sports & Fitness</Text>
                                <Text style={styles.overviewValue}>{hobbies.sports}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {/* ======================================================= */}
                {/* 12. Attitude & Behavior                                 */}
                {/* ======================================================= */}
                {attitude && (attitude.affection || attitude.humor || attitude.political_views || attitude.religious_service) ? (
                    <View style={styles.overviewCard}>
                        <View style={styles.sectionHeaderRow}>
                            <View style={styles.sectionHeaderLeft}>
                                <Text style={styles.sectionHeaderIcon}>🌟</Text>
                                <Text style={styles.overviewTitle}>Attitude & Values</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => navigation.navigate("EditProfile", { section: "attitude" })}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.sectionEditAction}>Edit</Text>
                            </TouchableOpacity>
                        </View>

                        {attitude.affection ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Affection</Text>
                                <Text style={styles.overviewValue}>{attitude.affection}</Text>
                            </View>
                        ) : null}

                        {attitude.humor ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Humor</Text>
                                <Text style={styles.overviewValue}>{attitude.humor}</Text>
                            </View>
                        ) : null}

                        {attitude.political_views ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Political Views</Text>
                                <Text style={styles.overviewValue}>{attitude.political_views}</Text>
                            </View>
                        ) : null}

                        {attitude.religious_service ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Religious Service</Text>
                                <Text style={styles.overviewValue}>{attitude.religious_service}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {/* ======================================================= */}
                {/* 13. Residency Information                               */}
                {/* ======================================================= */}
                {residency && (residency.immigration_status || residency.birth_country_id || residency.recidency_country_id) ? (
                    <View style={styles.overviewCard}>
                        <View style={styles.sectionHeaderRow}>
                            <View style={styles.sectionHeaderLeft}>
                                <Text style={styles.sectionHeaderIcon}>🌐</Text>
                                <Text style={styles.overviewTitle}>Residency Information</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => navigation.navigate("EditProfile", { section: "residency" })}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.sectionEditAction}>Edit</Text>
                            </TouchableOpacity>
                        </View>

                        {residency.immigration_status ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Immigration Status</Text>
                                <Text style={styles.overviewValue}>{residency.immigration_status}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {/* ======================================================= */}
                {/* 9. Partner Expectations                                */}
                {/* ======================================================= */}
                {partnerExpectation ? (
                    <View style={styles.overviewCard}>
                        <View style={styles.sectionHeaderRow}>
                            <View style={styles.sectionHeaderLeft}>
                                <Text style={styles.sectionHeaderIcon}>💖</Text>
                                <Text style={styles.overviewTitle}>Partner Expectations</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => navigation.navigate("EditProfile", { section: "partner" })}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.sectionEditAction}>Edit</Text>
                            </TouchableOpacity>
                        </View>

                        {partnerExpectation.general ? (
                            <Text style={[styles.bioText, { marginBottom: 10 }]}>{partnerExpectation.general}</Text>
                        ) : null}

                        {partnerExpectation.partner_height ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Preferred Height</Text>
                                <Text style={styles.overviewValue}>{partnerExpectation.partner_height} ft</Text>
                            </View>
                        ) : null}

                        {partnerExpectation.partner_diet ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Diet</Text>
                                <Text style={styles.overviewValue}>{partnerExpectation.partner_diet}</Text>
                            </View>
                        ) : null}

                        {partnerExpectation.partner_profession ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Profession</Text>
                                <Text style={styles.overviewValue}>{partnerExpectation.partner_profession}</Text>
                            </View>
                        ) : null}

                        {partnerExpectation.pertner_education ? (
                            <View style={styles.overviewRow}>
                                <Text style={styles.overviewLabel}>Education</Text>
                                <Text style={styles.overviewValue}>{partnerExpectation.pertner_education}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                <Section title="Account">
                    {ACCOUNT_ITEMS.map((item, i) => (
                        <MenuRow
                            key={item.label}
                            item={item}
                            isLast={i === ACCOUNT_ITEMS.length - 1}
                            onPress={() => onMenuPress(item)}
                        />
                    ))}
                </Section>

                <Section title="Security">
                    {SECURITY_ITEMS.map((item, i) => (
                        <MenuRow
                            key={item.label}
                            item={item}
                            isLast={i === SECURITY_ITEMS.length - 1}
                            onPress={() => onMenuPress(item)}
                        />
                    ))}
                </Section>

                <Section title="Danger Zone">
                    {DANGER_ITEMS.map((item, i) => (
                        <MenuRow
                            key={item.label}
                            item={item}
                            isLast={i === DANGER_ITEMS.length - 1}
                            onPress={() => onMenuPress(item)}
                        />
                    ))}
                </Section>

                <TouchableOpacity
                    style={[styles.logoutBtn, loggingOut && { opacity: 0.7 }]}
                    onPress={handleLogout}
                    disabled={loggingOut}
                    activeOpacity={0.85}
                >
                    {loggingOut ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.logoutText}>Sign Out</Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.versionText}>App version 1.0.0</Text>
            </KeyboardAwareScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },

    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerTitle: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text },

    scroll: { padding: 20, paddingBottom: 40 },

    profileCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: "center",
        paddingVertical: 24,
        paddingHorizontal: 16,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    avatarWrap: { position: "relative", marginBottom: 12 },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: COLORS.primarySoft,
    },
    avatarImage: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 3,
        borderColor: COLORS.primarySoft,
        backgroundColor: "#F3F4F6",
    },
    avatarText: { color: "#fff", fontSize: 38, fontFamily: FONTS.bold },
    avatarEditBtn: {
        position: "absolute",
        bottom: 0,
        right: 0,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: COLORS.primary,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    avatarLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.45)",
        borderRadius: 48,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarEditIcon: { fontSize: 14 },
    name: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text },
    codeBadge: {
        backgroundColor: "#F0EEEC",
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
        marginTop: 4,
    },
    codeText: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: COLORS.textLight,
    },
    meta: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textLight, marginTop: 4 },
    badgeRow: { flexDirection: "row", marginTop: 10, gap: 8 },
    planBadge: {
        backgroundColor: COLORS.primarySoft,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    planBadgeText: { fontSize: 11, fontFamily: FONTS.semiBold, color: COLORS.primary },
    onBehalfBadge: {
        backgroundColor: "#E8F4FD",
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    onBehalfBadgeText: { fontSize: 11, fontFamily: FONTS.semiBold, color: "#1976D2" },
    editProfileBtn: {
        marginTop: 16,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        borderRadius: 10,
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    editProfileBtnText: { color: COLORS.primary, fontFamily: FONTS.semiBold, fontSize: 13 },

    galleryCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    galleryCardHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    galleryHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    galleryCardTitle: {
        fontSize: 14,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
    },
    galleryCountBadge: {
        backgroundColor: COLORS.primarySoft,
        borderRadius: 10,
        paddingHorizontal: 7,
        paddingVertical: 1,
        marginLeft: 6,
    },
    galleryCountBadgeText: {
        fontSize: 11,
        fontFamily: FONTS.bold,
        color: COLORS.primary,
    },
    galleryManageBtn: {
        flexDirection: "row",
        alignItems: "center",
    },
    galleryManageText: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: COLORS.primary,
        marginRight: 2,
    },
    galleryScrollContent: {
        paddingVertical: 4,
        flexDirection: "row",
        alignItems: "center",
    },
    galleryThumbTouch: {
        width: 82,
        height: 105,
        borderRadius: 10,
        overflow: "hidden",
        marginRight: 10,
        backgroundColor: "#F3F4F6",
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    galleryThumbImg: {
        width: "100%",
        height: "100%",
    },
    galleryAddMoreCard: {
        width: 82,
        height: 105,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: COLORS.primarySoft,
        borderStyle: "dashed",
        backgroundColor: COLORS.surface,
        alignItems: "center",
        justifyContent: "center",
        padding: 6,
    },
    galleryAddMoreText: {
        fontSize: 11,
        fontFamily: FONTS.medium,
        color: COLORS.primary,
        marginTop: 4,
        textAlign: "center",
    },
    galleryEmptyBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.primarySoft || "#FDF2F8",
        borderRadius: 12,
        padding: 12,
    },
    galleryEmptyIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    galleryEmptyTextWrap: {
        flex: 1,
    },
    galleryEmptyTitle: {
        fontSize: 13,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
    },
    galleryEmptySubtitle: {
        fontSize: 11,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginTop: 2,
    },
    galleryEmptyAddBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginLeft: 8,
    },
    galleryEmptyAddBtnText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontFamily: FONTS.semiBold,
    },

    happyStoryCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    happyStoryHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    happyStoryHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    happyStoryHeaderEmoji: {
        fontSize: 16,
        marginRight: 6,
    },
    happyStoryTitle: {
        fontSize: 14,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
    },
    happyStoryBadge: {
        backgroundColor: "#DCFCE7",
        borderRadius: 10,
        paddingHorizontal: 7,
        paddingVertical: 1,
        marginLeft: 6,
    },
    happyStoryBadgeText: {
        fontSize: 10,
        fontFamily: FONTS.bold,
        color: "#15803D",
    },
    happyStoryActionBtn: {
        flexDirection: "row",
        alignItems: "center",
    },
    happyStoryActionText: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: COLORS.primary,
        marginRight: 2,
    },
    storyPreviewRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF8FA",
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: "#FCE7F3",
    },
    storyPreviewPhoto: {
        width: 70,
        height: 70,
        borderRadius: 10,
        backgroundColor: "#F3F4F6",
    },
    storyPreviewPhotoFallback: {
        width: 70,
        height: 70,
        borderRadius: 10,
        backgroundColor: "#FCE7F3",
        alignItems: "center",
        justifyContent: "center",
    },
    storyPreviewTextWrap: {
        flex: 1,
        marginLeft: 12,
    },
    storyPreviewTitle: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    storyPartnerPill: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 3,
    },
    storyPartnerText: {
        fontSize: 12,
        fontFamily: FONTS.semiBold,
        color: COLORS.primary,
        marginLeft: 4,
    },
    storyPreviewSnippet: {
        fontSize: 11,
        fontFamily: FONTS.regular,
        color: COLORS.textLight || "#6B7280",
        marginTop: 4,
        lineHeight: 15,
    },
    happyStoryEmptyBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF1F5",
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: "#FCE7F3",
    },
    happyStoryEmptyIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    happyStoryEmptyTextWrap: {
        flex: 1,
    },
    happyStoryEmptyTitle: {
        fontSize: 13,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
    },
    happyStoryEmptySubtitle: {
        fontSize: 11,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
        marginTop: 2,
        lineHeight: 15,
    },
    happyStoryEmptyBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginLeft: 8,
    },
    happyStoryEmptyBtnText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontFamily: FONTS.semiBold,
    },

    headerEditBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF0F5",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#FCE7F3",
    },
    headerEditText: {
        fontSize: 12,
        fontFamily: FONTS.semiBold,
        color: COLORS.primary,
    },
    overviewCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    sectionHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#F3EDE8",
    },
    sectionHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    sectionHeaderIcon: {
        fontSize: 15,
        marginRight: 6,
    },
    overviewTitle: {
        fontSize: 14,
        fontFamily: FONTS.semiBold,
        color: COLORS.text,
        letterSpacing: -0.2,
    },
    missingBadgePill: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FEE2E2",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginLeft: 8,
        borderWidth: 1,
        borderColor: "#FCA5A5",
    },
    missingBadgeText: {
        fontSize: 10,
        fontFamily: FONTS.semiBold,
        color: "#DC2626",
    },
    completeBadgePill: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#EBF9F5",
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 12,
        marginLeft: 8,
    },
    completeBadgeText: {
        fontSize: 10,
        fontFamily: FONTS.semiBold,
        color: "#059669",
    },
    bioText: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.text,
        lineHeight: 20,
    },
    addSectionPrompt: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
    },
    addSectionPromptText: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: COLORS.primary,
    },
    missingItemsContainer: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: "#FEE2E2",
    },
    missingSectionHeader: {
        fontSize: 11,
        fontFamily: FONTS.semiBold,
        color: "#991B1B",
        marginBottom: 6,
    },
    missingItemRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: "#FEF2F2",
        borderRadius: 8,
        marginVertical: 3,
    },
    missingItemTextCol: {
        flex: 1,
    },
    missingItemLabel: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: "#991B1B",
    },
    missingItemNotice: {
        fontSize: 10,
        fontFamily: FONTS.regular,
        color: "#EF4444",
        marginTop: 1,
    },
    missingAddBtn: {
        backgroundColor: "#DC2626",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        marginLeft: 8,
    },
    missingAddBtnText: {
        fontSize: 11,
        fontFamily: FONTS.semiBold,
        color: "#fff",
    },
    sectionEditAction: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: COLORS.primary,
    },
    overviewRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6,
    },
    overviewLabel: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.textLight,
    },
    overviewValue: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.text,
    },

    sectionWrap: { marginBottom: 20 },
    sectionTitle: {
        fontSize: 13,
        fontFamily: FONTS.semiBold,
        color: COLORS.textLight,
        marginBottom: 8,
        marginLeft: 4,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    listCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: "hidden",
    },
    item: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14 },
    itemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
    itemIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: COLORS.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    itemIcon: { fontSize: 16 },
    itemLabel: { flex: 1, fontSize: 14, fontFamily: FONTS.medium, color: COLORS.text },
    itemChevron: { fontSize: 20, color: COLORS.textLight },

    logoutBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 4,
        minHeight: 52,
    },
    logoutText: { color: "#fff", fontFamily: FONTS.semiBold, fontSize: 15 },
    versionText: {
        textAlign: "center",
        color: COLORS.textLight,
        fontFamily: FONTS.regular,
        fontSize: 11,
        marginTop: 16,
    },
    verificationBanner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF9E6",
        borderWidth: 1,
        borderColor: "#FFE082",
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
    },
    verificationIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#FFF0B3",
        alignItems: "center",
        justifyContent: "center",
    },
    verificationIcon: { fontSize: 18 },
    verificationTextWrap: { flex: 1, marginLeft: 12 },
    verificationTitle: {
        fontSize: 14,
        fontFamily: FONTS.semiBold,
        color: "#B78103",
    },
    verificationSubtitle: {
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: "#6D540A",
        marginTop: 2,
        lineHeight: 16,
    },
});
