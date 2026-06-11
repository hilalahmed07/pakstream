const Client = require('ldapjs-client');
const ldapConfig = require('../config/ldapConfig');

/**
 * Verify a user's credentials against the configured LDAP server.
 *
 * @param {string} username  The user's username (sAMAccountName / uid)
 * @param {string} password  The plain-text password to verify
 * @returns {{ success: boolean, serverUnreachable?: boolean, error?: string }}
 */
async function authenticateWithLdap(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Username and password are required' };
  }

  const client = new Client({ url: ldapConfig.url });

  try {
    // Step 1: bind with admin/service account to search the directory
    await client.bind(ldapConfig.bindDN, ldapConfig.bindPassword);

    // Step 2: find the user's DN by searching with the configured filter
    const filter = ldapConfig.searchFilter.replace('{{username}}', username);
    const entries = await client.search(ldapConfig.baseDN, { filter });

    if (!entries || entries.length === 0) {
      return { success: false, error: 'User not found in directory' };
    }

    const userDN = entries[0].dn;

    // Step 3: re-bind as the user to verify their password
    await client.bind(userDN, password);

    return { success: true };

  } catch (err) {
    const msg = err.message || '';
    // Connection-level errors (ECONNREFUSED, ETIMEDOUT, etc.) — server is down
    if (
      msg.includes('ECONNREFUSED') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('connect') ||
      err.code === 'ECONNREFUSED'
    ) {
      console.warn('LDAP server unreachable:', msg);
      return { success: false, serverUnreachable: true, error: 'LDAP server unreachable' };
    }
    // Invalid credentials or other LDAP errors
    console.error('LDAP authentication error:', msg);
    return { success: false, error: 'Invalid credentials' };
  } finally {
    try { await client.unbind(); } catch (_) { /* ignore unbind errors */ }
  }
}

module.exports = { authenticateWithLdap };
