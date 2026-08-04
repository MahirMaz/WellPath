console.log('Starting test...');

try {
  console.log('Importing express...');
  const express = await import('express');
  console.log('Express imported successfully');
  
  console.log('Importing cors...');
  const cors = await import('cors');
  console.log('Cors imported successfully');
  
  console.log('Creating app...');
  const app = express.default();
  const PORT = 3000;
  
  app.use(cors.default());
  app.use(express.default().json());
  
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running!' });
  });
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  });
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
}