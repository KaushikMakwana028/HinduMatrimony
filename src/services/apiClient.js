import { BASE_URL, TIMEOUT } from '../config/api';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
    constructor(message, status = null, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

/**
 * Base request function with timeout, header management, and error extraction
 */
async function request(endpoint, options = {}) {
    const {
        method = 'GET',
        body = null,
        token = null,
        headers = {},
        timeout = TIMEOUT || 30000,
    } = options;

    const url = endpoint.startsWith('http')
        ? endpoint
        : `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const requestHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...headers,
    };

    if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers: requestHeaders,
        signal: controller.signal,
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    let rawText = '';
    let data = null;

    try {
        const response = await fetch(url, config);
        clearTimeout(timer);

        try {
            rawText = await response.text();
            data = JSON.parse(rawText);
        } catch {
            data = null;
        }

        if (!response.ok) {
            const collectedMessages = [];

            // Recursive helper to traverse any object/array and collect error strings
            const extractErrors = (val) => {
                if (!val) return;
                if (typeof val === 'string') {
                    const trimmed = val.trim();
                    if (trimmed && !collectedMessages.includes(trimmed)) {
                        collectedMessages.push(trimmed);
                    }
                } else if (Array.isArray(val)) {
                    val.forEach(extractErrors);
                } else if (typeof val === 'object') {
                    Object.values(val).forEach(extractErrors);
                }
            };

            if (data && typeof data === 'object') {
                // Priority 1: Check standard error keys
                if (data.errors) extractErrors(data.errors);
                if (data.error) extractErrors(data.error);

                // Priority 2: Check message/messages if no errors extracted yet
                if (collectedMessages.length === 0 && data.message) {
                    extractErrors(data.message);
                }
                if (collectedMessages.length === 0 && data.messages) {
                    extractErrors(data.messages);
                }
                if (collectedMessages.length === 0 && data.msg) {
                    extractErrors(data.msg);
                }

                // Priority 3: Check other keys (excluding boolean flags/codes)
                if (collectedMessages.length === 0) {
                    Object.keys(data).forEach((key) => {
                        if (
                            key !== 'result' &&
                            key !== 'status' &&
                            key !== 'code' &&
                            key !== 'success'
                        ) {
                            extractErrors(data[key]);
                        }
                    });
                }
            }

            let errorMessage = '';
            if (collectedMessages.length > 0) {
                errorMessage = collectedMessages.join('\n');
            } else if (data) {
                if (typeof data === 'string') {
                    errorMessage = data;
                } else {
                    try {
                        errorMessage = JSON.stringify(data);
                    } catch {
                        errorMessage = `Request failed with status ${response.status}`;
                    }
                }
            } else if (rawText && rawText.trim()) {
                const stripped = rawText
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                errorMessage = stripped.slice(0, 300) || `Request failed with status ${response.status}`;
            } else {
                errorMessage = `Request failed with status ${response.status}`;
            }

            console.log(`[API Response ${response.status}] ${method} ${url}:`, {
                status: response.status,
                errorMessage,
                data,
                rawText: rawText ? rawText.slice(0, 300) : null,
            });

            throw new ApiError(errorMessage, response.status, data);
        }

        return data;
    } catch (error) {
        clearTimeout(timer);

        if (error.name === 'AbortError') {
            throw new ApiError('Request timed out. Please try again.', 408);
        }

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError(
            error.message || 'Unable to connect to server. Please check your internet connection.',
            0
        );
    }
}

const apiClient = {
    get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
    post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
    put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
    delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
};

export default apiClient;
