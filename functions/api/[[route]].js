const serverless = require('serverless-http');

let handler = null;

export async function onRequest({ request, env, ctx }) {
  if (env.MONGODB_URI) process.env.MONGODB_URI = env.MONGODB_URI;
  if (env.JWT_SECRET)  process.env.JWT_SECRET  = env.JWT_SECRET;

  if (!handler) {
    const app = require('../../backend/app');
    handler = serverless(app);
  }

  return handler(request, env, ctx);
}
