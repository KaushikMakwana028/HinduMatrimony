import apiClient, { ApiError } from "./apiClient";
import { ENDPOINTS } from "../config/api";
import profileService from "./profileService";

/**
 * Service for handling Active Members, Search Filters, and Member Settings
 */
const activeMemberService = {
  /**
   * Get member profile settings and active member configurations
   * @param {string} token
   */
  async getProfileSettings(token) {
    return profileService.getProfileSettings(token);
  },

  /**
   * List members in Active Members screen with server-side pagination
   * POST https://hindumatrimony.org.in/api/member/member-listing?page=1
   * @param {Object} payload (all fields optional: age_from, age_to, member_code, marital_status, religion_id, caste_id, sub_caste_id, mother_tongue, profession, country_id, state_id, city_id, min_height, max_height, member_type)
   * @param {number|string} [pageOrToken=1] Page number, or token if called as (payload, token)
   * @param {string} [maybeToken=null] Auth token when page is provided as second argument
   */
  async getMemberList(payload = {}, pageOrToken = 1, maybeToken = null) {
    let page = 1;
    let token = null;

    if (typeof pageOrToken === "string" && !maybeToken) {
      token = pageOrToken;
      page = 1;
    } else {
      page = Number(pageOrToken) || 1;
      token = maybeToken;
    }

    // Clean payload: omit undefined, null, or empty string values and format types
    const cleanPayload = {};
    if (payload && typeof payload === "object") {
      const numericKeys = [
        "age_from",
        "age_to",
        "marital_status",
        "religion_id",
        "caste_id",
        "sub_caste_id",
        "country_id",
        "state_id",
        "city_id",
        "min_height",
        "max_height",
        "member_type",
        "mother_tongue",
      ];

      Object.entries(payload).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          if (numericKeys.includes(key)) {
            const num = Number(val);
            if (!isNaN(num)) {
              cleanPayload[key] = num;
            }
          } else if (typeof val === "string") {
            const trimmed = val.trim();
            if (trimmed) {
              cleanPayload[key] = trimmed;
            }
          } else {
            cleanPayload[key] = val;
          }
        }
      });
    }

    const endpoint = `${ENDPOINTS.MEMBER_LISTING}?page=${page}`;

    // Only filter by religion when the user explicitly selects one.
    // Do not apply a default religion filter.

    const response = await apiClient.post(endpoint, cleanPayload, {
      token,
      timeout: 20000,
    });
    if (response && response.result === false) {
      const msg = String(response.message || "").toLowerCase();
      // Check for unverified email status
      if (
        response.status === "un_verified" ||
        msg.includes("not verified") ||
        msg.includes("unverified")
      ) {
        throw new ApiError(
          response.message || "Email is not verified!",
          403,
          response,
        );
      }
      // Gracefully handle empty search results without throwing
      if (
        msg.includes("no member") ||
        msg.includes("no data") ||
        msg.includes("not found") ||
        msg.includes("no record") ||
        msg.includes("empty")
      ) {
        return {
          result: true,
          data: [],
          total: 0,
          current_page: page,
          last_page: 1,
        };
      }
      throw new ApiError(
        response.message || "Failed to fetch member listing",
        400,
        response,
      );
    }
    return response;
  },

  /**
   * Express interest to a member
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
        response.message || "Please upgrade your package to express interest.",
      );
      const isUpgrade = /package|upgrade|premium|limit|free|exhaust/i.test(msg);
      const err = new ApiError(msg, isUpgrade ? 403 : 400, response);
      err.isUpgradeRequired = isUpgrade;
      throw err;
    }
    return response;
  },

  /**
   * Accept received interest
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
        response.message || "Failed to accept interest",
        400,
        response,
      );
    }
    return response;
  },

  /**
   * Reject received interest or withdraw sent interest
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
        response.message || "Failed to reject interest",
        400,
        response,
      );
    }
    return response;
  },

  /**
   * Get user's shortlisted profiles with server-side pagination
   * GET https://hindumatrimony.org.in/api/member/my-shortlists?page=1
   * @param {number|string} [pageOrToken=1] Page number, or auth token if called as (token)
   * @param {string} [maybeToken=null] Auth token when page is provided as first argument
   */
  async getMyShortlists(pageOrToken = 1, maybeToken = null) {
    let page = 1;
    let token = null;

    if (typeof pageOrToken === "string" && !maybeToken) {
      token = pageOrToken;
      page = 1;
    } else {
      page = Number(pageOrToken) || 1;
      token = maybeToken;
    }

    const endpoint = `${ENDPOINTS.MY_SHORTLISTS}?page=${page}`;
    return apiClient.get(endpoint, { token });
  },

  /**
   * Get user's expressed interests
   * @param {string} token
   */
  async getMyInterests(token) {
    try {
      const response = await apiClient.get("/member/my-interests", { token });
      return response;
    } catch {
      try {
        return await apiClient.get("/member/interest-requests", { token });
      } catch {
        return { result: false, data: [] };
      }
    }
  },

  /**
   * Add member to shortlist
   * @param {number|string} userId
   * @param {string} token
   */
  async addToShortlist(userId, token) {
    return apiClient.post(
      ENDPOINTS.ADD_TO_SHORTLIST,
      { user_id: userId },
      { token },
    );
  },

  /**
   * Remove member from shortlist
   * @param {number|string} userId
   * @param {string} token
   */
  async removeFromShortlist(userId, token) {
    return apiClient.post(
      ENDPOINTS.REMOVE_FROM_SHORTLIST,
      { user_id: userId },
      { token },
    );
  },

  /**
   * Get list of ignored users with server-side pagination
   * GET https://hindumatrimony.org.in/api/member/ignored-user-list?page=1
   * @param {number|string} [pageOrToken=1] Page number, or auth token if called as (token)
   * @param {string} [maybeToken=null] Auth token when page is provided as first argument
   */
  async getIgnoredUserList(pageOrToken = 1, maybeToken = null) {
    let page = 1;
    let token = null;

    if (typeof pageOrToken === "string" && !maybeToken) {
      token = pageOrToken;
      page = 1;
    } else {
      page = Number(pageOrToken) || 1;
      token = maybeToken;
    }

    const endpoint = `${ENDPOINTS.IGNORED_USER_LIST}?page=${page}`;
    return apiClient.get(endpoint, { token });
  },

  /**
   * Add member to ignore list
   * @param {number|string} userId
   * @param {string} token
   */
  async addToIgnoreList(userId, token) {
    return apiClient.post(
      ENDPOINTS.ADD_TO_IGNORE_LIST,
      { user_id: userId },
      { token },
    );
  },

  /**
   * Remove member from ignore list
   * @param {number|string} userId
   * @param {string} token
   */
  async removeFromIgnoreList(userId, token) {
    return apiClient.post(
      ENDPOINTS.REMOVE_FROM_IGNORED_LIST,
      { user_id: userId },
      { token },
    );
  },

  /**
   * Report an active member
   * @param {number|string} userId
   * @param {string} reason
   * @param {string} token
   */
  async reportMember(userId, reason = "Reported profile", token) {
    return apiClient.post(
      ENDPOINTS.REPORT_MEMBER,
      { user_id: userId, reason },
      { token },
    );
  },

  /**
   * Filter active members by Basic Info
   * @param {Object} data
   * @param {string} token
   */
  async filterByBasicInfo(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_BASIC_INFO_UPDATE, data, { token });
  },

  /**
   * Filter active members by Physical Attributes
   * @param {Object} data
   * @param {string} token
   */
  async filterByPhysical(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_PHYSICAL_ATTRIBUTES_UPDATE, data, {
      token,
    });
  },

  /**
   * Filter active members by Partner Expectations
   * @param {Object} data
   * @param {string} token
   */
  async filterByPartnerExpectation(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_PARTNER_EXPECTATION_UPDATE, data, {
      token,
    });
  },

  /**
   * Filter active members by Lifestyle
   * @param {Object} data
   * @param {string} token
   */
  async filterByLifestyle(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_LIFESTYLE_UPDATE, data, { token });
  },

  /**
   * Filter active members by Language
   * @param {Object} data
   * @param {string} token
   */
  async filterByLanguage(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_LANGUAGE_UPDATE, data, { token });
  },

  /**
   * Filter active members by Hobbies & Interests
   * @param {Object} data
   * @param {string} token
   */
  async filterByHobbies(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_HOBBIES_UPDATE, data, { token });
  },

  /**
   * Filter active members by Spiritual Background
   * @param {Object} data
   * @param {string} token
   */
  async filterBySpiritualBackground(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_SPIRITUAL_BACKGROUND_UPDATE, data, {
      token,
    });
  },

  /**
   * Filter active members by Address / Location
   * @param {Object} data
   * @param {string} token
   */
  async filterByAddress(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_ADDRESS_UPDATE, data, { token });
  },

  /**
   * Update introduction text
   * @param {Object} data
   * @param {string} token
   */
  async updateIntroduction(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_INTRODUCTION_UPDATE, data, {
      token,
    });
  },

  /**
   * Update education status
   * @param {Object} data
   * @param {string} token
   */
  async updateEducationStatus(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_EDUCATION_STATUS_UPDATE, data, {
      token,
    });
  },

  /**
   * Update career status
   * @param {Object} data
   * @param {string} token
   */
  async updateCareerStatus(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_CAREER_STATUS_UPDATE, data, {
      token,
    });
  },

  /**
   * Update attitude & behavior
   * @param {Object} data
   * @param {string} token
   */
  async updateAttitudeBehavior(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_ATTITUDE_BEHAVIOR_UPDATE, data, {
      token,
    });
  },

  /**
   * Update residency info
   * @param {Object} data
   * @param {string} token
   */
  async updateResidencyInfo(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_RESIDENCY_INFO_UPDATE, data, {
      token,
    });
  },

  /**
   * Update astronomic / kundli info
   * @param {Object} data
   * @param {string} token
   */
  async updateAstronomic(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_ASTRONOMIC_UPDATE, data, { token });
  },

  /**
   * Update family info
   * @param {Object} data
   * @param {string} token
   */
  async updateFamilyInfo(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_FAMILY_INFO_UPDATE, data, { token });
  },

  /**
   * Update contact info
   * @param {Object} data
   * @param {string} token
   */
  async updateContactInfo(data, token) {
    return apiClient.post(ENDPOINTS.MEMBER_CONTACT_INFO_UPDATE, data, {
      token,
    });
  },
};

export default activeMemberService;
