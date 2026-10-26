import AsyncStorage from "@react-native-async-storage/async-storage";
import { emitMemberAction, subscribeMemberAction } from "./memberEvents";
import apiClient from "./apiClient";
import { ENDPOINTS } from "../config/api";

const CACHE_STORAGE_KEY = "@hm_member_state_cache_v5";
const CACHE_MEMBERS_FEED_KEY = "@hm_active_members_feed";

class MemberStateService {
  constructor() {
    // Lookups by identifier (numeric ID, code, or HM- formatted)
    this.statusMap = {}; // id/code -> "Accepted" | "Pending" | "Rejected"
    this.interestSentMap = {}; // id/code -> boolean
    this.shortlistMap = {}; // id/code -> boolean
    this.ignoredMap = {}; // id/code -> boolean
    this.planMap = {}; // id/code -> "Premium" | "Free"
    this.codeMap = {}; // id -> canonical code string (e.g. 7477 -> "2026107477")
    this.idMap = {}; // code -> primary id (e.g. "2026107477" -> 7477)
    this.initialized = false;
    this.initPromise = null;

    // Listen to global member action bus
    subscribeMemberAction((event) => {
      if (!event) return;
      const uid = event.userId || event.targetMemberId;
      if (!this._isValidKey(uid)) return;

      if (event.type === "interest_status") {
        if (event.status) {
          this._setRecord(this.statusMap, uid, event.status);
          if (event.status === "Accepted") {
            this._setRecord(this.interestSentMap, uid, true);
          } else if (event.status === "Rejected") {
            this._deleteRecord(this.interestSentMap, uid);
          }
        } else {
          this._deleteRecord(this.statusMap, uid);
          this._deleteRecord(this.interestSentMap, uid);
        }
        this._persist();
      } else if (event.type === "interest") {
        this._setRecord(this.interestSentMap, uid, Boolean(event.value));
        if (!event.value) {
          this._deleteRecord(this.statusMap, uid);
        }
        this._persist();
      } else if (event.type === "shortlist") {
        this._setRecord(this.shortlistMap, uid, Boolean(event.value));
        this._persist();
      } else if (event.type === "ignore") {
        this._setRecord(this.ignoredMap, uid, Boolean(event.value));
        this._persist();
      }
    });
  }

