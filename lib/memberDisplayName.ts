export const MEMBER_DISPLAY_NAME_MIN_LENGTH = 3;
export const MEMBER_DISPLAY_NAME_MAX_LENGTH = 15;
export const MEMBER_DISPLAY_NAME_INPUT_PATTERN = '[a-zA-Z0-9 ]+(?:_[a-zA-Z0-9 ]+)?';

const MEMBER_DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9 ]+(?:_[a-zA-Z0-9 ]+)?$/;

export function isValidMemberDisplayName(value: string) {
  return value.length >= MEMBER_DISPLAY_NAME_MIN_LENGTH
    && value.length <= MEMBER_DISPLAY_NAME_MAX_LENGTH
    && MEMBER_DISPLAY_NAME_PATTERN.test(value);
}
