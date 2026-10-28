const app = require('../backend/app');

// Vercel Serverless Function entry point
module.exports = (req, res) => {
  if (typeof app === 'function') {
    return app(req, res);
  }
  if (app && typeof app.handle === 'function') {
    return app.handle(req, res);
  }
  res.status(500).json({ error: 'Backend application handler failed to initialize' });
};
