import apiClient, { ApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

let cachedSettingsResponse = null;
let inFlightSettingsPromise = null;
let cachedMyProfile = null;
let cachedMyProfileTime = 0;
let inFlightMyProfilePromise = null;
const PROFILE_CACHE_TTL = 30000; // 30 seconds

/**
 * Service for handling Profile and member profile data
 */
const profileService = {
    /**
     * Clear cached settings and profile (e.g. on logout or manual refresh)
     */
    clearSettingsCache() {
        cachedSettingsResponse = null;
        inFlightSettingsPromise = null;
        cachedMyProfile = null;
        cachedMyProfileTime = 0;
        inFlightMyProfilePromise = null;
    },

    /**
     * Get member profile details by user ID
     * @param {string|number} userId
     * @param {string} token
     */
    async getProfile(userId, token) {
        if (!userId) {
            throw new ApiError('User ID is required to fetch profile', 400);
        }
        if (!token) {
            throw new ApiError('Authentication token is required', 401);
        }

        const endpoint = typeof ENDPOINTS.MEMBER_PROFILE === 'function'
            ? ENDPOINTS.MEMBER_PROFILE(userId)
            : `/member/public-profile/${userId}`;

        const response = await apiClient.get(endpoint, { token });

        if (response && response.result === false) {
            throw new ApiError(
                response.message || 'Failed to fetch profile data',
                400,
                response
            );
        }

        return response;
    },

    /**
     * Get member profile settings (authenticated user's full configuration & details)
     * Contains countries, states, cities, religions, castes, sub_castes,
     * marital_statuses, on_behalves, family_values, languages, member info.
     * @param {string} token
     * @param {boolean} forceRefresh
     */
    async getProfileSettings(token, forceRefresh = false) {
        if (!token) {
            throw new ApiError('Authentication token is required', 401);
        }

        if (!forceRefresh && cachedSettingsResponse) {
            return cachedSettingsResponse;
        }

        if (!forceRefresh && inFlightSettingsPromise) {
            return inFlightSettingsPromise;
        }

        inFlightSettingsPromise = (async () => {
            try {
                const response = await apiClient.get(
                    ENDPOINTS.MEMBER_PROFILE_SETTINGS || '/member/profile-settings',
                    { token, timeout: 15000 }
                );

                if (response && response.result === false) {
                    throw new ApiError(response.message || 'Failed to fetch profile settings', 400, response);
                }

                cachedSettingsResponse = response;
                return response;
            } finally {
                inFlightSettingsPromise = null;
            }
        })();

        return inFlightSettingsPromise;
    },

    /**
     * Comprehensive profile fetcher for the logged in user:
     * Attempts to query both public profile and internal profile settings,
     * merging all available sections so no fields are missing even if email verification is pending.
     * Deduplicates in-flight calls and serves in-memory cache to ensure instant screen transitions.
     * @param {string|number} userId
     * @param {string} token
     * @param {boolean} forceRefresh
     */
    async getMyProfile(userId, token, forceRefresh = false) {
        if (!token) {
            throw new ApiError('Authentication token is required', 401);
        }

        const now = Date.now();
        if (!forceRefresh && cachedMyProfile && now - cachedMyProfileTime < PROFILE_CACHE_TTL) {
            return cachedMyProfile;
        }

        if (!forceRefresh && inFlightMyProfilePromise) {
            return inFlightMyProfilePromise;
        }

        if (forceRefresh) {
            this.clearSettingsCache();
        }

        inFlightMyProfilePromise = (async () => {
            try {
                let publicData = null;
                let settingsData = null;
                let fetchError = null;

                const results = await Promise.allSettled([
                    this.getProfile(userId, token),
                    this.getProfileSettings(token, forceRefresh),
                ]);

                if (results[0].status === 'fulfilled' && results[0].value?.data) {
                    publicData = results[0].value.data;
                } else if (results[0].status === 'rejected') {
                    fetchError = results[0].reason;
                }

                if (results[1].status === 'fulfilled' && results[1].value) {
                    settingsData = results[1].value.data || results[1].value;
                }

                // If at least one responded with data, merge them cleanly
                if (publicData || settingsData) {
                    const memberObj = settingsData?.member || {};
                    const pubBasic = publicData?.basic_info || {};

                    const pubSpiritual =
                        (publicData?.spiritual_backgrounds && typeof publicData.spiritual_backgrounds === 'object') ? publicData.spiritual_backgrounds :
                        (publicData?.spiritual_background && typeof publicData.spiritual_background === 'object') ? publicData.spiritual_background : {};
                    const setSpiritual =
                        (settingsData?.spiritual_backgrounds && typeof settingsData.spiritual_backgrounds === 'object') ? settingsData.spiritual_backgrounds :
                        (settingsData?.spiritual_background && typeof settingsData.spiritual_background === 'object') ? settingsData.spiritual_background : {};
                    const mergedSpiritual = {
                        ...setSpiritual,
                        ...pubSpiritual,
                    };

                    const resolvedPhoto = pubBasic.photo || memberObj.photo || publicData?.avatar || settingsData?.member?.photo || publicData?.photo || '';

                    const mergedResult = {
                        result: true,
                        data: {
                            ...(publicData || {}),
                            ...(settingsData || {}),
                            photo: resolvedPhoto,
                            basic_info: {
                                ...memberObj,
                                ...(settingsData?.basic_info || {}),
                                ...pubBasic,
                                // Ensure essential fields are preserved
                                first_name: pubBasic.first_name || pubBasic.firs_name || memberObj.first_name || memberObj.firs_name || '',
                                last_name: pubBasic.last_name || memberObj.last_name || '',
                                gender: pubBasic.gender || memberObj.gender || '',
                                date_of_birth: pubBasic.date_of_birth || memberObj.date_of_birth || memberObj.birthday || '',
                                age: pubBasic.age || memberObj.age,
                                marital_status: pubBasic.maritial_status || pubBasic.marital_status || memberObj.marital_status || memberObj.maritial_status || '',
                                on_behalf: pubBasic.on_behalf || pubBasic.onbehalf || memberObj.on_behalf || memberObj.onbehalf || '',
                                phone: pubBasic.phone || memberObj.phone || publicData?.contact_details?.phone || '',
                                email: pubBasic.email || memberObj.email || publicData?.contact_details?.email || '',
                                photo: resolvedPhoto,
                                code: pubBasic.code || memberObj.code || '',
                            },
                            contact_details: {
                                ...(settingsData?.contact_details || {}),
                                ...(publicData?.contact_details || {}),
                                email: publicData?.contact_details?.email || memberObj.email || '',
                                phone: publicData?.contact_details?.phone || memberObj.phone || '',
                            },
                            present_address: publicData?.present_address || settingsData?.present_address,
                            permanent_address: publicData?.permanent_address || settingsData?.permanent_address,
                            spiritual_background: Object.keys(mergedSpiritual).length > 0 ? mergedSpiritual : (publicData?.spiritual_backgrounds || publicData?.spiritual_background || settingsData?.spiritual_background || settingsData?.spiritual_backgrounds),
                            physical_attributes: publicData?.physical_attributes || settingsData?.physical_attributes,
                            education: publicData?.education || settingsData?.education || [],
                            career: publicData?.career || settingsData?.career || [],
                            hobbies_interest: publicData?.hobbies_interest || settingsData?.hobbies_interest,
                            attitude_behavior: publicData?.attitude_behavior || settingsData?.attitude_behavior,
                            residence_info: publicData?.residence_info || settingsData?.residence_info,
                            lifestyles: publicData?.lifestyles || publicData?.lifestyle || settingsData?.lifestyles || settingsData?.lifestyle,
                            astrologies: publicData?.astrologies || settingsData?.astrologies,
                            families_information: publicData?.families_information || settingsData?.families_information,
                            partner_expectation: publicData?.partner_expectation || settingsData?.partner_expectation,
                            introduction: publicData?.intoduction?.introduction ?? (publicData?.introduction || settingsData?.introduction || ''),
                            mother_tongue: publicData?.mother_tongue || pubBasic.mothere_tongue || settingsData?.mother_tongue || '',
                            known_languages: publicData?.known_languages || settingsData?.known_languages || '',
                        },
                    };

                    cachedMyProfile = mergedResult;
                    cachedMyProfileTime = Date.now();
                    return mergedResult;
                }

                if (fetchError) {
                    throw fetchError;
                }

                return { result: false, message: 'No profile information found' };
            } finally {
                inFlightMyProfilePromise = null;
            }
        })();

        return inFlightMyProfilePromise;
    },
};

export default profileService;
