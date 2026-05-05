/**
 * Global, professional-English replacement for the browser's default form
 * validation tooltips ("Please fill out this field.", "Please match the
 * requested format.", etc.).
 *
 * Wires two capture-phase document listeners:
 *   - `invalid`  → derives a contextual message from the field's label and
 *                  validity state, then calls setCustomValidity() so the
 *                  native bubble shows our text instead of the browser default.
 *   - `input`    → clears the custom message so the field can re-validate
 *                  on the next submit / blur (otherwise the field stays
 *                  invalid forever once setCustomValidity has been called).
 *
 * Returns a cleanup function. Call once at app boot.
 */

type FieldEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const isFieldEl = (el: EventTarget | null): el is FieldEl =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement;

const getFieldLabel = (input: FieldEl): string => {
  // 1. Explicit override on the element
  const explicit = input.getAttribute('data-field-label');
  if (explicit) return explicit;

  // 2. <label for="id">…</label>
  if (input.id) {
    const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (label?.textContent) {
      return label.textContent.replace(/\s*\*\s*$/, '').trim();
    }
  }

  // 3. Closest enclosing <label>
  const enclosing = input.closest('label');
  if (enclosing?.textContent) {
    return enclosing.textContent.replace(/\s*\*\s*$/, '').trim();
  }

  // 4. aria-label / placeholder / name fallbacks
  const aria = input.getAttribute('aria-label');
  if (aria) return aria;

  const placeholder = (input as HTMLInputElement).placeholder;
  if (placeholder) return placeholder;

  if (input.name) {
    // camelCase / snake_case → Title Case ("firstName" → "First name")
    return input.name
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
  }

  return 'This field';
};

const buildMessage = (input: FieldEl): string => {
  const v = input.validity;
  const label = getFieldLabel(input);
  const lower = label.toLowerCase();
  const type = (input as HTMLInputElement).type;

  if (v.valueMissing) {
    if (type === 'checkbox' || type === 'radio') {
      return `Please select ${lower}.`;
    }
    if (input instanceof HTMLSelectElement) {
      return `Please select a ${lower}.`;
    }
    return `${label} is required.`;
  }

  if (v.typeMismatch) {
    if (type === 'email') return 'Please enter a valid email address.';
    if (type === 'url') return 'Please enter a valid URL.';
    return `Please enter a valid ${lower}.`;
  }

  if (v.tooShort) {
    const min = (input as HTMLInputElement).minLength;
    return `${label} must be at least ${min} characters.`;
  }

  if (v.tooLong) {
    const max = (input as HTMLInputElement).maxLength;
    return `${label} must be no more than ${max} characters.`;
  }

  if (v.rangeUnderflow) {
    const min = (input as HTMLInputElement).min;
    return `${label} must be at least ${min}.`;
  }

  if (v.rangeOverflow) {
    const max = (input as HTMLInputElement).max;
    return `${label} must be no more than ${max}.`;
  }

  if (v.stepMismatch) {
    return `Please enter a valid value for ${lower}.`;
  }

  if (v.patternMismatch) {
    // If the field declares its own title (browser also reads this for the
    // default bubble), prefer it — authors often write a precise rule there.
    const title = input.getAttribute('title');
    if (title) return title;
    return `Please enter a valid ${lower}.`;
  }

  if (v.badInput) {
    return `Please enter a valid ${lower}.`;
  }

  // Fall back to the browser's own message rather than blanking the bubble.
  return input.validationMessage || `Please correct ${lower}.`;
};

export const attachGlobalFormValidation = (): (() => void) => {
  const onInvalid = (e: Event) => {
    const target = e.target;
    if (!isFieldEl(target)) return;
    // Don't override messages already set explicitly by app code.
    if (target.validity.customError) return;
    target.setCustomValidity(buildMessage(target));
  };

  const onInput = (e: Event) => {
    const target = e.target;
    if (!isFieldEl(target)) return;
    // Clearing here lets the browser re-evaluate on the next submit/blur.
    target.setCustomValidity('');
  };

  document.addEventListener('invalid', onInvalid, true);
  document.addEventListener('input', onInput, true);
  document.addEventListener('change', onInput, true);

  return () => {
    document.removeEventListener('invalid', onInvalid, true);
    document.removeEventListener('input', onInput, true);
    document.removeEventListener('change', onInput, true);
  };
};
