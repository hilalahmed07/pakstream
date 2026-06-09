const USERNAME_REGEX = /^[A-Za-z0-9._]{3,30}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/;

const USERNAME_MESSAGE =
  'Username must be 3-30 characters and contain only letters, numbers, underscores, or dots';
const EMAIL_MESSAGE = `Please provide a valid email address with no more than ${EMAIL_MAX_LENGTH} characters`;
const PASSWORD_MESSAGE =
  'Password must be at least 12 characters and include uppercase, lowercase, number, and special character';

const normalizeUsername = (value) => (value == null ? '' : String(value).trim());
const normalizeEmail = (value) => (value == null ? '' : String(value).trim().toLowerCase());
const normalizePassword = (value) => (value == null ? '' : String(value));

const isValidUsername = (value) => USERNAME_REGEX.test(normalizeUsername(value));
const isValidEmail = (value) => {
  const normalizedEmail = normalizeEmail(value);
  return normalizedEmail.length <= EMAIL_MAX_LENGTH && EMAIL_REGEX.test(normalizedEmail);
};
const isStrongPassword = (value) => PASSWORD_REGEX.test(normalizePassword(value));

module.exports = {
  USERNAME_REGEX,
  EMAIL_REGEX,
  EMAIL_MAX_LENGTH,
  PASSWORD_REGEX,
  USERNAME_MESSAGE,
  EMAIL_MESSAGE,
  PASSWORD_MESSAGE,
  normalizeUsername,
  normalizeEmail,
  normalizePassword,
  isValidUsername,
  isValidEmail,
  isStrongPassword,
};
