import apiClient, { ApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

/**
 * Normalizes an image path to a full URL if relative
 */
export function normalizePackageImageUrl(path) {
    if (!path || typeof path !== 'string') return '';
    const trimmed = path.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    if (trimmed.startsWith('/')) {
        return `https://hindumatrimony.org.in${trimmed}`;
    }
    return `https://hindumatrimony.org.in/${trimmed}`;
}

/**
 * Clean HTML strings into readable plain-text instructions
 */
export function cleanHtmlText(html = '') {
    if (!html || typeof html !== 'string') return '';
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<h[1-6][^>]*>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
}

/**
 * Extract QR code image URL from payment description HTML
 */
export function extractQrCodeUrl(html = '', photo = null) {
    if (html && typeof html === 'string') {
        const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match && match[1]) {
            return normalizePackageImageUrl(match[1]);
        }
    }
    if (photo && typeof photo === 'string') {
        const trimmed = photo.trim();
        if (trimmed.startsWith('http') || trimmed.includes('/') || trimmed.endsWith('.jpg') || trimmed.endsWith('.png')) {
            return normalizePackageImageUrl(trimmed);
        }
    }
    return '';
}

let cachedPackages = null;
let cachedPackagesTime = 0;
let inFlightPackagesPromise = null;
const PACKAGES_CACHE_TTL = 120000; // 2 minutes

