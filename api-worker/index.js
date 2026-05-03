import serverless from 'serverless-http';
import app from '../backend/app.js';

const handler = serverless(app);

export default {
  async fetch(request, env, ctx) {
    if (env.MONGODB_URI) process.env.MONGODB_URI = env.MONGODB_URI;
    if (env.JWT_SECRET)  process.env.JWT_SECRET  = env.JWT_SECRET;
    return handler(request, env, ctx);
  }
};