  /**
   * Initialize state from AsyncStorage and pre-seed from active members feed
   */
  async init(token = null) {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // Clean up legacy corrupted cache keys if present
        try {
          await AsyncStorage.multiRemove([
            "@hm_member_state_cache_v1",
            "@hm_member_state_cache_v2",
            "@hm_member_state_cache_v3",
            "@hm_member_state_cache_v4",
            CACHE_MEMBERS_FEED_KEY,
          ]);
        } catch {}

        // 1. Load persisted member state cache
        const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            Object.assign(this.statusMap, parsed.statusMap || {});
            Object.assign(this.interestSentMap, parsed.interestSentMap || {});
            Object.assign(this.shortlistMap, parsed.shortlistMap || {});
            Object.assign(this.ignoredMap, parsed.ignoredMap || {});
            Object.assign(this.planMap, parsed.planMap || {});
            Object.assign(this.codeMap, parsed.codeMap || {});
            Object.assign(this.idMap, parsed.idMap || {});
          }
        }

        // 2. Pre-seed plans and codes from active members feed cache
        const feedRaw = await AsyncStorage.getItem(CACHE_MEMBERS_FEED_KEY);
        if (feedRaw) {
          try {
            const feedParsed = JSON.parse(feedRaw);
            const list = Array.isArray(feedParsed)
              ? feedParsed
              : feedParsed?.members || [];
            if (Array.isArray(list)) {
              this.registerMembers(list);
            }
          } catch {}
        }

        // 3. If token provided, sync latest interests in background
        if (token) {
          this.syncInterestsFromApi(token).catch(() => {});
        }

        this.initialized = true;
      } catch (err) {
        console.log("MemberStateService init error:", err?.message);
        this.initialized = true;
      }
    })();

    return this.initPromise;
  }

  /**
   * Internal helper to persist state to AsyncStorage
   */
  async _persist() {
    try {
      const payload = {
        statusMap: this.statusMap,
        interestSentMap: this.interestSentMap,
        shortlistMap: this.shortlistMap,
        ignoredMap: this.ignoredMap,
        planMap: this.planMap,
        codeMap: this.codeMap,
        idMap: this.idMap,
      };
      await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }

  /**
   * Validates if a key is a valid non-empty member identifier
   */
  _isValidKey(key) {
    if (key === undefined || key === null) return false;
    const s = String(key).trim();
    if (!s || s === "null" || s === "undefined") return false;
    if (s.startsWith("member_")) return false; // generated index fallback, not a real member ID
    return true;
  }

  /**
   * Sets value across all known identifier aliases for a member
   */
  _setRecord(targetMap, key, value) {
    if (!this._isValidKey(key)) return;
    const sKey = String(key).trim();
    targetMap[sKey] = value;

    // Set for mapped code if available
    const mappedCode = this.codeMap[sKey];
    if (mappedCode && mappedCode !== sKey && this._isValidKey(mappedCode)) {
      targetMap[mappedCode] = value;
    }

    // Set for mapped ID if available
    const mappedId = this.idMap[sKey];
    if (mappedId && String(mappedId) !== sKey && this._isValidKey(mappedId)) {
      targetMap[String(mappedId)] = value;
    }

    // Link "HM-" formatted variation safely (only for strictly numeric or strictly HM- numeric IDs)
    if (sKey.toUpperCase().startsWith("HM-")) {
      const numPart = sKey.slice(3).trim();
      if (numPart && /^\d+$/.test(numPart)) {
        targetMap[numPart] = value;
      }
    } else if (/^\d+$/.test(sKey)) {
      targetMap[`HM-${sKey}`] = value;
    }
  }

  _deleteRecord(targetMap, key) {
    if (!this._isValidKey(key)) return;
    const sKey = String(key).trim();
    delete targetMap[sKey];

    const mappedCode = this.codeMap[sKey];
    if (mappedCode) delete targetMap[mappedCode];

    const mappedId = this.idMap[sKey];
    if (mappedId) delete targetMap[String(mappedId)];

    if (sKey.toUpperCase().startsWith("HM-")) {
      const numPart = sKey.slice(3).trim();
      if (numPart && /^\d+$/.test(numPart)) {
        delete targetMap[numPart];
      }
    } else if (/^\d+$/.test(sKey)) {
      delete targetMap[`HM-${sKey}`];
    }
  }

  _getRecord(targetMap, key) {
    if (!this._isValidKey(key)) return undefined;
    const sKey = String(key).trim();
    if (targetMap[sKey] !== undefined) return targetMap[sKey];

    const mappedCode = this.codeMap[sKey];
    if (mappedCode && targetMap[mappedCode] !== undefined) {
      return targetMap[mappedCode];
    }

    const mappedId = this.idMap[sKey];
    if (mappedId && targetMap[String(mappedId)] !== undefined) {
      return targetMap[String(mappedId)];
    }

    if (sKey.toUpperCase().startsWith("HM-")) {
      const numPart = sKey.slice(3).trim();
      if (numPart && targetMap[numPart] !== undefined) {
        return targetMap[numPart];
      }
    } else if (/^\d+$/.test(sKey)) {
      if (targetMap[`HM-${sKey}`] !== undefined) {
        return targetMap[`HM-${sKey}`];
      }
    }

    return undefined;
  }

  /**
   * Register a member profile, establishing ID <-> Code aliases and caching plan
   * @param {Object} member
   */
  registerMember(member) {
    if (!member || typeof member !== "object") return;

    let userObj = member.user;
    if (typeof userObj === "string") {
      try {
        userObj = JSON.parse(userObj);
      } catch {}
    }
    if (!userObj || typeof userObj !== "object") userObj = null;

    const id =
      member.id ||
      member.user_id ||
      member.userId ||
      userObj?.id ||
      null;

    const code = String(
      member.code ||
        member.member_code ||
        member.memberId ||
        userObj?.code ||
        userObj?.member_code ||
        "",
    ).trim();

    if (id && this._isValidKey(id)) {
      const sId = String(id).trim();
      if (code && this._isValidKey(code)) {
        this.codeMap[sId] = code;
        this.idMap[code] = sId;
      }
    }

    // Resolve and register membership plan (Free vs Premium)
    const plan = this.resolvePlan(member);
    if (plan === "Premium") {
      if (id && this._isValidKey(id)) this._setRecord(this.planMap, id, "Premium");
      if (code && this._isValidKey(code)) this._setRecord(this.planMap, code, "Premium");
    }

    // Register shortlist flag if present
    if (member.shortlisted || member.is_shortlisted) {
      if (id && this._isValidKey(id)) this._setRecord(this.shortlistMap, id, true);
      if (code && this._isValidKey(code)) this._setRecord(this.shortlistMap, code, true);
    }

    // NOTE: Interest status is intentionally NOT registered in registerMember()!
    // Public member listings (/member/member-listing) contain public directory records,
    // not user-specific interest interaction states.
    // Interest status is strictly managed by authentic interest APIs:
    // /member/my-interests, /member/interest-requests, or explicit user actions.
  }

  /**
   * Batch register multiple members
   */
  registerMembers(members = []) {
    if (!Array.isArray(members)) return;
    members.forEach((m) => this.registerMember(m));
    this._persist();
  }

  /**
   * Safely resolves membership plan ("Premium" vs "Free") from any member object
   * Inspects all direct fields, nested user relations, and the central registry.
   */
  resolvePlan(item) {
    if (!item) return "Free";

    let userObj = item.user;
    if (typeof userObj === "string") {
      try {
        userObj = JSON.parse(userObj);
      } catch {}
    }
    if (!userObj || typeof userObj !== "object") userObj = null;

    // 1. Textual package checks
    const candidates = [
      item.package_name,
      userObj?.package_name,
      item.package?.name,
      userObj?.package?.name,
      item.current_package_name,
      userObj?.current_package_name,
      item.current_package_info?.package_name,
      userObj?.current_package_info?.package_name,
      item.package_info?.package_name,
      userObj?.package_info?.package_name,
      item.member_plan,
      userObj?.member_plan,
      item.plan,
      userObj?.plan,
      typeof item.package === "string" ? item.package : "",
      typeof userObj?.package === "string" ? userObj?.package : "",
    ];

    for (const c of candidates) {
      if (!c) continue;
      const str = String(c).trim().toLowerCase();
      if (str.includes("free")) {
        // Continue to check if another explicit paid field overrides
        continue;
      }
      if (
        str.includes("premium") ||
        str.includes("gold") ||
        str.includes("silver") ||
        str.includes("platinum") ||
        str.includes("vip") ||
        str.includes("diamond") ||
        str.includes("pro") ||
        str.includes("paid")
      ) {
        return "Premium";
      }
    }

    // 2. Numeric package_id (> 1 means paid/premium package)
    const pkgIds = [
      item.package_id,
      userObj?.package_id,
      item.current_package_id,
      userObj?.current_package_id,
      item.package?.id,
      userObj?.package?.id,
    ];
    for (const pid of pkgIds) {
      const num = Number(pid);
      if (Number.isFinite(num) && num > 1) {
        return "Premium";
      }
    }

    // 3. Membership status (>= 2 is paid/premium)
    const memVals = [
      item.membership,
      userObj?.membership,
      item.membership_type,
      userObj?.membership_type,
      item.member_type,
      userObj?.member_type,
    ];
    for (const m of memVals) {
      const num = Number(m);
      if (Number.isFinite(num) && num >= 2) {
        return "Premium";
      }
    }

    // 4. Boolean or flag checks
    if (
      item.is_premium === true ||
      item.is_premium === 1 ||
      item.is_premium === "1" ||
      userObj?.is_premium === true ||
      userObj?.is_premium === 1 ||
      userObj?.is_premium === "1"
    ) {
      return "Premium";
    }

    // 5. Look up in central state registry
    const id = item.id || item.user_id || item.userId || userObj?.id;
    const code = item.code || item.member_code || item.memberId || userObj?.code;
    if (id && this._getRecord(this.planMap, id) === "Premium") {
      return "Premium";
    }
    if (code && this._getRecord(this.planMap, code) === "Premium") {
      return "Premium";
    }

    return "Free";
  }

  /**
   * Resolves canonical member code string (e.g. "2026107477")
   */
  resolveMemberCode(item) {
    if (!item) return "";
    let userObj = item.user;
    if (typeof userObj === "string") {
      try {
        userObj = JSON.parse(userObj);
      } catch {}
    }
    if (!userObj || typeof userObj !== "object") userObj = null;

    const directCode = String(
      item.code ||
        item.member_code ||
        userObj?.code ||
        userObj?.member_code ||
        "",
    ).trim();

    if (directCode && directCode !== "null" && directCode !== "undefined") {
      return directCode;
    }

    const id = item.id || item.user_id || item.userId || userObj?.id;
    if (id) {
      const mapped = this._getRecord(this.codeMap, id);
      if (mapped) return mapped;
    }

    if (item.memberId && String(item.memberId).trim()) {
      return String(item.memberId).trim();
    }

    return id ? `HM-${id}` : "";
  }

  /**
   * Returns interest status: "Accepted" | "Pending" | "Rejected" | null
   */
  getInterestStatus(idOrCode) {
    if (!idOrCode) return null;
    return this._getRecord(this.statusMap, idOrCode) || null;
  }

  /**
   * Returns true if interest with this member is accepted
   */
  isInterestAccepted(idOrCode) {
    return this.getInterestStatus(idOrCode) === "Accepted";
  }

  /**
   * Returns true if interest was sent or accepted
   */
  isInterestSent(idOrCode) {
    if (!idOrCode) return false;
    if (this.isInterestAccepted(idOrCode)) return true;
    return Boolean(this._getRecord(this.interestSentMap, idOrCode));
  }

  /**
   * Returns true if member is shortlisted
   */
  isShortlisted(idOrCode) {
    if (!idOrCode) return false;
    return Boolean(this._getRecord(this.shortlistMap, idOrCode));
  }

  /**
   * Returns true if member is ignored
   */
  isIgnored(idOrCode) {
    if (!idOrCode) return false;
    return Boolean(this._getRecord(this.ignoredMap, idOrCode));
  }

  /**
   * Returns registered plan: "Premium" | "Free"
   */
  getPlan(idOrCode) {
    if (!idOrCode) return "Free";
    return this._getRecord(this.planMap, idOrCode) || "Free";
  }

  /**
   * Update interest status and emit event
   */
  setInterestStatus(idOrCode, status) {
    if (!idOrCode) return;
    if (status) {
      this._setRecord(this.statusMap, idOrCode, status);
      if (status === "Accepted") {
        this._setRecord(this.interestSentMap, idOrCode, true);
      } else if (status === "Rejected") {
        this._deleteRecord(this.interestSentMap, idOrCode);
      }
    } else {
      this._deleteRecord(this.statusMap, idOrCode);
      this._deleteRecord(this.interestSentMap, idOrCode);
    }
    this._persist();

    emitMemberAction({
      userId: idOrCode,
      type: "interest_status",
      status: status || null,
    });
    if (status === "Rejected" || !status) {
      emitMemberAction({
        userId: idOrCode,
        type: "interest",
        value: false,
      });
    }
  }

  /**
   * Update interest sent flag and emit event
   */
  setInterestSent(idOrCode, isSent) {
    if (!idOrCode) return;
    if (isSent) {
      this._setRecord(this.interestSentMap, idOrCode, true);
      if (!this._getRecord(this.statusMap, idOrCode)) {
        this._setRecord(this.statusMap, idOrCode, "Pending");
      }
    } else {
      this._deleteRecord(this.interestSentMap, idOrCode);
      this._deleteRecord(this.statusMap, idOrCode);
    }
    this._persist();

    emitMemberAction({
      userId: idOrCode,
      type: "interest",
      value: Boolean(isSent),
    });
  }

  /**
   * Update shortlist flag and emit event
   */
  setShortlisted(idOrCode, isShortlisted) {
    if (!idOrCode) return;
    this._setRecord(this.shortlistMap, idOrCode, Boolean(isShortlisted));
    this._persist();

    emitMemberAction({
      userId: idOrCode,
      type: "shortlist",
      value: Boolean(isShortlisted),
    });
  }

  /**
   * Syncs raw interest items from API response (sent or received)
   */
  syncInterestItems(rawList = [], options = {}) {
    if (!Array.isArray(rawList)) return;

    const currentUserId = options.currentUserId ? String(options.currentUserId) : null;

    rawList.forEach((item) => {
      if (!item || typeof item !== "object") return;
      this.registerMember(item);

      let userObj = item.user;
      if (typeof userObj === "string") {
        try {
          userObj = JSON.parse(userObj);
        } catch {}
      }
      if (!userObj || typeof userObj !== "object") userObj = null;

      // In express_interests: target user must NOT be the logged-in user
      let id = null;
      if (userObj?.id && String(userObj.id) !== currentUserId) {
        id = userObj.id;
      } else if (item.interested_to && String(item.interested_to) !== currentUserId) {
        id = item.interested_to;
      } else if (item.interested_by && String(item.interested_by) !== currentUserId) {
        id = item.interested_by;
      } else if (item.user_id && String(item.user_id) !== currentUserId) {
        id = item.user_id;
      }

      const code = String(
        item.code ||
          item.member_code ||
          userObj?.code ||
          userObj?.member_code ||
          "",
      ).trim();

      const rawStatus = String(
        item.status ||
          item.interest_status ||
          item.approval_status ||
          item.status_text ||
          "",
      ).toLowerCase().trim();

      // Check rejection FIRST!
      let status = "Pending";
      if (
        rawStatus.includes("reject") ||
        rawStatus.includes("decline") ||
        rawStatus === "2" ||
        item.status === 2 ||
        item.interest_status === 2
      ) {
        status = "Rejected";
      } else if (
        rawStatus.includes("accept") ||
        rawStatus.includes("approv") ||
        rawStatus === "1" ||
        item.status === 1 ||
        item.interest_status === 1
      ) {
        status = "Accepted";
      }

      if (id && this._isValidKey(id)) {
        this._setRecord(this.statusMap, id, status);
        if (status === "Rejected") {
          this._deleteRecord(this.interestSentMap, id);
        } else {
          this._setRecord(this.interestSentMap, id, true);
        }
      }
      if (code && this._isValidKey(code)) {
        this._setRecord(this.statusMap, code, status);
        if (status === "Rejected") {
          this._deleteRecord(this.interestSentMap, code);
        } else {
          this._setRecord(this.interestSentMap, code, true);
        }
      }
    });

    this._persist();
  }

  /**
   * Quietly fetch both sent and received interests from backend to ensure cross-screen sync.
   * Replaces statusMap and interestSentMap with authentic server state to purge stale data.
   */
  async syncInterestsFromApi(token, currentUserId = null) {
    if (!token) return;
    try {
      const [sentRes, receivedRes] = await Promise.allSettled([
        apiClient.get(`${ENDPOINTS.MY_INTERESTS}?page=1`, { token }),
        apiClient.get(`${ENDPOINTS.INTEREST_REQUESTS}?page=1`, { token }),
      ]);

      const newStatusMap = {};
      const newInterestSentMap = {};

      const processList = (list) => {
        if (!Array.isArray(list)) return;
        list.forEach((item) => {
          if (!item || typeof item !== "object") return;
          this.registerMember(item);

          let userObj = item.user;
          if (typeof userObj === "string") {
            try {
              userObj = JSON.parse(userObj);
            } catch {}
          }
          if (!userObj || typeof userObj !== "object") userObj = null;

          const uid = currentUserId ? String(currentUserId) : null;
          let id = null;
          if (userObj?.id && String(userObj.id) !== uid) {
            id = userObj.id;
          } else if (item.interested_to && String(item.interested_to) !== uid) {
            id = item.interested_to;
          } else if (item.interested_by && String(item.interested_by) !== uid) {
            id = item.interested_by;
          } else if (item.user_id && String(item.user_id) !== uid) {
            id = item.user_id;
          }

          const code = String(
            item.code ||
              item.member_code ||
              userObj?.code ||
              userObj?.member_code ||
              "",
          ).trim();

          const rawStatus = String(
            item.status ||
              item.interest_status ||
              item.approval_status ||
              item.status_text ||
              "",
          ).toLowerCase().trim();

          let status = "Pending";
          if (
            rawStatus.includes("reject") ||
            rawStatus.includes("decline") ||
            rawStatus === "2" ||
            item.status === 2 ||
            item.interest_status === 2
          ) {
            status = "Rejected";
          } else if (
            rawStatus.includes("accept") ||
            rawStatus.includes("approv") ||
            rawStatus === "1" ||
            item.status === 1 ||
            item.interest_status === 1
          ) {
            status = "Accepted";
          }

          if (id && this._isValidKey(id)) {
            this._setRecord(newStatusMap, id, status);
            if (status !== "Rejected") {
              this._setRecord(newInterestSentMap, id, true);
            }
          }
          if (code && this._isValidKey(code)) {
            this._setRecord(newStatusMap, code, status);
            if (status !== "Rejected") {
              this._setRecord(newInterestSentMap, code, true);
            }
          }
        });
      };

      let gotData = false;
      if (sentRes.status === "fulfilled" && sentRes.value?.data) {
        const list = Array.isArray(sentRes.value.data)
          ? sentRes.value.data
          : sentRes.value.data?.data || [];
        processList(list);
        gotData = true;
      }

      if (receivedRes.status === "fulfilled" && receivedRes.value?.data) {
        const list = Array.isArray(receivedRes.value.data)
          ? receivedRes.value.data
          : receivedRes.value.data?.data || [];
        processList(list);
        gotData = true;
      }

      if (gotData) {
        this.statusMap = newStatusMap;
        this.interestSentMap = newInterestSentMap;
        this._persist();
      }
    } catch {}
  }
}

const memberStateService = new MemberStateService();
export default memberStateService;
