import apiClient, { ApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

/**
 * Normalizes an image path to a full URL if relative
 */
export function normalizeStoryImageUrl(path) {
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
 * Normalizes a happy story object from API
 */
export function normalizeStoryData(data) {
    if (!data || typeof data !== 'object') return null;

    const rawPhoto = data.photos || data.photo || data.image || data.image_path || data.thumbnail || '';
    const photoUrl = normalizeStoryImageUrl(rawPhoto);

    return {
        id: data.id || null,
        title: data.title || '',
        details: data.details || data.story || data.description || '',
        partner_name: data.partner_name || data.partner || '',
        photos: photoUrl,
        post_date: data.post_date || data.created_at || null,
        approved: data.approved ?? data.status ?? null,
        raw: data,
    };
}

const happyStoryService = {
    /**
     * Check if the current member already has a Happy Story
     * GET https://hindumatrimony.org.in/api/member/check-happy-story
     *
     * @param {string} token
     * @returns {Promise<{ hasStory: boolean, story: Object|null }>}
     */
    async checkHappyStory(token) {
        if (!token) {
            return { hasStory: false, story: null };
        }

        try {
            const response = await apiClient.get(ENDPOINTS.MEMBER_CHECK_HAPPY_STORY, { token });

            if (!response) {
                return { hasStory: false, story: null };
            }

            // If backend returns explicit result: false
            if (response.result === false) {
                return { hasStory: false, story: null };
            }

            // Extract story object from possible wrapper structures
            const candidate = response.data || response.story || (response.id ? response : null);

            if (candidate && (candidate.title || candidate.partner_name || candidate.details || candidate.photos)) {
                return {
                    hasStory: true,
                    story: normalizeStoryData(candidate),
                };
            }

            return { hasStory: false, story: null };
        } catch (error) {
            // A 404 or not-found status is expected when the user hasn't created a story yet
            if (error.status === 404 || error.status === 400 || /not found/i.test(error.message)) {
                return { hasStory: false, story: null };
            }
            console.log('checkHappyStory notice:', error?.message);
            return { hasStory: false, story: null };
        }
    },

    /**
     * Store/Upload a new Happy Story
     * POST https://hindumatrimony.org.in/api/member/happy-story
     * Payload: (multipart/form-data)
     * - title: string (required, max:255)
     * - details: string (required)
     * - partner_name: string (required, max:255)
     * - photos: file (required)
     *
     * @param {Object} params
     * @param {string} params.title
     * @param {string} params.details
     * @param {string} params.partner_name
     * @param {Object} params.photoAsset - Object from ImagePicker ({ uri, fileName, mimeType })
     * @param {string} token
     */
    async storeHappyStory({ title, details, partner_name, photoAsset }, token) {
        if (!token) {
            throw new ApiError('Authentication token is required', 401);
        }

        const trimmedTitle = (title || '').trim();
        const trimmedPartner = (partner_name || '').trim();
        const trimmedDetails = (details || '').trim();

        if (!trimmedTitle) {
            throw new ApiError('Story title is required', 400);
        }
        if (trimmedTitle.length > 255) {
            throw new ApiError('Story title cannot exceed 255 characters', 400);
        }

        if (!trimmedPartner) {
            throw new ApiError('Partner name is required', 400);
        }
        if (trimmedPartner.length > 255) {
            throw new ApiError('Partner name cannot exceed 255 characters', 400);
        }

        if (!trimmedDetails) {
            throw new ApiError('Story details are required', 400);
        }

        if (!photoAsset || !photoAsset.uri) {
            throw new ApiError('A couple / wedding photo is required', 400);
        }

        const uri = photoAsset.uri;
        const uriParts = uri.split('/');
        const fileName = photoAsset.fileName || uriParts[uriParts.length - 1] || `happy_story_${Date.now()}.jpg`;

        let mimeType = photoAsset.mimeType;
        if (!mimeType) {
            const match = /\.(\w+)$/.exec(fileName);
            const ext = match ? match[1].toLowerCase() : 'jpg';
            mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        }

        const response = await apiClient.uploadFile(
            ENDPOINTS.MEMBER_HAPPY_STORY,
            {
                fileUri: uri,
                fieldName: 'photos',
                fileName,
                mimeType,
                parameters: {
                    title: trimmedTitle,
                    partner_name: trimmedPartner,
                    details: trimmedDetails,
                },
            },
            { token }
        );

        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to submit happy story', 400, response);
        }

        return response;
    },
};

export default happyStoryService;
