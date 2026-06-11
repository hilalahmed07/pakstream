// LDAP configuration — all values are read from environment variables.
// Set LDAP_ENABLED=true in .env to activate LDAP authentication.
module.exports = {
  enabled: process.env.LDAP_ENABLED === 'true',
  url: process.env.LDAP_URL || 'ldap://your-ldap-server.com',
  baseDN: process.env.LDAP_BASE_DN || 'dc=example,dc=com',
  bindDN: process.env.LDAP_BIND_DN || 'cn=admin,dc=example,dc=com',
  bindPassword: process.env.LDAP_BIND_PASSWORD || '',
  // {{username}} is replaced with the user's username at runtime.
  // For Windows Active Directory use: (sAMAccountName={{username}})
  // For OpenLDAP use:                 (uid={{username}})
  searchFilter: process.env.LDAP_SEARCH_FILTER || '(sAMAccountName={{username}})',
  // When true and the LDAP server is unreachable, fall back to local password
  // auth so the system stays accessible during an LDAP outage.
  fallbackToLocal: process.env.LDAP_FALLBACK !== 'false',
};
