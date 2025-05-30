import * as functions from "firebase-functions";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const app = next({
  dev,
  conf: {
    // Tell Next.js to use the compiled `.next` directory
    distDir: ".next",
  },
});
const handle = app.getRequestHandler();

export const nextServer = functions.https.onRequest((req, res) => {
  return app.prepare().then(() => handle(req, res));
});
