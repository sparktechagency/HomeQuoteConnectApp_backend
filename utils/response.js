exports.success = (res, data, message = "Success") => {
  res.status(200).json({ success: true, message, data });
};
exports.error = (res, message = "Error", code = 500) => {
  res.status(code).json({ success: false, message });
};
