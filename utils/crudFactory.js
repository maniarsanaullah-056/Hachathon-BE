import asyncHandler from './asyncHandler.js';
import ApiError from './ApiError.js';
import { sendSuccess } from './apiResponse.js';
import { pick } from './pick.js';
import { logAudit } from '../services/auditService.js';

/**
 * Chhoti lookup collections (departments, designations, leave types, holidays)
 * ke liye common list/create/update/delete controller.
 * - fields: sirf yehi body fields accept hoti hain (mass assignment protection)
 * - inUse(item): agar record kahin use ho raha ho to delete rokne ki wajah return karo
 */
export function createCrudController({
  Model,
  entity,
  fields,
  sort = { createdAt: -1 },
  populate = null,
  transform = (body) => body,
  filterFromQuery = () => ({}),
  inUse = async () => null,
}) {
  const tag = entity.toUpperCase().replace(/\s+/g, '_');

  const list = asyncHandler(async (req, res) => {
    let query = Model.find(filterFromQuery(req.query)).sort(sort).limit(500);
    if (populate) query = query.populate(populate);
    sendSuccess(res, { items: await query });
  });

  const create = asyncHandler(async (req, res) => {
    const item = await Model.create(transform(pick(req.body, fields)));
    if (populate) await item.populate(populate);
    await logAudit({ actor: req.user, action: `${tag}_CREATED`, entity, entityId: item._id, after: item, req });
    sendSuccess(res, { item }, `${entity} created`, 201);
  });

  const update = asyncHandler(async (req, res) => {
    const item = await Model.findById(req.params.id);
    if (!item) throw new ApiError(404, `${entity} not found`);
    const before = item.toObject();
    item.set(transform(pick(req.body, fields)));
    await item.save();
    if (populate) await item.populate(populate);
    await logAudit({ actor: req.user, action: `${tag}_UPDATED`, entity, entityId: item._id, before, after: item, req });
    sendSuccess(res, { item }, `${entity} updated`);
  });

  const remove = asyncHandler(async (req, res) => {
    const item = await Model.findById(req.params.id);
    if (!item) throw new ApiError(404, `${entity} not found`);
    const reason = await inUse(item);
    if (reason) throw new ApiError(409, reason);
    const before = item.toObject();
    await item.deleteOne();
    await logAudit({ actor: req.user, action: `${tag}_DELETED`, entity, entityId: item._id, before, req });
    sendSuccess(res, null, `${entity} deleted`);
  });

  return { list, create, update, remove };
}
