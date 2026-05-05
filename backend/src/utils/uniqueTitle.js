const mongoose = require('mongoose');

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve a display title so it does not collide with existing docs in the same collection.
 * Uses family: exact `base`, or `base (1)`, `base (2)`, ...
 *
 * @param {import('mongoose').Model} Model
 * @param {string} baseTitle
 * @param {{ excludeId?: string|import('mongoose').Types.ObjectId, maxLength?: number|null }} [options]
 * @returns {Promise<string>}
 */
async function ensureUniqueTitle(Model, baseTitle, options = {}) {
  const { excludeId, maxLength = null } = options;
  const base = String(baseTitle == null ? '' : baseTitle).trim();
  if (!base) return base;

  const reBase = escapeRegex(base);
  const suffixRe = new RegExp(`^${reBase} \\((\\d+)\\)$`);

  const filter = {
    $or: [{ title: base }, { title: suffixRe }],
  };

  if (excludeId != null && mongoose.Types.ObjectId.isValid(String(excludeId))) {
    filter._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
  }

  const candidates = await Model.find(filter).select('title').lean();

  let maxN = -1;
  for (const doc of candidates) {
    const t = doc.title;
    if (t === base) maxN = Math.max(maxN, 0);
    else {
      const m = t.match(suffixRe);
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
  }

  const nextN = maxN + 1;
  let result = maxN < 0 ? base : `${base} (${nextN})`;

  if (maxLength && result.length > maxLength) {
    if (maxN < 0) {
      result = base.slice(0, maxLength);
    } else {
      const suffix = ` (${nextN})`;
      if (suffix.length >= maxLength) {
        result = suffix.slice(-maxLength);
      } else {
        let truncated = base.slice(0, maxLength - suffix.length).replace(/\s+$/, '');
        if (!truncated) truncated = base.slice(0, 1);
        result = `${truncated}${suffix}`.slice(0, maxLength);
      }
    }
  }

  return result;
}

module.exports = { escapeRegex, ensureUniqueTitle };
