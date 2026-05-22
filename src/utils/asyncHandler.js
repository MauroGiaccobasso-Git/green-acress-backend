// Wrapper reutilizable para controllers async.
// Captura errores automáticamente y los deriva al middleware global.
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};