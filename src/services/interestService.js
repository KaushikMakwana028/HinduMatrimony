import apiClient, { ApiError } from "./apiClient";
import { ENDPOINTS } from "../config/api";

/**
 * Service for handling Member Interests:
 * - Express Interest: POST /member/express-interest { user_id }
 * - Accept Interest: POST /member/interest-accept { interest_id }
 * - Reject Interest: POST /member/interest-reject { interest_id }
 * - Sent Interests: GET /member/my-interests?page=1
 * - Received Interests: GET /member/interest-requests?page=1
 */
const interestService = {
  /**
   * Express interest to another member
   * @param {number|string} userId
   * @param {string} token
   */
  async expressInterest(userId, token) {
    const id = Number(userId) || userId;
    const response = await apiClient.post(
      ENDPOINTS.EXPRESS_INTEREST,
      { user_id: id },
      { token },
    );

    if (response && response.result === false) {
      const msg = String(
        response.message ||
          "Please upgrade your package to express interest.",
      );
      const isUpgrade = /package|upgrade|premium|limit|free|exhaust/i.test(msg);
      const err = new ApiError(msg, isUpgrade ? 403 : 400, response);
      err.isUpgradeRequired = isUpgrade;
      throw err;
    }

    return response;
  },

  /**
   * Accept a received interest request
   * @param {number|string|object} target
   * @param {string} token
   */
  async acceptInterest(target, token) {
    let payload = {};
    if (typeof target === "object" && target !== null) {
      const interestId =
        Number(target.interest_id || target.interestId || target.id) ||
        target.interest_id ||
        target.id;
      const targetUserId =
        Number(target.user_id || target.userId) ||
        target.user_id ||
        target.userId;

      payload = {
        interest_id: interestId,
        id: interestId,
      };
      if (targetUserId) {
        payload.user_id = targetUserId;
      }
    } else {
      const id = Number(target) || target;
      payload = { interest_id: id, id };
    }

    const response = await apiClient.post(
      ENDPOINTS.INTEREST_ACCEPT,
      payload,
      { token },
    );

    if (response && response.result === false) {
      throw new ApiError(
        response.message || "Failed to accept interest request",
        400,
        response,
      );
    }

    return response;
  },

  /**
   * Reject a received interest request or withdraw a sent interest
   * @param {number|string|object} target
   * @param {string} token
   */
  async rejectInterest(target, token) {
    let payload = {};
    if (typeof target === "object" && target !== null) {
      const interestId =
        Number(target.interest_id || target.interestId || target.id) ||
        target.interest_id ||
        target.id;
      const targetUserId =
        Number(target.user_id || target.userId) ||
        target.user_id ||
        target.userId;

      payload = {
        interest_id: interestId,
        id: interestId,
      };
      if (targetUserId) {
        payload.user_id = targetUserId;
      }
    } else {
      const id = Number(target) || target;
      payload = { interest_id: id, id };
    }

    const response = await apiClient.post(
      ENDPOINTS.INTEREST_REJECT,
      payload,
      { token },
    );

    if (response && response.result === false) {
      throw new ApiError(
        response.message || "Failed to reject interest request",
        400,
        response,
      );
    }

    return response;
  },

  /**
   * Get received interest requests with pagination
   * @param {number|string} [page=1]
   * @param {string} token
   */
  async getReceivedInterests(page = 1, token) {
    let p = 1;
    let t = null;
    if (typeof page === "string" && !token) {
      t = page;
      p = 1;
    } else {
      p = Number(page) || 1;
      t = token;
    }

    const endpoint = `${ENDPOINTS.INTEREST_REQUESTS}?page=${p}`;
    const response = await apiClient.get(endpoint, { token: t });
    return response;
  },

  /**
   * Get sent interests with pagination
   * @param {number|string} [page=1]
   * @param {string} token
   */
  async getSentInterests(page = 1, token) {
    let p = 1;
    let t = null;
    if (typeof page === "string" && !token) {
      t = page;
      p = 1;
    } else {
      p = Number(page) || 1;
      t = token;
    }

    const endpoint = `${ENDPOINTS.MY_INTERESTS}?page=${p}`;
    const response = await apiClient.get(endpoint, { token: t });
    return response;
  },
};

export default interestService;
