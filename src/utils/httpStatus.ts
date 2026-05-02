// src/utils/httpStatus.ts

/**
 * Standard HTTP status codes (subset).
 * Exported as default for easy import.
 */
const httpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};

export default httpStatus;
