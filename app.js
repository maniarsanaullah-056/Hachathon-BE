import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import ApiError from './utils/ApiError.js';
import ensureDb from './middleware/ensureDb.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import setupRoutes from './routes/setupRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import designationRoutes from './routes/designationRoutes.js';
import leaveTypeRoutes from './routes/leaveTypeRoutes.js';
import holidayRoutes from './routes/holidayRoutes.js';
import userRoutes from './routes/userRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import correctionRoutes from './routes/correctionRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import payslipRoutes from './routes/payslipRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import auditRoutes from './routes/auditRoutes.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.frontendUrls.includes(origin)) return callback(null, true);
      callback(new ApiError(403, 'Origin not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' }));
if (!env.isProd) app.use(morgan('dev'));

// Health check
app.get('/api/health', async (_req, res) => {
  let db = 'disconnected';
  try {
    await connectDB();
    db = 'connected';
  } catch {}
  res.status(db === 'connected' ? 200 : 503).json({
    success: db === 'connected',
    message: db === 'connected' ? 'API is healthy' : 'Database unavailable',
    data: {
      status: db === 'connected' ? 'ok' : 'degraded',
      db,
      environment: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

app.use('/api', apiLimiter);
app.use('/api', ensureDb);

// API modules
app.use('/api', adminRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/designations', designationRoutes);
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/users', userRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/corrections', correctionRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/payslips', payslipRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
