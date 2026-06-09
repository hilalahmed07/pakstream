// Asset validation utilities for presentations, documents, videos, and patches

// Common validation patterns
export const TITLE_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9\s]+$/;
export const DESCRIPTION_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9\s]+$/;
export const TAGS_REGEX = /^[A-Za-z0-9\s,]+$/;
export const SINGLE_TAG_REGEX = /^[A-Za-z0-9]+$/;
export const MIN_TAG_LENGTH = 3;
export const MAX_TAG_LENGTH = 5;
export const MAX_TAGS = 3;

// File type validations
export const VIDEO_FILE_TYPES = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'];
export const PRESENTATION_FILE_TYPES = ['ppt', 'pptx'];
export const DOCUMENT_FILE_TYPES = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
export const PATCH_FILE_TYPES = ['exe', 'msi', 'msu', 'cab', 'def', 'zip', 'rar', '7z'];

// File size limits (in bytes)
export const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
export const MAX_PRESENTATION_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_PATCH_SIZE = 500 * 1024 * 1024; // 500MB
export const MAX_ASSET_TITLE_LENGTH = 90;
export const MAX_ASSET_DESCRIPTION_LENGTH = 180;
export const MAX_PRESENTATION_TITLE_LENGTH = MAX_ASSET_TITLE_LENGTH;
export const MAX_PRESENTATION_DESCRIPTION_LENGTH = MAX_ASSET_DESCRIPTION_LENGTH;
export const MAX_PRESENTATION_TAGS = MAX_TAGS;
export const MAX_DOCUMENT_TITLE_LENGTH = MAX_ASSET_TITLE_LENGTH;
export const MAX_DOCUMENT_DESCRIPTION_LENGTH = MAX_ASSET_DESCRIPTION_LENGTH;
export const MAX_DOCUMENT_TAGS = MAX_TAGS;
export const MAX_PATCH_TITLE_LENGTH = 40;

// Validation messages
export const TITLE_MESSAGE = `Title must contain at least one letter, use only letters, numbers, and spaces, and be ${MAX_ASSET_TITLE_LENGTH} characters or fewer.`;
export const DESCRIPTION_MESSAGE = `Description must contain at least one letter, use only letters, numbers, and spaces, and be ${MAX_ASSET_DESCRIPTION_LENGTH} characters or fewer.`;
export const TAGS_MESSAGE = `Tags must be letters/numbers only, ${MIN_TAG_LENGTH}–${MAX_TAG_LENGTH} characters each, and at most ${MAX_TAGS} tags (comma-separated).`;
export const PRESENTATION_TITLE_MESSAGE = `Title must contain at least one letter, use only letters, numbers, and spaces, and be ${MAX_PRESENTATION_TITLE_LENGTH} characters or fewer.`;
export const PRESENTATION_DESCRIPTION_MESSAGE = `Description must contain at least one letter, use only letters, numbers, and spaces, and be ${MAX_PRESENTATION_DESCRIPTION_LENGTH} characters or fewer.`;
export const PRESENTATION_TAGS_MESSAGE = `Tags must be letters/numbers only, ${MIN_TAG_LENGTH}–${MAX_TAG_LENGTH} characters each, max ${MAX_PRESENTATION_TAGS} tags.`;
export const DOCUMENT_TITLE_MESSAGE = `Title must contain at least one letter, use only letters, numbers, and spaces, and be ${MAX_DOCUMENT_TITLE_LENGTH} characters or fewer.`;
export const DOCUMENT_DESCRIPTION_MESSAGE = `Description must contain at least one letter, use only letters, numbers, and spaces, and be ${MAX_DOCUMENT_DESCRIPTION_LENGTH} characters or fewer.`;
export const DOCUMENT_TAGS_MESSAGE = `Tags must be letters/numbers only, ${MIN_TAG_LENGTH}–${MAX_TAG_LENGTH} characters each, max ${MAX_DOCUMENT_TAGS} tags.`;
export const PATCH_TITLE_MESSAGE = `Title must contain at least one letter, use only letters, numbers, and spaces, and be ${MAX_PATCH_TITLE_LENGTH} characters or fewer.`;
export const REQUIRED_FIELDS_MESSAGE = 'Please fill in all required fields.';

