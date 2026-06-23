export function isLiveUpdateSubmitSuccess(response: Pick<Response, 'ok' | 'status'>) {
  return response.ok || response.status === 404 || response.status === 503;
}
