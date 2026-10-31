/**
 * Local SQLite Agent Service
 * 
 * Communicates with the local sync daemon running on the user's PC (http://127.0.0.1:41732).
 * When the local PC is online, this service retrieves confidential IP details that were
 * scrubbed from the cloud database after the 36-hour retention policy.
 */

const LOCAL_AGENT_URL = 'http://127.0.0.1:41732';
const TIMEOUT_MS = 2000;

export const localAgent = {
  /**
   * Check if the local PC sync daemon is running and accessible
   */
  async checkStatus() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`${LOCAL_AGENT_URL}/api/local/status`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) return { online: false };
      const data = await res.json();
      return { online: true, ...data };
    } catch {
      return { online: false };
    }
  },

  /**
   * Fetch all records stored in the local SQLite database
   */
  async getLocalRecords() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS + 2000);

      const res = await fetch(`${LOCAL_AGENT_URL}/api/local/records`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.records) ? data.records : [];
    } catch (err) {
      console.warn('Could not fetch local SQLite records:', err.message);
      return [];
    }
  },

  /**
   * Fetch a single site's full technical IP details from local SQLite
   */
  async getLocalRecord(identifier) {
    if (!identifier) return null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`${LOCAL_AGENT_URL}/api/local/record/${encodeURIComponent(identifier)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const data = await res.json();
      return data.record || null;
    } catch (err) {
      console.warn(`Could not fetch local record for ${identifier}:`, err.message);
      return null;
    }
  },

  /**
   * Trigger local admin IP purge for an eligible site (>= 36h)
   */
  async purgeLocalIps(identifier) {
    const res = await fetch(`${LOCAL_AGENT_URL}/api/local/purge-ips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to purge local IPs');
    return data;
  }
};
