function validateRequest(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) {
      return res.status(400).json({
        message: 'Request validation failed.',
        errors: result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
      });
    }
    req.body = result.data.body;
    req.params = result.data.params;
    req.query = result.data.query;
    return next();
  };
}

module.exports = validateRequest;
