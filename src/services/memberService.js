import apiClient, { ApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

/**
 * Service for handling member profile updates, section management, and account actions
 */
const memberService = {
    /**
     * Update introduction bio
     * @param {Object} data { introduction: string }
     * @param {string} token
     */
    async updateIntroduction(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_INTRODUCTION_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update introduction', 400, response);
        }
        return response;
    },

    /**
     * Update basic profile info
     * @param {Object} data
     * @param {string} token
     */
    async updateBasicInfo(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_BASIC_INFO_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update basic information', 400, response);
        }
        return response;
    },

    /**
     * Update address (present / permanent)
     * @param {Object} data { country_id, state_id, city_id, postal_code, address_type }
     * @param {string} token
     */
    async updateAddress(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_ADDRESS_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update address', 400, response);
        }
        return response;
    },

    /**
     * Update education status
     * @param {Object} data { id, status }
     * @param {string} token
     */
    async updateEducationStatus(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_EDUCATION_STATUS_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update education status', 400, response);
        }
        return response;
    },

    /**
     * Update career status
     * @param {Object} data { id, status }
     * @param {string} token
     */
    async updateCareerStatus(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_CAREER_STATUS_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update career status', 400, response);
        }
        return response;
    },

    /**
     * Update physical attributes
     * @param {Object} data
     * @param {string} token
     */
    async updatePhysicalAttributes(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_PHYSICAL_ATTRIBUTES_UPDATE, data, { token });
        if (response && (response.result === false || response.status === false)) {
            throw new ApiError(response.message || 'Failed to update physical attributes', 400, response);
        }
        return response;
    },

    /**
     * Update language details
     * @param {Object} data { mothere_tongue, known_languages }
     * @param {string} token
     */
    async updateLanguage(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_LANGUAGE_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update language details', 400, response);
        }
        return response;
    },

    /**
     * Update hobbies & interests
     * @param {Object} data
     * @param {string} token
     */
    async updateHobbies(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_HOBBIES_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update hobbies', 400, response);
        }
        return response;
    },

    /**
     * Update attitude & behavior
     * @param {Object} data
     * @param {string} token
     */
    async updateAttitudeBehavior(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_ATTITUDE_BEHAVIOR_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update attitude & behavior', 400, response);
        }
        return response;
    },

    /**
     * Update residency info
     * @param {Object} data
     * @param {string} token
     */
    async updateResidencyInfo(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_RESIDENCY_INFO_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update residency info', 400, response);
        }
        return response;
    },

    /**
     * Update spiritual background
     * @param {Object} data
     * @param {string} token
     */
    async updateSpiritualBackground(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_SPIRITUAL_BACKGROUND_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update spiritual background', 400, response);
        }
        return response;
    },

    /**
     * Update lifestyle details
     * @param {Object} data { diet, drink, smoke, living_with }
     * @param {string} token
     */
    async updateLifestyle(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_LIFESTYLE_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update lifestyle', 400, response);
        }
        return response;
    },

    /**
     * Update astronomic / horoscope details
     * @param {Object} data { sun_sign, moon_sign, time_of_birth, city_of_birth }
     * @param {string} token
     */
    async updateAstronomic(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_ASTRONOMIC_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update astronomic details', 400, response);
        }
        return response;
    },

    /**
     * Update family info
     * @param {Object} data { father, mother, sibling }
     * @param {string} token
     */
    async updateFamilyInfo(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_FAMILY_INFO_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update family info', 400, response);
        }
        return response;
    },

    /**
     * Update partner expectations
     * @param {Object} data
     * @param {string} token
     */
    async updatePartnerExpectation(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_PARTNER_EXPECTATION_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update partner expectations', 400, response);
        }
        return response;
    },

    /**
     * Change user password
     * @param {Object} data { old_password, password, password_confirmation }
     * @param {string} token
     */
    async changePassword(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_CHANGE_PASSWORD, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to change password', 400, response);
        }
        return response;
    },

    /**
     * Update contact info
     * @param {Object} data { email, phone }
     * @param {string} token
     */
    async updateContactInfo(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_CONTACT_INFO_UPDATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update contact info', 400, response);
        }
        return response;
    },

    /**
     * Deactivate account
     * @param {Object} data { deacticvation_status: 1 }
     * @param {string} token
     */
    async deactivateAccount(data, token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_ACCOUNT_DEACTIVATE, data, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to deactivate account', 400, response);
        }
        return response;
    },

    /**
     * Delete account permanently
     * @param {string} token
     */
    async deleteAccount(token) {
        const response = await apiClient.post(ENDPOINTS.MEMBER_ACCOUNT_DELETE, {}, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to delete account', 400, response);
        }
        return response;
    },
};

export default memberService;
