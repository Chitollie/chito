
import handler from '../../api-handler.js';

export async function onRequest(context) {
  return handler.fetch(context.request, context.env);
}
