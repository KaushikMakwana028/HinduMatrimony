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
        const payload = {
            ...data,
            first_name: data.first_name || data.firs_name || '',
            firs_name: data.firs_name || data.first_name || '',
        };
        const response = await apiClient.post(ENDPOINTS.MEMBER_BASIC_INFO_UPDATE, payload, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update basic information', 400, response);
        }
        return response;
    },

    /**
     * Upload / Update profile avatar photo via basic-info update API
     * @param {Object} asset ImagePicker asset { uri, fileName, mimeType }
     * @param {Object} basicData { first_name, last_name, email, phone, gender, etc. }
     * @param {string} token
     */
    async uploadProfilePhoto(asset, basicData = {}, token) {
        if (!asset || !asset.uri) {
            throw new ApiError('Please select a photo to upload', 400);
        }
        if (!token) {
            throw new ApiError('Authentication token is required', 401);
        }

        const uri = asset.uri;
        const uriParts = uri.split('/');
        const fileName = asset.fileName || uriParts[uriParts.length - 1] || `profile_photo_${Date.now()}.jpg`;

        let mimeType = asset.mimeType;
        if (!mimeType) {
            const match = /\.(\w+)$/.exec(fileName);
            const ext = match ? match[1].toLowerCase() : 'jpg';
            mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        }

        const firstName = basicData.first_name || basicData.firs_name || basicData.name?.split(' ')[0] || 'Member';
        const lastName = basicData.last_name || basicData.name?.split(' ').slice(1).join(' ') || '';

        const parameters = {
            first_name: firstName,
            firs_name: firstName,
            last_name: lastName,
            email: basicData.email || '',
            phone: basicData.phone || '',
            gender: basicData.gender || 'male',
            date_of_birth: basicData.date_of_birth || basicData.dob || '',
            on_behalf: String(basicData.on_behalf || basicData.onbehalf || '1'),
            marital_status: String(basicData.marital_status || basicData.maritial_status || 'Never Married'),
            children: String(basicData.children || '0'),
        };

        const response = await apiClient.uploadFile(
            ENDPOINTS.MEMBER_BASIC_INFO_UPDATE,
            {
                fileUri: uri,
                fieldName: 'photo',
                fileName,
                mimeType,
                parameters,
            },
            { token }
        );

        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update profile photo', 400, response);
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
        // Guarantee all ID fields are positive integers and required fields are defined
        // to prevent MySQL integrity constraint violations / 500 errors on the backend.
        const payload = {
            general: String(data.general || 'Looking for a caring, family-oriented partner'),
            partner_height: data.partner_height !== undefined && data.partner_height !== null ? String(data.partner_height) : '5.6',
            partner_weight: data.partner_weight !== undefined && data.partner_weight !== null ? String(data.partner_weight) : '60',
            partner_marital_status: Number(data.partner_marital_status) || 1,
            partner_children_acceptable: String(data.partner_children_acceptable || 'No'),
            residence_country_id: Number(data.residence_country_id) || 1,
            partner_country_id: Number(data.partner_country_id) || Number(data.residence_country_id) || 1,
            partner_state_id: Number(data.partner_state_id) || 1,
            partner_religion_id: Number(data.partner_religion_id) || 1,
            partner_caste_id: Number(data.partner_caste_id) || 1,
            partner_sub_caste_id: Number(data.partner_sub_caste_id) || 1,
            pertner_education: String(data.pertner_education || data.partner_education || 'Graduate'),
            partner_education: String(data.pertner_education || data.partner_education || 'Graduate'),
            partner_profession: String(data.partner_profession || 'Professional'),
            smoking_acceptable: String(data.smoking_acceptable || 'No'),
            drinking_acceptable: String(data.drinking_acceptable || 'No'),
            partner_diet: String(data.partner_diet || 'Vegetarian'),
            partner_body_type: String(data.partner_body_type || 'Average'),
            partner_personal_value: String(data.partner_personal_value || 'Traditional'),
            partner_manglik: String(data.partner_manglik || 'No'),
            language_id: Number(data.language_id) || 1,
            family_value_id: Number(data.family_value_id) || 1,
            pertner_complexion: String(data.pertner_complexion || data.partner_complexion || 'Fair'),
            partner_complexion: String(data.pertner_complexion || data.partner_complexion || 'Fair'),
        };

        const response = await apiClient.post(ENDPOINTS.MEMBER_PARTNER_EXPECTATION_UPDATE, payload, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to update partner expectations', 400, response);
        }
        return response;
    },

    /**
     * Change user password
     * POST https://hindumatrimony.org.in/api/member/change/password
     * @param {Object} data { old_password, password, password_confirmation }
     * @param {string} token
     */
    async changePassword(data, token) {
        const payload = {
            old_password: data.old_password,
            password: data.password,
            password_confirmation: data.password_confirmation,
        };
        const response = await apiClient.post(ENDPOINTS.MEMBER_CHANGE_PASSWORD, payload, { token });
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
     * POST https://hindumatrimony.org.in/api/member/account/deactivate
     * Payload: { "deacticvation_status": 1 }
     *
     * @param {string|Object} arg1 - Token or optional payload
     * @param {string|Object} arg2 - Token or optional payload
     */
    async deactivateAccount(arg1, arg2) {
        let token = null;
        let data = {};
        if (typeof arg1 === 'string') {
            token = arg1;
            data = typeof arg2 === 'object' && arg2 !== null ? arg2 : {};
        } else if (typeof arg2 === 'string') {
            token = arg2;
            data = typeof arg1 === 'object' && arg1 !== null ? arg1 : {};
        }
        const payload = {
            deacticvation_status: 1,
            deactivation_status: 1,
            ...data,
        };
        const response = await apiClient.post(ENDPOINTS.MEMBER_ACCOUNT_DEACTIVATE, payload, { token });
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to deactivate account', 400, response);
        }
        return response;
    },

    /**
     * Delete account permanently
     * POST https://hindumatrimony.org.in/api/member/account/delete
     * (No payload needed — uses authenticated user via token)
     *
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
