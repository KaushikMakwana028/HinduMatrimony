import apiClient, { ApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

/**
 * Service for handling Profile and member profile data
 */
const profileService = {
    /**
     * Get member profile details by user ID
     * @param {string|number} userId
     * @param {string} token
     */
    async getProfile(userId, token) {
        if (!userId) {
            throw new ApiError('User ID is required to fetch profile', 400);
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
     * Alias for getProfile
     */
    async getMyProfile(userId, token) {
        return this.getProfile(userId, token);
    },
};

export default profileService;
