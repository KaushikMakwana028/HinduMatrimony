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

const packageService = {
    /**
     * Get list of available packages/plans
     * GET https://hindumatrimony.org.in/api/home/packages
     *
     * @param {string} [token]
     * @returns {Promise<Array>}
     */
    async getPackages(token = null) {
        const response = await apiClient.get(ENDPOINTS.PACKAGES_LIST, { token });

        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to load membership packages', 400, response);
        }

        const rawList = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
                ? response.data
                : [];

        return rawList.map((pkg) => ({
            id: pkg.id,
            name: pkg.name || 'Membership Plan',
            price: Number(pkg.price ?? 0),
            image: normalizePackageImageUrl(pkg.image),
            express_interest: pkg.express_interest ?? 0,
            photo_gallery: pkg.photo_gallery ?? 0,
            contact: pkg.contact ?? 0,
            profile_view: pkg.profile_view ?? 0,
            validity: pkg.validity ?? 30,
            auto_profile_match: Boolean(pkg.auto_profile_match),
            raw: pkg,
        }));
    },

    /**
     * Purchase a package via manual payment
     * POST https://hindumatrimony.org.in/api/member/package-purchase
     * Payload: (multipart/form-data)
     * - package_id: 1
     * - amount: 999
     * - payment_method: manual_payment
     * - manual_payment_id: 2
     * - transaction_id: "TXN123456"
     * - payment_details: "Paid via bank transfer"
     * - payment_proof: file
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
            manual_payment_id = 2,
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
        const fileName = payment_proof.fileName || uriParts[uriParts.length - 1] || `payment_proof_${Date.now()}.jpg`;

        let mimeType = payment_proof.mimeType;
        if (!mimeType) {
            const match = /\.(\w+)$/.exec(fileName);
            const ext = match ? match[1].toLowerCase() : 'jpg';
            mimeType = ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg';
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
