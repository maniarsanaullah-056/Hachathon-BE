import Notification from '../models/Notification.js';

/**
 * Creates and dispatches an in-app notification
 */
export async function createNotification({ recipientId, title, message, type = 'general', referenceId = null }) {
  try {
    return await Notification.create({
      recipient: recipientId,
      title,
      message,
      type,
      referenceId: referenceId ? String(referenceId) : null,
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
    return null;
  }
}

/**
 * Broadcasts notification to all active users or a specific role
 */
export async function broadcastNotification({ users, title, message, type = 'announcement', referenceId = null }) {
  try {
    const docs = users.map((u) => ({
      recipient: u._id || u,
      title,
      message,
      type,
      referenceId: referenceId ? String(referenceId) : null,
    }));
    if (docs.length > 0) {
      return await Notification.insertMany(docs);
    }
  } catch (err) {
    console.error('Failed to broadcast notification:', err);
  }
}
