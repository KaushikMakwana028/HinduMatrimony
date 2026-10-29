import apiClient, { ApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

let cachedDashboard = null;
let cachedDashboardToken = null;
let cachedDashboardTime = 0;
let inFlightDashboardPromise = null;
const DASHBOARD_CACHE_TTL = 30000; // 30 seconds

/**
 * Service for handling Home screen data (dashboard stats, banners, member recommendations)
 */
const homeService = {
    /**
     * Clear cached dashboard data
     */
    clearDashboardCache() {
        cachedDashboard = null;
        cachedDashboardToken = null;
        cachedDashboardTime = 0;
        inFlightDashboardPromise = null;
    },

    /**
     * Get member dashboard data (stats, package info, member info)
     * Deduplicates in-flight requests and serves fresh memory cache to prevent UI lag.
     * @param {string} token
     * @param {boolean} forceRefresh
     */
    async getDashboardData(token, forceRefresh = false) {
        if (!token) return null;

        const now = Date.now();
        if (
            !forceRefresh &&
            cachedDashboard &&
            cachedDashboardToken === token &&
            now - cachedDashboardTime < DASHBOARD_CACHE_TTL
        ) {
            return cachedDashboard;
        }

        if (!forceRefresh && inFlightDashboardPromise && cachedDashboardToken === token) {
            return inFlightDashboardPromise;
        }

        if (forceRefresh || cachedDashboardToken !== token) {
            this.clearDashboardCache();
        }

        cachedDashboardToken = token;

        inFlightDashboardPromise = (async () => {
            try {
                const response = await apiClient.get(ENDPOINTS.MEMBER_DASHBOARD, { token, timeout: 15000 });

                if (response && response.result === false) {
                    throw new ApiError(
                        response.message || 'Failed to fetch dashboard data',
                        400,
                        response
                    );
                }

                if (response && response.result !== false && response.data) {
                    cachedDashboard = response;
                    cachedDashboardToken = token;
                    cachedDashboardTime = Date.now();
                }

                return response;
            } finally {
                inFlightDashboardPromise = null;
            }
        })();

        return inFlightDashboardPromise;
    },
};

export default homeService;
