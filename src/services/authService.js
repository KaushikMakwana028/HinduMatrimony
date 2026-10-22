import apiClient, { ApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

/**
 * Service for handling authentication requests (signup, signin, logout)
 */
const authService = {
    /**
     * Register a new user
     * @param {Object} payload
     * @param {string} payload.first_name
     * @param {string} payload.last_name
     * @param {string} payload.email
     * @param {string} payload.phone
     * @param {string} payload.password
     * @param {string} payload.password_confirmation
     * @param {string} payload.gender - 'male' | 'female'
     * @param {string} payload.date_of_birth - 'YYYY-MM-DD'
     * @param {string} payload.on_behalf - e.g. '1'
     */
    async signup(payload) {
        // Build payload matching API specification
        const body = {
            first_name: payload.first_name ? String(payload.first_name).trim() : '',
            last_name: payload.last_name ? String(payload.last_name).trim() : '',
            email: payload.email ? String(payload.email).trim().toLowerCase() : '',
            phone: payload.phone ? String(payload.phone).trim() : '',
            password: payload.password,
            password_confirmation: payload.password_confirmation || payload.password,
            gender: payload.gender ? String(payload.gender).toLowerCase() : '',
            date_of_birth: payload.date_of_birth,
            on_behalf: payload.on_behalf ? String(payload.on_behalf) : '1',
            // If your API does not need on_behalf or other fields, comment them here:
            // ...(payload.on_behalf ? { on_behalf: String(payload.on_behalf) } : {}),
        };

        const response = await apiClient.post(ENDPOINTS.SIGNUP, body);

        // API may return 200 with result: false
        if (response && response.result === false) {
            throw new ApiError(response.message || 'Registration failed. Please try again.', 400, response);
        }

        return response;
    },

    /**
     * Login user with email/phone and password
     * @param {Object} credentials
     * @param {string} credentials.email_or_phone
     * @param {string} credentials.password
     */
    async signin(credentials) {
        const body = {
            email_or_phone: credentials.email_or_phone ? String(credentials.email_or_phone).trim() : '',
            password: credentials.password,
        };

        const response = await apiClient.post(ENDPOINTS.SIGNIN, body);

        if (response && response.result === false) {
            throw new ApiError(response.message || 'Login failed. Please check your credentials.', 401, response);
        }

        return response;
    },

    /**
     * Alias for signup
     */
    async register(payload) {
        return this.signup(payload);
    },

    /**
     * Alias for signin
     */
    async login(credentials) {
        return this.signin(credentials);
    },

    /**
     * Logout current session
     * @param {string} token - Bearer access token
     */
    async logout(token) {
        if (!token) {
            return { result: true, message: 'Logged out locally' };
        }

        try {
            return await apiClient.post(ENDPOINTS.LOGOUT, {}, { token });
        } catch (error) {
            // Even if network fails on logout, allow client to complete local cleanup
            console.warn('Server logout failed:', error?.message);
            return { result: true, message: 'Logged out locally' };
        }
    },
};

export { authService };
export default authService;
