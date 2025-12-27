const successResponse = (res, data, message = 'Success', code = 200) => {
  return res.status(code).json({ success: true, message, data });
};

const errorResponse = (res, message = 'Error', code = 500) => {
  return res.status(code).json({ success: false, message });
};

// Backwards-compatible aliases


const success = successResponse;
const error = errorResponse;

module.exports = {
  successResponse,
  errorResponse,
  success,
  error
};
