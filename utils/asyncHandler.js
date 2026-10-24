// Async controller ke errors ko automatically error handler tak pohanchata hai
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
