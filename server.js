const http = require('http');
const app = require('./backend/app');

const PORT = process.env.PORT || 5000;

let server;

if (typeof app.listen === 'function') {
  server = app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Branch & ATM Tracker API Server (Express)`);
    console.log(`📡 Listening at: http://localhost:${PORT}`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📊 Records API: http://localhost:${PORT}/api/records`);
    console.log(`==================================================\n`);
  });
} else {
  server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Branch & ATM Tracker Server (Native Engine)`);
    console.log(`📡 Listening at: http://localhost:${PORT}`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📊 Records API: http://localhost:${PORT}/api/records`);
    console.log(`==================================================\n`);
  });
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
