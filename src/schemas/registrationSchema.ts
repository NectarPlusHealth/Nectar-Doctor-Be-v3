// src/schemas/registrationSchema.ts
import Joi from 'joi';

const regexForMobile = /^[0-9]{10}$/; // adapt if you need other formats

// ---------- SIGN UP ----------
export const signUp = Joi.object({
  fullName: Joi.string().required(),
  phone: Joi.string().length(10).pattern(regexForMobile).required(),
  userType: Joi.number().required(),
  mode: Joi.number().optional(),
  countryCode: Joi.string().trim().default('+91'),
  experience: Joi.string().trim().min(1).required(),
  gender: Joi.string().valid('male', 'female', 'other').required(),
  city: Joi.string().trim().min(1).required(),
  state: Joi.string().trim().min(1).required(),
  specialization: Joi.string().required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().trim().min(6).required(),
  education: Joi.array()
    .items(
      Joi.object({
        degree: Joi.string().required(),
        college: Joi.string().required(),
        year: Joi.string().required(),
      })
    )
    .required(),
});

// ---------- LOGIN ----------
export const login = Joi.object({
  phone: Joi.string()
    .length(10)
    .pattern(regexForMobile)
    .messages({
      'string.length': 'Phone must be 10 digits',
      'string.pattern.base': 'Phone must contain only digits',
    }),
  email: Joi.string().trim().email().messages({
    'string.email': 'Email must be a valid email address',
  }),
  password: Joi.string().trim().min(6).required(),
  userType: Joi.number().required(),
  mode: Joi.number().optional(),
  countryCode: Joi.string().trim().default('+91'),
  deviceId: Joi.string().optional().allow(null, ''),
  deviceToken: Joi.string().optional().allow(null, ''),
  deviceType: Joi.string().optional().allow(null, '').default('desktop'),
  browser: Joi.string().optional().allow(null, ''),
  os: Joi.string().optional().allow(null, ''),
}).or('phone', 'email').messages({
  'object.missing': 'Either phone or email must be provided',
});

// ---------- VERIFY OTP ----------
export const verifyOTP = Joi.object({
  phone: Joi.string()
    .length(10)
    .pattern(regexForMobile)
    .required()
    .messages({
      'string.base': 'Phone must be a string',
      'string.empty': 'Phone is required',
      'string.length': 'Phone must be 10 digits',
      'string.pattern.base': 'Phone must contain only digits',
    }),

  otp: Joi.string().trim().min(3).max(10).required().messages({
    'string.base': 'OTP must be a string',
    'string.empty': 'OTP is required',
    'string.min': 'OTP is too short',
    'string.max': 'OTP is too long',
  }),

  userType: Joi.number().required().messages({
    'number.base': 'userType must be a number',
    'any.required': 'userType is required',
  }),

  countryCode: Joi.string().trim().default('+91'),

  deviceId: Joi.string().optional().allow(null, ''),
  deviceToken: Joi.string().optional().allow(null, ''),
  deviceType: Joi.string().optional().allow(null, '').default('desktop'),
  browser: Joi.string().optional().allow(null, ''),
  os: Joi.string().optional().allow(null, ''),
  osVersion: Joi.string().optional().allow(null, ''),
});

export const sendOTP = Joi.object().keys({
  phone: Joi.string().length(10).pattern(/^\d{10}$/),
  userType: Joi.number().required(),
  countryCode: Joi.string().trim().default("+91"),
  email: Joi.string().trim().lowercase(),
  isLogin: Joi.boolean().default(true),
});