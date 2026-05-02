import Joi from "joi";

export const getDoctorList = Joi.object({
  search: Joi.string().allow("").optional(),
  sort: Joi.string().optional(),
  page: Joi.number().integer().min(1).optional(),
  size: Joi.number().integer().min(1).optional(),
  sortOrder: Joi.string().valid("ASC", "DESC").optional(),
  type: Joi.string().optional(),
});


export const patientId = Joi.object({
  patientId: Joi.string().required(), // or Joi.number().integer().required()
});