const packageService = {
    /**
     * Get list of available packages/plans
     * GET https://hindumatrimony.org.in/api/home/packages
     *
     * @param {string} [token]
     * @param {boolean} [forceRefresh=false]
     * @returns {Promise<Array>}
     */
    async getPackages(token = null, forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && cachedPackages && now - cachedPackagesTime < PACKAGES_CACHE_TTL) {
            return cachedPackages;
        }

        if (!forceRefresh && inFlightPackagesPromise) {
            return inFlightPackagesPromise;
        }

        inFlightPackagesPromise = (async () => {
            try {
                const response = await apiClient.get(ENDPOINTS.PACKAGES_LIST, { token, timeout: 15000 });

                if (response && response.result === false) {
                    throw new ApiError(response.message || 'Failed to load membership packages', 400, response);
                }

                const rawList = Array.isArray(response)
                    ? response
                    : Array.isArray(response?.data)
                        ? response.data
                        : [];

                const mapped = rawList.map((pkg) => ({
                    id: pkg.package_id ?? pkg.id,
                    package_id: pkg.package_id ?? pkg.id,
                    name: pkg.name || 'Membership Plan',
                    price: Number(pkg.price ?? 0),
                    price_text: pkg.price_text || `₹${pkg.price ?? 0}`,
                    image: normalizePackageImageUrl(pkg.image),
                    express_interest: Number(pkg.express_interest ?? 0),
                    photo_gallery: Number(pkg.photo_gallery ?? 0),
                    contact: Number(pkg.contact ?? 0),
                    profile_view: Number(pkg.profile_viewers_view ?? pkg.profile_view ?? 0),
                    profile_viewers_view: Number(pkg.profile_viewers_view ?? pkg.profile_view ?? 0),
                    profile_image_view: Number(pkg.profile_image_view ?? 0),
                    gallery_image_view: Number(pkg.gallery_image_view ?? 0),
                    validity: Number(pkg.validity ?? 30),
                    auto_profile_match: Boolean(pkg.auto_profile_match),
                    raw: pkg,
                }));

                if (mapped.length > 0) {
                    cachedPackages = mapped;
                    cachedPackagesTime = Date.now();
                }

                return mapped;
            } finally {
                inFlightPackagesPromise = null;
            }
        })();

        return inFlightPackagesPromise;
    },

    /**
     * Get payment methods for a package
     * GET https://hindumatrimony.org.in/api/package-payment-methods/:id
     *
     * @param {number|string} packageId
     * @param {string} [token]
     * @returns {Promise<{ package: Object, manual_payments: Array }>}
     */
    async getPackagePaymentMethods(packageId, token = null) {
        if (!packageId) {
            throw new ApiError('Package ID is required to fetch payment methods', 400);
        }

        const endpoint = ENDPOINTS.PACKAGE_PAYMENT_METHODS(packageId);
        const response = await apiClient.get(endpoint, { token });

        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to load payment methods', 400, response);
        }

        const pkg = response?.package || {};
        const rawPayments = Array.isArray(response?.manual_payments)
            ? response.manual_payments
            : [];

        const manualPayments = rawPayments.map((item) => {
            const descriptionHtml = item.description || '';
            const qrImageUrl = extractQrCodeUrl(descriptionHtml, item.photo);
            const cleanDescription = cleanHtmlText(descriptionHtml);

            return {
                id: item.id,
                type: item.type || 'custom_payment',
                heading: item.heading || 'Offline Payment',
                description: descriptionHtml,
                cleanDescription,
                qrImageUrl,
                bank_info: item.bank_info,
                photo: item.photo,
                created_at: item.created_at,
                updated_at: item.updated_at,
                raw: item,
            };
        });

        return {
            package: {
                id: pkg.id || packageId,
                name: pkg.name || 'Membership Plan',
                price: Number(pkg.price ?? 0),
                price_text: pkg.price_text || `₹${pkg.price ?? 0}`,
                validity: Number(pkg.validity ?? 30),
                express_interest: Number(pkg.express_interest ?? 0),
                photo_gallery: Number(pkg.photo_gallery ?? 0),
                contact: Number(pkg.contact ?? 0),
                profile_viewers_view: Number(pkg.profile_viewers_view ?? 0),
                profile_image_view: Number(pkg.profile_image_view ?? 0),
                gallery_image_view: Number(pkg.gallery_image_view ?? 0),
                auto_profile_match: Boolean(pkg.auto_profile_match),
                image: normalizePackageImageUrl(pkg.image),
                active: pkg.active,
                raw: pkg,
            },
            manual_payments: manualPayments,
            raw: response,
        };
    },

    /**
     * Purchase a package via manual payment
     * POST https://hindumatrimony.org.in/api/member/package-purchase
     * Payload: (multipart/form-data)
     * - package_id: 1
     * - amount: 999
     * - payment_method: manual_payment
     * - manual_payment_id: 3 (or 2)
     * - transaction_id: "TXN123456"
     * - payment_details: "Paid via bank transfer"
     * - payment_proof: file (image/pdf)
     *
     * @param {Object} params
     * @param {string} token
     */
    async purchasePackage(params, token) {
        if (!token) {
            throw new ApiError('Authentication token is required to purchase a package', 401);
        }

        const {
            package_id,
            amount,
            payment_method = 'manual_payment',
            manual_payment_id = 3,
            transaction_id,
            payment_details,
            payment_proof,
        } = params;

        if (!package_id) {
            throw new ApiError('Please select a package to purchase', 400);
        }

        if (amount === undefined || amount === null) {
            throw new ApiError('Package amount is required', 400);
        }

        if (!transaction_id || !transaction_id.trim()) {
            throw new ApiError('Transaction / UTR ID is required', 400);
        }

        if (!payment_proof || !payment_proof.uri) {
            throw new ApiError('Please upload a screenshot or document of payment proof', 400);
        }

        const uri = payment_proof.uri;
        const uriParts = uri.split('/');
        const rawFileName =
            payment_proof.fileName ||
            payment_proof.name ||
            uriParts[uriParts.length - 1] ||
            `payment_proof_${Date.now()}.jpg`;
        const fileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

        let mimeType = payment_proof.mimeType;
        if (!mimeType) {
            const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
            const ext = match ? match[1].toLowerCase() : 'jpg';
            if (ext === 'png') mimeType = 'image/png';
            else if (ext === 'webp') mimeType = 'image/webp';
            else if (ext === 'pdf') mimeType = 'application/pdf';
            else mimeType = 'image/jpeg';
        }

        const response = await apiClient.uploadFile(
            ENDPOINTS.PACKAGE_PURCHASE,
            {
                fileUri: uri,
                fieldName: 'payment_proof',
                fileName,
                mimeType,
                parameters: {
                    package_id: String(package_id),
                    amount: String(amount),
                    payment_method: String(payment_method),
                    manual_payment_id: String(manual_payment_id),
                    transaction_id: transaction_id.trim(),
                    payment_details: (payment_details || 'Paid via manual payment').trim(),
                },
            },
            { token }
        );

        if (response && response.result === false) {
            throw new ApiError(response.message || 'Payment submission failed', 400, response);
        }

        return response;
    },

    /**
     * Get Package Purchase History
     * GET https://hindumatrimony.org.in/api/member/package-purchase-history
     *
     * @param {number} [page=1]
     * @param {string} token
     * @returns {Promise<{ list: Array, hasMore: boolean }>}
     */
    async getPurchaseHistory(page = 1, token) {
        if (!token) {
            throw new ApiError('Authentication token is required to view purchase history', 401);
        }

        const endpoint = `${ENDPOINTS.PACKAGE_PURCHASE_HISTORY}?page=${page}`;
        const response = await apiClient.get(endpoint, { token });

        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to load purchase history', 400, response);
        }

        const rawList = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
                ? response.data
                : [];

        const list = rawList.map((item) => ({
            id: item.id,
            payment_code: item.payment_code || `#${item.id}`,
            package_name: item.package_name || item.package?.name || 'Package',
            amount: Number(item.amount ?? 0),
            payment_method: item.payment_method || 'manual_payment',
            payment_status: item.payment_status || 'Due',
            created_at: item.created_at || '',
            raw: item,
        }));

        const hasMore = Boolean(response?.links?.next || (response?.meta && response.meta.current_page < response.meta.last_page));

        return { list, hasMore, raw: response };
    },

    /**
     * Get invoice details for a package payment
     * POST https://hindumatrimony.org.in/api/member/package-purchase-history-invoice
     * Payload: { package_payment_id: 1 }
     *
     * @param {number|string} packagePaymentId
     * @param {string} token
     * @returns {Promise<Object>}
     */
    async getPurchaseInvoice(packagePaymentId, token) {
        if (!packagePaymentId) {
            throw new ApiError('Payment ID is required to fetch invoice', 400);
        }
        if (!token) {
            throw new ApiError('Authentication token is required', 401);
        }

        const response = await apiClient.post(
            ENDPOINTS.PACKAGE_PURCHASE_INVOICE,
            { package_payment_id: packagePaymentId },
            { token }
        );

        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to retrieve invoice', 400, response);
        }

        const data = response?.data || response;

        return {
            payment_code: data.payment_code || '',
            package_name: data.package_name || 'Membership Plan',
            amount: Number(data.amount ?? 0),
            payment_status: data.payment_status || 'Due',
            custom_payment_name: data.custom_payment_name || data.payment_method || 'Bank Transfer',
            custom_payment_transaction_id: data.custom_payment_transaction_id || data.transaction_id || '',
            custom_payment_proof: normalizePackageImageUrl(data.custom_payment_proof || data.payment_proof),
            raw: data,
        };
    },

    /**
     * Alias for getPurchaseInvoice
     */
    async getPackageInvoice(packagePaymentId, token) {
        return this.getPurchaseInvoice(packagePaymentId, token);
    },
};

export default packageService;
