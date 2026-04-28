require('dotenv').config();
const app = require('./backend/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`PV Tennis Club API running on http://localhost:${PORT}`);
  console.log(`API base: http://localhost:${PORT}/api`);
});
