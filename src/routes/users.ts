import { Router } from "express";
import { createUser, getAllUser, getAllUsers, getUserid } from "../controllers/userController";

const router = Router();

router.get('/',getAllUsers);

// Define a route for a specific user
router.post('/create',createUser);
router.get('/alluser',getAllUser);
router.get('/:id',getUserid);
  
  export default router;