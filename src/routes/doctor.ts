// src/routes/Doctor.ts
import { Router } from "express";
import { verifyAuthToken } from "../utils/auth";
import validate from "../middlewares/validate";
import * as schema from "../schemas/doctorSchema";
import doctorController from "../controllers/doctorController";
import patientController from "../controllers/patientController";
import { patientIdSchema } from "../schemas/patient.validator";
// import { getPatientData } from "../controllers/patientcontroller"; 

const router = Router();

router.get(
  "/list",
  verifyAuthToken,            // <-- enable authentication
  validate(schema.getDoctorList, "query"),
  doctorController.getDoctorPatientList
);

router.get(
  "/record",
  verifyAuthToken,
  validate(patientIdSchema, "query"),
  patientController.getPatientData
);

router.get(
  "/appointment/list",
  verifyAuthToken,
  validate(patientIdSchema, "query"),
  patientController.patientAppointmentList
);

router.get(
  "/doctor-appointment-dashboard",
  verifyAuthToken,
  // validate(patientIdSchema, "query"),
  patientController.getDoctorAppointmentDashboard
);


router.get(
  "/doctor-appointment/list",
  verifyAuthToken,
  // validate(schema.doctorPatientList, "query"),
  doctorController.doctorAppointmentList
);


router.put(
  "/update-profile",
  verifyAuthToken,
  doctorController.doctorUpdateProfile
);


router.post(
  "/doctor-add-establishment",
  verifyAuthToken,
  doctorController.doctorAddEstablishment
);

router.put(
  "/doctor-edit-establishment",
  verifyAuthToken,
  doctorController.editEstablishment
);
router.post(
  "/get-calender",
  verifyAuthToken,
  doctorController.getCalender
);

router.get(
  "/profile",
   verifyAuthToken, 
  doctorController.getDoctorProfile);

router.put(
  "/reschedule-appointment/:appointmentId",
  verifyAuthToken,
  doctorController.rescheduleAppointment
);



router.get(
  "/doctor-establishment-list",
  verifyAuthToken,
  doctorController.doctorEstablishmentList
);

router.get(
  "/dashboard-summary",
  verifyAuthToken,
  doctorController.getDashboardSummary
);

router.get(
  "/dashboard-profile",
  verifyAuthToken,
  doctorController.getDashboardProfile
);

router.get(
  "/analytics",
  verifyAuthToken,
  doctorController.getAnalytics
);

router.post(
  "/doctor-delete-establishment2",
  verifyAuthToken,
  doctorController.deleteOwnEstablishment
);

router.post(
  "/doctor-delete-establishment3",
  verifyAuthToken,
  doctorController.deleteVisitingEstablishment
);

export default router;
