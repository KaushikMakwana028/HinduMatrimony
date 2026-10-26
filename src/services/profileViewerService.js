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

        let response;
        try {
            response = await apiClient.get(endpoint, { token });
        } catch (err) {
            const msg = err?.message || '';
            const isPackageGated = /package|upgrade|limit|remaining|permission|membership|forbidden|403|unauthorized/i.test(msg);
            return {
                data: [],
                meta: {
                    current_page: page,
                    last_page: page,
                    per_page: 10,
                    total: 0,
                },
                packageGated: isPackageGated,
                errorMessage: msg,
                result: false,
            };
        }

        // Handle error responses from backend
        if (response && response.result === false) {
            const msg = response.message || '';
            const isPackageGated = /package|upgrade|limit|remaining|permission|membership/i.test(msg);
            return {
                data: [],
                meta: {
                    current_page: page,
                    last_page: page,
                    per_page: 10,
                    total: 0,
                },
                packageGated: isPackageGated,
                errorMessage: msg,
                result: false,
            };
        }

        // Support all pagination / payload variations from Active Matrimonial CMS
        let list = [];
        let meta = {
            current_page: page,
            last_page: page,
            per_page: 10,
            total: 0,
        };

        if (Array.isArray(response?.data)) {
            list = response.data;
            meta.total = list.length;
        } else if (response?.data && Array.isArray(response.data.data)) {
            list = response.data.data;
            meta = {
                current_page: response.data.current_page || page,
                last_page: response.data.last_page || page,
                per_page: response.data.per_page || 10,
                total: response.data.total ?? list.length,
            };
        } else if (Array.isArray(response?.profile_viewers)) {
            list = response.profile_viewers;
            meta.total = list.length;
        } else if (response?.meta && Array.isArray(response?.data)) {
            list = response.data;
            meta = response.meta;
        }

        const remainingViews = response?.remaining_profile_viewer_view ?? response?.data?.remaining_profile_viewer_view;

        return {
            data: list,
            meta,
            remainingViews,
            packageGated: false,
            result: true,
        };
    },
};

export default profileViewerService;
