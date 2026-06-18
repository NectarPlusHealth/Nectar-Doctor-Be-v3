import express, { Express } from 'express';
import cors from 'cors';
import connectDB from './config/db';
import { config } from './config/environment';
import { initializeFirebase } from './config/firebase';
import indexRoutes from './routes/index';
import useRoutes from './routes/users';
import registerRoute from './routes/registration';
import loginOtpRoute from './routes/loginOtp';
import googleAuthRoute from './routes/googleAuth';
import commonRouter from './routes/common.route';
import masterRoutes from './routes/master';
import settingRoutes from './routes/setting';
import servicesRoutes from './routes/services';
import notificationRoutes from './routes/notification';
import chatRoutes from './routes/chat';
import videoConsultationRoutes from './routes/videoConsultation';
import kycRoutes from './routes/kyc';
import payoutsRoutes from './routes/payouts';
import earningsRoutes from './routes/earnings';
import faqRoutes from './routes/faqRoutes';
import videoRoutes from './routes/video';
import { startChatExpiryNotifier } from './jobs/chatExpiryNotifier';
import { startChatExpiryDeleter } from './jobs/chatExpiryDeleter';
const app: Express = express();

// Use the port from config, with a fallback
const port: number = config.port || 3000;
// const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || 'localhost';

// Connect to DB
connectDB();

// Initialize Firebase Admin SDK for push notifications
initializeFirebase();

// Middleware to parse JSON and URL-encoded data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Enable CORS with dynamic origin check
const allowedOrigins = ['http://localhost:4200', 'https://nectarplus.health', 'http://localhost:4400', 'http://localhost:4500', 'http://82.112.237.181:4500', 'https://doctor.nectarplus.health', 'http://192.168.1.13:3000'];

// app.use(cors({
//   origin: (origin, callback) => {
//     // Allow requests with no origin (like Postman or server-to-server requests)
//     if (!origin) return callback(null, true);

//     if (allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true // enable cookies/auth headers
// }));

// Handle preflight requests for all routes
// app.options('*', cors());
app.use(cors({
  origin: '*', // or your Angular IP:4200
}));
// Define routes
app.use('/', indexRoutes);
app.use('/users', useRoutes);
app.use('/api/v1', registerRoute);
app.use('/api/v1/loginOtp', loginOtpRoute);
app.use('/api/v1/auth', googleAuthRoute);
app.use("/api/v1/common", commonRouter);
app.use("/api/v1/master", masterRoutes);
app.use("/api/v1/setting", settingRoutes);
app.use("/api/v1/services", servicesRoutes);
app.use("/api/v1/notification", notificationRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1", videoConsultationRoutes);
app.use('/api/v1/kyc', kycRoutes);
app.use('/api/v1/payouts', payoutsRoutes);
app.use('/api/v1/earnings', earningsRoutes);
app.use('/api/v1/faq', faqRoutes);
app.use('/api/v1/video', videoRoutes);
app.use('/faq', faqRoutes);
app.use('/video', videoRoutes);

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running at http://localhost:${port}`);
});

// Kick off background jobs (chat pre-expiry notifier, etc.)
const CHAT_JOB_INTERVAL_MS = 15 * 60 * 1000;
startChatExpiryNotifier(CHAT_JOB_INTERVAL_MS);
startChatExpiryDeleter(CHAT_JOB_INTERVAL_MS);
