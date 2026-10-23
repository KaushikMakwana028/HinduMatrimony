import apiClient, { ApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

/**
 * Normalizes an image path to a full URL if relative
 */
export function normalizeImageUrl(path) {
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
 * Normalizes an image object from API response
 */
export function normalizeGalleryItem(item) {
    if (!item) return null;
    const id = item.id ?? item.gallery_id ?? item.image_id;
    const rawPath = item.image_path || item.image || item.url || item.photo || item.file_path || '';
    const image_path = normalizeImageUrl(rawPath);

    return {
        id,
        image_path,
        raw: item,
        created_at: item.created_at || null,
    };
}

const galleryService = {
    /**
     * Display/List own gallery images
     * GET https://hindumatrimony.org.in/api/member/gallery-image
     */
    async getGalleryImages(token) {
        if (!token) {
            throw new ApiError('Authentication token is required', 401);
        }

        const response = await apiClient.get(ENDPOINTS.MEMBER_GALLERY_IMAGE, { token });

        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to fetch gallery images', 400, response);
        }

        // Response may be { data: [...] } or direct array [...] or { result: true, data: [...] }
        const rawList = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
                ? response.data
                : [];

        return rawList.map(normalizeGalleryItem).filter((item) => item && item.image_path);
    },

    /**
     * Store/Upload a new gallery image
     * POST https://hindumatrimony.org.in/api/member/gallery-image
     * Payload: multipart/form-data with field `gallery_image`
     *
     * @param {Object} asset - Object from ImagePicker ({ uri, fileName, mimeType })
     * @param {string} token - User auth token
     */
    async uploadGalleryImage(asset, token) {
        if (!asset || !asset.uri) {
            throw new ApiError('A valid image file is required for upload', 400);
        }
        if (!token) {
            throw new ApiError('Authentication token is required', 401);
        }

        const uri = asset.uri;
        const uriParts = uri.split('/');
        const fileName = asset.fileName || uriParts[uriParts.length - 1] || `gallery_${Date.now()}.jpg`;

        let mimeType = asset.mimeType;
        if (!mimeType) {
            const match = /\.(\w+)$/.exec(fileName);
            const ext = match ? match[1].toLowerCase() : 'jpg';
            mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        }

        const response = await apiClient.uploadFile(
            ENDPOINTS.MEMBER_GALLERY_IMAGE,
            {
                fileUri: uri,
                fieldName: 'gallery_image',
                fileName,
                mimeType,
            },
            { token }
        );

        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to upload gallery image', 400, response);
        }

        return response;
    },

    /**
     * Delete own gallery image
     * DELETE https://hindumatrimony.org.in/api/member/gallery-image/{id}
     *
     * @param {string|number} id - Gallery image ID
     * @param {string} token - User auth token
     */
    async deleteGalleryImage(id, token) {
        if (!id) {
            throw new ApiError('Image ID is required to delete', 400);
        }
        if (!token) {
            throw new ApiError('Authentication token is required', 401);
        }

        const endpoint = typeof ENDPOINTS.DELETE_GALLERY_IMAGE === 'function'
            ? ENDPOINTS.DELETE_GALLERY_IMAGE(id)
            : `/member/gallery-image/${id}`;

        const response = await apiClient.delete(endpoint, { token });

        if (response && response.result === false) {
            throw new ApiError(response.message || 'Failed to delete gallery image', 400, response);
        }

        return response;
    },

    /**
     * Replace/Edit an existing gallery image
     * Uploads the replacement image, then removes the old image upon successful upload.
     *
     * @param {string|number} oldImageId - Existing image ID
     * @param {Object} newAsset - New asset from ImagePicker
     * @param {string} token - User auth token
     */
    async replaceGalleryImage(oldImageId, newAsset, token) {
        // Step 1: Upload the new image
        const uploadResult = await this.uploadGalleryImage(newAsset, token);

        // Step 2: If successfully uploaded and oldImageId exists, delete old image
        if (oldImageId) {
            try {
                await this.deleteGalleryImage(oldImageId, token);
            } catch (delErr) {
                console.warn('New image uploaded, but failed to delete old image:', delErr?.message);
            }
        }

        return uploadResult;
    },
};

export default galleryService;