export const VIDEO_SIZE_MESSAGE = 'Video file size must be less than 2GB.';
export const PRESENTATION_SIZE_MESSAGE = 'Presentation file size must be less than 100MB.';
export const DOCUMENT_SIZE_MESSAGE = 'Document file size must be less than 50MB.';
export const PATCH_SIZE_MESSAGE = 'Patch file size must be less than 500MB.';

export const VIDEO_TYPE_MESSAGE = 'Video file must be one of: mp4, avi, mov, wmv, flv, webm, mkv';
export const PRESENTATION_TYPE_MESSAGE = 'Presentation file must be one of: ppt, pptx';
export const DOCUMENT_TYPE_MESSAGE = 'Document file must be one of: pdf, doc, docx, txt, rtf';
export const PATCH_TYPE_MESSAGE = 'Patch file must be one of: exe, msi, msu, cab, def, zip, rar, 7z';

// Common validation functions
export const normalizeTitle = (value: string): string => value.trim();
export const normalizeDescription = (value: string): string => value.trim();
export const normalizeTags = (value: string): string => value.trim();
export const sanitizeAssetText = (value: string): string => value.replace(/[^A-Za-z0-9\s]/g, '');
export const sanitizeAssetTags = (value: string): string => value.replace(/[^A-Za-z0-9\s,]/g, '');

export const isValidTitle = (value: string): boolean => {
  const trimmed = normalizeTitle(value);
  return trimmed.length > 0 && trimmed.length <= MAX_ASSET_TITLE_LENGTH && TITLE_REGEX.test(trimmed);
};

export const isValidDescription = (value: string): boolean => {
  const trimmed = normalizeDescription(value);
  return trimmed.length === 0 || (trimmed.length <= MAX_ASSET_DESCRIPTION_LENGTH && DESCRIPTION_REGEX.test(trimmed));
};

export const isValidTags = (value: string | string[]): boolean => {
  const tagList = Array.isArray(value)
    ? value.map((t) => t.trim()).filter(Boolean)
    : normalizeTags(value).split(',').map((t) => t.trim()).filter(Boolean);
  if (tagList.length === 0) return true;
  if (tagList.length > MAX_TAGS) return false;
  return tagList.every(
    (t) => SINGLE_TAG_REGEX.test(t) && t.length >= MIN_TAG_LENGTH && t.length <= MAX_TAG_LENGTH
  );
};

// Video validation
export const isValidVideoFile = (file: File): boolean => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  return fileExtension ? VIDEO_FILE_TYPES.includes(fileExtension) : false;
};

export const isValidVideoSize = (file: File): boolean => {
  return file.size <= MAX_VIDEO_SIZE;
};

export const validateVideoUpload = (data: {
  title: string;
  description: string;
  category: string;
  tags: string;
  file?: File;
}): string | null => {
  if (!data.title || !data.category) {
    return REQUIRED_FIELDS_MESSAGE;
  }

  if (!isValidTitle(data.title)) {
    return TITLE_MESSAGE;
  }

  if (!isValidDescription(data.description)) {
    return DESCRIPTION_MESSAGE;
  }

  if (!isValidTags(data.tags)) {
    return TAGS_MESSAGE;
  }

  if (data.file) {
    if (!isValidVideoFile(data.file)) {
      return VIDEO_TYPE_MESSAGE;
    }

    if (!isValidVideoSize(data.file)) {
      return VIDEO_SIZE_MESSAGE;
    }
  }

  return null;
};

// Presentation validation
export const isValidPresentationFile = (file: File): boolean => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  return fileExtension ? PRESENTATION_FILE_TYPES.includes(fileExtension) : false;
};

export const isValidPresentationSize = (file: File): boolean => {
  return file.size <= MAX_PRESENTATION_SIZE;
};

export const validatePresentationUpload = (data: {
  title: string;
  description: string;
  category: string;
  tags: string[];
  file?: File;
}): string | null => {
  if (!data.title || !data.category) {
    return REQUIRED_FIELDS_MESSAGE;
  }

  if (!isValidTitle(data.title)) {
    return PRESENTATION_TITLE_MESSAGE;
  }

  if (!isValidDescription(data.description)) {
    return PRESENTATION_DESCRIPTION_MESSAGE;
  }

  if (data.tags.length > 0 && !isValidTags(data.tags.join(', '))) {
    return PRESENTATION_TAGS_MESSAGE;
  }

  if (data.tags.length > MAX_PRESENTATION_TAGS) {
    return PRESENTATION_TAGS_MESSAGE;
  }

  if (normalizeTitle(data.title).length > MAX_PRESENTATION_TITLE_LENGTH) {
    return PRESENTATION_TITLE_MESSAGE;
  }

  if (normalizeDescription(data.description).length > MAX_PRESENTATION_DESCRIPTION_LENGTH) {
    return PRESENTATION_DESCRIPTION_MESSAGE;
  }

  if (data.file) {
    if (!isValidPresentationFile(data.file)) {
      return PRESENTATION_TYPE_MESSAGE;
    }

    if (!isValidPresentationSize(data.file)) {
      return PRESENTATION_SIZE_MESSAGE;
    }
  }

  return null;
};

