import apiClient, { ApiError } from "./apiClient";
import { ENDPOINTS } from "../config/api";

/**
 * Service for handling Ignored Users
 * Endpoints:
 * - List: GET /member/ignored-user-list?page=1
 * - Add: POST /member/add-to-ignore-list { user_id }
 * - Remove: POST /member/remove-from-ignored-list { user_id }
 */
const ignoreService = {
  /**
   * Get paginated ignored user list
   * @param {number|string} [page=1]
   * @param {string} token
   */
  async getIgnoredUsers(page = 1, token) {
    let p = 1;
    let t = null;
    if (typeof page === "string" && !token) {
      t = page;
      p = 1;
    } else {
      p = Number(page) || 1;
      t = token;
    }

    const endpoint = `${ENDPOINTS.IGNORED_USER_LIST}?page=${p}`;
    const response = await apiClient.get(endpoint, { token: t });
    if (response && response.result === false) {
      throw new ApiError(
        response.message || "Failed to fetch ignored users",
        400,
        response,
      );
    }
    return response;
  },

  /**
   * Add member to ignore list
   * @param {number|string} userId
   * @param {string} token
   */
  async addToIgnoreList(userId, token) {
    const id = Number(userId) || userId;
    const response = await apiClient.post(
      ENDPOINTS.ADD_TO_IGNORE_LIST,
      { user_id: id },
      { token },
    );
    if (response && response.result === false) {
      throw new ApiError(
        response.message || "Failed to add member to ignore list",
        400,
        response,
      );
    }
    return response;
  },

  /**
   * Remove member from ignore list
   * @param {number|string} userId
   * @param {string} token
   */
  async removeFromIgnoreList(userId, token) {
    const id = Number(userId) || userId;
    const response = await apiClient.post(
      ENDPOINTS.REMOVE_FROM_IGNORED_LIST,
      { user_id: id },
      { token },
    );
    if (response && response.result === false) {
      throw new ApiError(
        response.message || "Failed to remove member from ignore list",
        400,
        response,
      );
    }
    return response;
  },
};

export default ignoreService;
