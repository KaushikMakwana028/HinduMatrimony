import apiClient, { ApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

/**
 * Service for fetching members who have viewed the logged-in user's profile.
 */
const profileViewerService = {
    /**
     * Get paginated list of profile viewers
     * @param {string} token
     * @param {number} page
     */
    async getProfileViewers(token, page = 1) {
        if (!token) {
            throw new ApiError('Authentication token is required', 401);
        }

        const base = ENDPOINTS.PROFILE_VIEWERS || '/member/profile-viewers';
        const endpoint = `${base}?page=${page}`;

        const response = await apiClient.get(endpoint, { token });

        if (response && response.result === false) {
            throw new ApiError(
                response.message || 'Failed to fetch profile viewers',
                400,
                response
            );
        }

        return {
            data: Array.isArray(response?.data) ? response.data : [],
            meta: response?.meta || {
                current_page: page,
                last_page: page,
                per_page: 10,
                total: Array.isArray(response?.data) ? response.data.length : 0,
            },
        };
    },
};

export default profileViewerService;