import Joi from "joi";

export const patientIdSchema = Joi.object({
  patientId: Joi.string().hex().length(24).required(),
});
