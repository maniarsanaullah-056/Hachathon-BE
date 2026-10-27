import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import Announcement from '../models/Announcement.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { logAudit } from '../services/auditService.js';
import { broadcastNotification } from '../services/notificationService.js';
import User from '../models/User.js';

// Announcements
export const listAnnouncements = asyncHandler(async (_req, res) => {
  const items = await Announcement.find({ isActive: true })
    .sort({ createdAt: -1 })
    .populate('author', 'name email role');
  sendSuccess(res, items);
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, content, priority } = req.body;
  if (!title || !content) {
    throw new ApiError(400, 'Title and content are required');
  }

  const announcement = await Announcement.create({
    title,
    content,
    priority: priority || 'normal',
    author: req.user._id,
  });

  // Broadcast notification to all active users
  const activeUsers = await User.find({ isActive: true }).select('_id');
  await broadcastNotification({
    users: activeUsers,
    title: `Announcement: ${title}`,
    message: content.slice(0, 150),
    type: 'announcement',
    referenceId: announcement._id,
  });

  await logAudit({
    actor: req.user,
    action: 'ANNOUNCEMENT_CREATED',
    entity: 'Announcement',
    entityId: announcement._id,
    after: announcement,
    req,
  });

  sendSuccess(res, announcement, 'Announcement posted successfully', 201);
});

// Notifications
export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);
  const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });

  sendSuccess(res, { notifications, unreadCount });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );
  if (!notification) throw new ApiError(404, 'Notification not found');
  sendSuccess(res, notification, 'Marked as read');
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  sendSuccess(res, null, 'All notifications marked as read');
});

// Audit Log (Admin Only, Append-Only)
export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (req.query.action) filter.action = req.query.action;
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.actorId) filter.actor = req.query.actorId;

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actor', 'name email role'),
    AuditLog.countDocuments(filter),
  ]);

  sendSuccess(res, { items, pagination: paginationMeta(page, limit, total) });
});