// Document validation
export const isValidDocumentFile = (file: File): boolean => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  return fileExtension ? DOCUMENT_FILE_TYPES.includes(fileExtension) : false;
};

export const isValidDocumentSize = (file: File): boolean => {
  return file.size <= MAX_DOCUMENT_SIZE;
};

export const validateDocumentUpload = (data: {
  title: string;
  description: string;
  category: string;
  tags: string;
  file?: File;
}): string | null => {
  if (!data.title || !data.category) {
    return REQUIRED_FIELDS_MESSAGE;
  }

  if (!isValidTitle(data.title)) {
    return DOCUMENT_TITLE_MESSAGE;
  }

  if (!isValidDescription(data.description)) {
    return DOCUMENT_DESCRIPTION_MESSAGE;
  }

  if (!isValidTags(data.tags)) {
    return DOCUMENT_TAGS_MESSAGE;
  }

  const normalizedTags = data.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (normalizedTags.length > MAX_DOCUMENT_TAGS) {
    return DOCUMENT_TAGS_MESSAGE;
  }

  if (normalizeTitle(data.title).length > MAX_DOCUMENT_TITLE_LENGTH) {
    return DOCUMENT_TITLE_MESSAGE;
  }

  if (normalizeDescription(data.description).length > MAX_DOCUMENT_DESCRIPTION_LENGTH) {
    return DOCUMENT_DESCRIPTION_MESSAGE;
  }

  if (data.file) {
    if (!isValidDocumentFile(data.file)) {
      return DOCUMENT_TYPE_MESSAGE;
    }

    if (!isValidDocumentSize(data.file)) {
      return DOCUMENT_SIZE_MESSAGE;
    }
  }

  return null;
};

// Patch validation
export const isValidPatchFile = (file: File): boolean => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  return fileExtension ? PATCH_FILE_TYPES.includes(fileExtension) : false;
};

export const isValidPatchSize = (file: File): boolean => {
  return file.size <= MAX_PATCH_SIZE;
};

export const validatePatchUpload = (data: {
  title: string;
  description: string;
  category: string;
  tags: string;
  patchType: string;
  version?: string;
  targetOs: string[];
  architecture: string;
  file?: File;
}): string | null => {
  if (!data.title || !data.category || !data.patchType || !data.architecture || data.targetOs.length === 0) {
    return REQUIRED_FIELDS_MESSAGE;
  }

  if (!isValidTitle(data.title) || normalizeTitle(data.title).length > MAX_PATCH_TITLE_LENGTH) {
    return PATCH_TITLE_MESSAGE;
  }

  if (!isValidDescription(data.description)) {
    return DESCRIPTION_MESSAGE;
  }

  if (!isValidTags(data.tags)) {
    return TAGS_MESSAGE;
  }

  if (data.file) {
    if (!isValidPatchFile(data.file)) {
      return PATCH_TYPE_MESSAGE;
    }

    if (!isValidPatchSize(data.file)) {
      return PATCH_SIZE_MESSAGE;
    }
  }

  return null;
};

// Common update validation (for when file is not being updated)
export const validateAssetUpdate = (data: {
  title: string;
  description: string;
  category: string;
  tags: string | string[];
}): string | null => {
  if (!data.title || !data.category) {
    return REQUIRED_FIELDS_MESSAGE;
  }

  if (!isValidTitle(data.title)) {
    return TITLE_MESSAGE;
  }

  if (!isValidDescription(data.description)) {
    return DESCRIPTION_MESSAGE;
  }

  const tagsString = Array.isArray(data.tags) ? data.tags.join(', ') : data.tags;
  if (!isValidTags(tagsString)) {
    return TAGS_MESSAGE;
  }

  return null;
};
