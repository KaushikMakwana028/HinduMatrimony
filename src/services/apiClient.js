/* eslint-disable import/namespace */
import * as FileSystem from 'expo-file-system';
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

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    const requestHeaders = {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...headers,
    };

    if (!isFormData && !requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
    }

    if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers: requestHeaders,
        signal: controller.signal,
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.body = isFormData ? body : (typeof body === 'string' ? body : JSON.stringify(body));
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

            // Never show raw 500 or technical "Server Error" strings to the user
            if (
                response.status >= 500 ||
                errorMessage.toLowerCase().includes('server error') ||
                errorMessage.toLowerCase().includes('sqlstate') ||
                errorMessage.toLowerCase().includes('integrity constraint')
            ) {
                errorMessage = 'Some required information is missing or invalid. Please check your entries.';
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

/**
 * Dedicated multipart file uploader that uses native FileSystem.uploadAsync
 * to eliminate "Unsupported FormDataPart implementation" errors on modern Expo/React Native.
 */
async function uploadFileRequest(endpoint, fileOptions = {}, options = {}) {
    const {
        fileUri,
        fieldName = 'file',
        parameters = {},
        mimeType = 'image/jpeg',
    } = fileOptions;

    const { token = null, headers = {} } = options;

    if (!fileUri) {
        throw new ApiError('No file URI provided for upload', 400);
    }

    const url = endpoint.startsWith('http')
        ? endpoint
        : `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const requestHeaders = {
        Accept: 'application/json',
        ...headers,
    };

    if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const stringParams = {};
    if (parameters && typeof parameters === 'object') {
        Object.keys(parameters).forEach((k) => {
            if (parameters[k] !== undefined && parameters[k] !== null) {
                stringParams[k] = String(parameters[k]);
            }
        });
    }

    // Attempt native background multipart upload via expo-file-system
    if (FileSystem?.uploadAsync && FileSystem?.FileSystemUploadType?.MULTIPART) {
        try {
            const uploadResult = await FileSystem.uploadAsync(url, fileUri, {
                fieldName,
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                headers: requestHeaders,
                mimeType,
                parameters: stringParams,
            });

            let data = null;
            try {
                data = JSON.parse(uploadResult.body);
            } catch {
                data = uploadResult.body;
            }

            if (uploadResult.status >= 400 || (data && data.result === false)) {
                const errMsg =
                    (typeof data === 'object' && (data?.message || data?.error)) ||
                    `Upload failed with status ${uploadResult.status}`;
                throw new ApiError(errMsg, uploadResult.status, data);
            }

            return data;
        } catch (uploadErr) {
            if (uploadErr instanceof ApiError) throw uploadErr;
            console.log('FileSystem.uploadAsync failed, attempting fallback:', uploadErr.message);
        }
    }

    // Fallback: Use standard FormData with File or Blob
    const formData = new FormData();
    Object.keys(stringParams).forEach((k) => {
        formData.append(k, stringParams[k]);
    });

    if (FileSystem?.File) {
        try {
            const fileObj = new FileSystem.File(fileUri);
            formData.append(fieldName, fileObj);
        } catch {
            formData.append(fieldName, {
                uri: fileUri,
                name: fileUri.split('/').pop() || 'upload.jpg',
                type: mimeType,
            });
        }
    } else {
        formData.append(fieldName, {
            uri: fileUri,
            name: fileUri.split('/').pop() || 'upload.jpg',
            type: mimeType,
        });
    }

    return request(endpoint, {
        method: 'POST',
        body: formData,
        token,
        headers,
    });
}

const apiClient = {
    get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
    post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
    put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
    delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
    uploadFile: (endpoint, fileOptions, options = {}) => uploadFileRequest(endpoint, fileOptions, options),
};

export default apiClient;
