
import worker from '../../api-handler.js';

export async function onRequest(context) {
  return worker.fetch(context.request, context.env);
}
