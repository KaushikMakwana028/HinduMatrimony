import apiClient, { ApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

/**
 * Service for handling Home screen data (dashboard stats, banners, member recommendations)
 */
const homeService = {
    /**
     * Get member dashboard data (stats, package info, member info)
     * @param {string} token
     */
    async getDashboardData(token) {
        const response = await apiClient.get(ENDPOINTS.MEMBER_DASHBOARD, { token });

        if (response && response.result === false) {
            throw new ApiError(
                response.message || 'Failed to fetch dashboard data',
                400,
                response
            );
        }

        return response;
    },
};

export default homeService;
