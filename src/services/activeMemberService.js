import apiClient, { ApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

/**
 * Service for handling Active Members, Search Filters, and Member Settings
 */
const activeMemberService = {
    /**
     * Get member profile settings and active member configurations
     * @param {string} token
     */
    async getProfileSettings(token) {
        const response = await apiClient.get(ENDPOINTS.MEMBER_PROFILE_SETTINGS, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to fetch member profile settings', 400, response);
        }
        return response;
    },

    /**
     * List members in Active Members screen
     * @param {Object} payload (all fields optional)
     * @param {string} token
     */
    async getMemberList(payload = {}, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_LISTING, payload, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to fetch member listing', 400, response);
        }
        return response;
    },

    /**
     * Express interest to a member
     * @param {number|string} userId
     * @param {string} token
     */
    async expressInterest(userId, token) {
        return apiClient.post(ENDPOINTS.EXPRESS_INTEREST, { user_id: userId }, { token });
    },

    /**
     * Accept received interest
     * @param {number|string} interestId
     * @param {string} token
     */
    async acceptInterest(interestId, token) {
        return apiClient.post(ENDPOINTS.INTEREST_ACCEPT, { interest_id: interestId }, { token });
    },

    /**
     * Reject received interest
     * @param {number|string} interestId
     * @param {string} token
     */
    async rejectInterest(interestId, token) {
        return apiClient.post(ENDPOINTS.INTEREST_REJECT, { interest_id: interestId }, { token });
    },

    /**
     * Get user's shortlisted profiles
     * @param {string} token
     */
    async getMyShortlists(token) {
        return apiClient.get(ENDPOINTS.MY_SHORTLISTS, { token });
    },

    /**
     * Add member to shortlist
     * @param {number|string} userId
     * @param {string} token
     */
    async addToShortlist(userId, token) {
        return apiClient.post(ENDPOINTS.ADD_TO_SHORTLIST, { user_id: userId }, { token });
    },

    /**
     * Remove member from shortlist
     * @param {number|string} userId
     * @param {string} token
     */
    async removeFromShortlist(userId, token) {
        return apiClient.post(ENDPOINTS.REMOVE_FROM_SHORTLIST, { user_id: userId }, { token });
    },

    /**
     * Get list of ignored users
     * @param {string} token
     */
    async getIgnoredUserList(token) {
        return apiClient.get(ENDPOINTS.IGNORED_USER_LIST, { token });
    },

    /**
     * Add member to ignore list
     * @param {number|string} userId
     * @param {string} token
     */
    async addToIgnoreList(userId, token) {
        return apiClient.post(ENDPOINTS.ADD_TO_IGNORE_LIST, { user_id: userId }, { token });
    },

    /**
     * Remove member from ignore list
     * @param {number|string} userId
     * @param {string} token
     */
    async removeFromIgnoreList(userId, token) {
        return apiClient.post(ENDPOINTS.REMOVE_FROM_IGNORED_LIST, { user_id: userId }, { token });
    },

    /**
     * Report an active member
     * @param {number|string} userId
     * @param {string} reason
     * @param {string} token
     */
    async reportMember(userId, reason = 'Reported profile', token) {
        return apiClient.post(ENDPOINTS.REPORT_MEMBER, { user_id: userId, reason }, { token });
    },

    /**
     * Filter active members by Basic Info
     * @param {Object} data
     * @param {string} token
     */
    async filterByBasicInfo(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_BASIC_INFO_UPDATE, data, { token });
    },

    /**
     * Filter active members by Physical Attributes
     * @param {Object} data
     * @param {string} token
     */
    async filterByPhysical(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_PHYSICAL_ATTRIBUTES_UPDATE, data, { token });
    },

    /**
     * Filter active members by Partner Expectations
     * @param {Object} data
     * @param {string} token
     */
    async filterByPartnerExpectation(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_PARTNER_EXPECTATION_UPDATE, data, { token });
    },

    /**
     * Filter active members by Lifestyle
     * @param {Object} data
     * @param {string} token
     */
    async filterByLifestyle(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_LIFESTYLE_UPDATE, data, { token });
    },

    /**
     * Filter active members by Language
     * @param {Object} data
     * @param {string} token
     */
    async filterByLanguage(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_LANGUAGE_UPDATE, data, { token });
    },

    /**
     * Filter active members by Hobbies & Interests
     * @param {Object} data
     * @param {string} token
     */
    async filterByHobbies(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_HOBBIES_UPDATE, data, { token });
    },

    /**
     * Filter active members by Spiritual Background
     * @param {Object} data
     * @param {string} token
     */
    async filterBySpiritualBackground(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_SPIRITUAL_BACKGROUND_UPDATE, data, { token });
    },

    /**
     * Filter active members by Address / Location
     * @param {Object} data
     * @param {string} token
     */
    async filterByAddress(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_ADDRESS_UPDATE, data, { token });
    },

    /**
     * Update introduction text
     * @param {Object} data
     * @param {string} token
     */
    async updateIntroduction(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_INTRODUCTION_UPDATE, data, { token });
    },

    /**
     * Update education status
     * @param {Object} data
     * @param {string} token
     */
    async updateEducationStatus(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_EDUCATION_STATUS_UPDATE, data, { token });
    },

    /**
     * Update career status
     * @param {Object} data
     * @param {string} token
     */
    async updateCareerStatus(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_CAREER_STATUS_UPDATE, data, { token });
    },

    /**
     * Update attitude & behavior
     * @param {Object} data
     * @param {string} token
     */
    async updateAttitudeBehavior(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_ATTITUDE_BEHAVIOR_UPDATE, data, { token });
    },

    /**
     * Update residency info
     * @param {Object} data
     * @param {string} token
     */
    async updateResidencyInfo(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_RESIDENCY_INFO_UPDATE, data, { token });
    },

    /**
     * Update astronomic / kundli info
     * @param {Object} data
     * @param {string} token
     */
    async updateAstronomic(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_ASTRONOMIC_UPDATE, data, { token });
    },

    /**
     * Update family info
     * @param {Object} data
     * @param {string} token
     */
    async updateFamilyInfo(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_FAMILY_INFO_UPDATE, data, { token });
    },

    /**
     * Update contact info
     * @param {Object} data
     * @param {string} token
     */
    async updateContactInfo(data, token) {
        return apiClient.post(ENDPOINTS.MEMBER_CONTACT_INFO_UPDATE, data, { token });
    },
};

export default activeMemberService;
