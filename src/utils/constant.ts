// src/utils/constants.ts

const constants = {
  USER_TYPES: {
    PATIENT: 1,
    DOCTOR: 2,
    HOSPITAL: 3,
    ADMIN: 4, // added for notifications
  },

  TOKEN_TYPE: {
    LOGIN: 1,
    REFRESH: 2,
    APPOINTMENT: 3,
  },

  DEVICE_TYPE: {
    DESKTOP: "desktop",
    ANDROID: "android",
    IOS: "ios",
  },

  // Profile completion steps
  PROFILE_STEPS: {
    SECTION_A: 1,
    SECTION_B: 2,
    SECTION_C: 3, // ✅ added, referenced in controller
    COMPLETED: 4,
  },

  // Profile verification status
  PROFILE_STATUS: {
    PENDING: 1,
    APPROVE: 2,
    REJECT: 3,
    ACTIVE: 2,
  },

  // Supported languages
  LANGUAGES_SUPPORTED: {
    ENGLISH: 1,
    HINDI: 2,
    OTHER: 3,
  },

  // Gender
  GENDER: {
    MALE: 1,
    FEMALE: 2,
    OTHER: 3,
  },

  // Blood groups
  BLOOD_GROUP: {
    A_POSITIVE: 1,
    A_NEGATIVE: 2,
    B_POSITIVE: 3,
    B_NEGATIVE: 4,
    AB_POSITIVE: 5,
    AB_NEGATIVE: 6,
    O_POSITIVE: 7,
    O_NEGATIVE: 8,
  },

  // Hospital profile screens
  HOSPITAL_SCREENS: {
    ESTABLISHMENT_DETAILS: 1,
    DOCTOR_DETAILS: 2,
    TIMING_DETAILS: 3,
    ESTABLISHMENT_LOCATION: 4,
    ESTABLISHMENT_TIMING: 5,
    COMPLETED: 6,
    ESTABLISHMENT_PROOF: 7,
  },

  // Doctor profile screens
  DOCTOR_SCREENS: {
    DOCTOR_DETAILS: 1,
    DOCTOR_IDENTITY_PROOF: 2,
    ESTABLISHMENT_LOCATION: 3,
    COMPLETED: 4,
  },

  // Doctor account status
  DOCTOR_STATUS: {
    INACTIVE: 0,
    ACTIVE: 1,
    BLOCKED: 2,
  },

  // Notification types
  NOTIFICATION_TYPE: {
    DOCTOR_SIGN_UP_PROOFS: 1,
    APPOINTMENT_BOOKED: 2,
    APPOINTMENT_CANCELLED: 3,
    CHAT_WINDOW_EXPIRING_SOON: 4,
  },

  // Messages (titles/bodies for notifications/emails)
  MESSAGES: {
    DOCTOR_SIGN_UP_PROOFS: {
      TITLE: "Doctor Registration Proofs Submitted",
      BODY: "A doctor has submitted proofs for registration and is awaiting verification.",
    },
  },

  // Example SMS templates
  SMS_TEMPLATES: {
    OTP: "9735",
    WELCOME: "9735",
    DOCTOR_REGISTRATION: "9736", // ✅ added for doctor signup flow
  },

  // Email templates
  EMAIL_TEMPLATES: {
    DOCTOR_PROFILE_UNDER_VERIFICATION: "doctor_profile_under_verification",
  },

  // Views (HTML templates)
  VIEWS: {
    DOCTOR_PROFILE_UNDER_VERIFICATION: "doctorProfileUnderVerification.html",
  },

  // Regex
  regexForMobile: /^[0-9]{10}$/,

  DEFAULT_STATUS: 2,

  // Sorting constants
  LIST: {
    ORDER: {
      ASC: 1,
      DESC: -1,
    },
  },

  // For filtering doctor-patient lists
  DOCTOR_PATIENT_LIST: {
    TODAY: "TODAY",
    ALL: "ALL",
  },

  // Appointment slots (example)
  SLOT: [1, 2, 3, 4, 5, 6, 7, 8],

  CANCEL_BY: {
    DOCTOR: 1,
    PATIENT: 2,
    SYSTEM: 3,
  },

  // Appointment booking status
  BOOKING_STATUS: {
    BOOKED: 1,
    CANCELLED: 2,
    COMPLETED: 3,
    COMPLETE: 3, // alias
    RESCHEDULE: -2,
  },

  // Types of consultation
  CONSULTATION_TYPES: {
    VIDEO: "video",
    IN_CLINIC: "in_clinic",
  },

  NA: "N/A",

  // Doctor profile record types (for setting/list endpoint)
  DOCTOR_PROFILE: {
    EDUCATION: 1,
    AWARDS_AND_RECOGNITION: 2,
    MEDICAL_REGISTRATION: 3,
    MEMBERSHIPS: 4,
    SERVICES: 5,
    SOCIALS: 8,
    PROCEDURES: 9,
    CERTIFICATIONS: 16,
  } as Record<string, number>,

  // Fields that store flat ObjectId arrays (not embedded sub-documents)
  FLAT_OBJECTID_FIELDS: [9] as number[],

  // Sub-document arrays that have {_id: false} — must be matched by 'name' field instead of '_id'
  NAME_BASED_SUBDOC_FIELDS: [5] as number[],

  // Map type number to Doctor model field name
  DOCTOR_PROFILE_RECORD_KEY: {
    1: "education",
    2: "award",
    3: "medicalRegistration",
    4: "membership",
    5: "service",
    8: "social",
    9: "procedure",
    16: "certifications",
  } as Record<string, string>,
};

export default constants;
export type Constants = typeof constants;
