exports.checkHealth = (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Tapbirr API is running smoothly.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};
