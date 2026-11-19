// Slow presentation needs its full spin, flight and result hold regardless of case speed.
export const UPGRADE_ANIMATION_TIMEOUT_MS = 10000;

// The server response owns inventory. Presentation must never delay or undo it.
export async function completeDemoUpgrade(options) {
  let response;
  try {
    response = await options.request();
    options.adopt(response);
  } catch (error) {
    // A lost response does not imply that the server rejected the operation.
    try { await options.refresh(); options.reset(); } catch {}
    throw error;
  }
  const controller = new AbortController();
  const visibility = options.visibility;
  let timer, onHidden;
  const interrupted = new Promise(resolve => {
    onHidden = () => { if (visibility?.hidden) { controller.abort(); resolve(); } };
    visibility?.addEventListener('visibilitychange', onHidden);
    timer = setTimeout(() => { controller.abort(); resolve(); }, options.maxAnimationMs ?? UPGRADE_ANIMATION_TIMEOUT_MS);
    onHidden();
  });
  try {
    if (!controller.signal.aborted) {
      await Promise.race([Promise.resolve().then(() => options.animate(response, controller.signal)), interrupted]);
    }
  } catch (error) {
    options.onAnimationError?.(error);
  } finally {
    controller.abort();
    clearTimeout(timer);
    visibility?.removeEventListener('visibilitychange', onHidden);
    options.reset();
  }
  return response;
}
