export const USERNAME_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9._]{3,30}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export const USERNAME_MESSAGE =
  'Username must be 3-30 characters, contain at least one letter, and only letters, numbers, underscores, or dots.';
export const EMAIL_MESSAGE = `Please enter a valid email address with no more than ${EMAIL_MAX_LENGTH} characters.`;
export const PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

export const normalizeUsername = (value: string): string => value.trim();
export const normalizeEmail = (value: string): string => value.trim().toLowerCase();
export const sanitizeUsernameInput = (value: string): string => value.replace(/[^A-Za-z0-9._]/g, '');
export const sanitizeEmailInput = (value: string): string => value.replace(/[^A-Za-z0-9@._+-]/g, '');
export const sanitizeProfileTextInput = (value: string): string => value.replace(/[^A-Za-z0-9\s]/g, '');
export const sanitizeContactNumberInput = (value: string): string => value.replace(/\D/g, '');

// Name validation and sanitization (first/last names)
export const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{1,50}$/;
export const NAME_MESSAGE =
  "Name must contain only letters, spaces, hyphens, or apostrophes, and be 1-50 characters.";
export const sanitizeNameInput = (value: string): string => value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, '');

export const isValidName = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.length === 0 || NAME_REGEX.test(trimmed);
};

export const isValidUsername = (value: string): boolean => USERNAME_REGEX.test(normalizeUsername(value));
export const isValidEmail = (value: string): boolean => {
  const normalizedEmail = normalizeEmail(value);
  return normalizedEmail.length <= EMAIL_MAX_LENGTH && EMAIL_REGEX.test(normalizedEmail);
};
export const isStrongPassword = (value: string): boolean => PASSWORD_REGEX.test(value);

// Organization and address validation - prevent numeric-only entries
export const ORGANIZATION_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9\s]+$/;
export const ADDRESS_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9\s]+$/;

export const ORGANIZATION_MESSAGE =
  'Organization must contain at least one letter and use only letters, numbers, and spaces.';
export const ADDRESS_MESSAGE = 'Address must contain at least one letter and use only letters, numbers, and spaces.';

export const isValidOrganization = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.length === 0 || ORGANIZATION_REGEX.test(trimmed);
};

export const isValidAddress = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.length === 0 || (trimmed.length <= 100 && ADDRESS_REGEX.test(trimmed));
};

// Bio and address length limits
export const BIO_MAX_LENGTH = 100;
export const ADDRESS_MAX_LENGTH = 100;
export const BIO_MESSAGE = `Bio must be no more than ${BIO_MAX_LENGTH} characters.`;

export const isValidBio = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.length <= BIO_MAX_LENGTH;
};
