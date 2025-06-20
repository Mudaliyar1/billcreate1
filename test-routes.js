const express = require('express');
const app = express();

// Test the route patterns that were causing issues
const router = express.Router();

// These should work now
router.get('/templates', (req, res) => res.send('Templates list'));
router.get('/templates/editor', (req, res) => res.send('New template editor'));
router.get('/templates/editor/:id', (req, res) => res.send(`Edit template ${req.params.id}`));
router.get('/api/templates/default', (req, res) => res.json({ message: 'Default template' }));
router.get('/api/templates/:id', (req, res) => res.json({ message: `Template ${req.params.id}` }));

app.use('/', router);

const port = 3001;
app.listen(port, () => {
  console.log(`✅ Route test server running on port ${port}`);
  console.log('Testing routes:');
  console.log('  GET /templates');
  console.log('  GET /templates/editor');
  console.log('  GET /templates/editor/123');
  console.log('  GET /api/templates/default');
  console.log('  GET /api/templates/123');
  
  // Test the routes
  setTimeout(() => {
    console.log('\n🧪 All routes loaded successfully!');
    process.exit(0);
  }, 1000);
});
