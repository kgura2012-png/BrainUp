// Coalesce high-frequency input into one paint; values are updated by callers immediately.
export function createFrameScheduler(paint, schedule) {
  let pending = false;
  return function () {
    if (pending) return;
    pending = true;
    schedule(() => { pending = false; paint(); });
  };
}

export function beginRequestFeedback(button, label) {
  if (!button || !button.isConnected) return () => {};
  const disabled = button.disabled;
  const busy = button.getAttribute('aria-busy');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.setAttribute('data-request-pending', label);
  return () => {
    button.disabled = disabled;
    button.removeAttribute('data-request-pending');
    if (busy === null) button.removeAttribute('aria-busy');
    else button.setAttribute('aria-busy', busy);
  };
}

// Delegate to the document so rebuilt drawer buttons keep the same feedback.
export function installNavigationFeedback(root, motionAllowed) {
  const selector = '#wide-navigation [data-header-section], #bu-drawer [data-sec], #bu-head .brainup-brand';
  const animations = new WeakMap();
  let pressed = null;
  const target = event => {
    const button = event.target?.closest?.(selector);
    return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true' ? button : null;
  };
  function release() {
    pressed?.classList.remove('navigation-pressed');
    pressed = null;
  }
  function animate(button) {
    if (!button || !motionAllowed() || !button.animate) return;
    animations.get(button)?.cancel();
    animations.set(button, button.animate([
      {transform:'translateY(2px) scale(.94)',offset:0},
      {transform:'translateY(-1px) scale(1.025)',offset:.62},
      {transform:'translateY(0) scale(1)',offset:1}
    ], {duration:280,easing:'cubic-bezier(.2,.75,.3,1)'}));
    const dragon = button.querySelector('.brand-dragon img');
    if (dragon?.animate) {
      animations.get(dragon)?.cancel();
      animations.set(dragon, dragon.animate([
        {transform:'translateY(-2px) rotate(0deg)'},
        {transform:'translateY(-6px) rotate(-7deg)',offset:.4},
        {transform:'translateY(-2px) rotate(0deg)'}
      ], {duration:360,easing:'cubic-bezier(.2,.75,.3,1)'}));
    }
  }
  root.addEventListener('pointerdown', event => {
    if (event.isPrimary === false || event.button !== 0) return;
    release();
    pressed = target(event);
    if (pressed) animations.get(pressed)?.cancel();
    pressed?.classList.add('navigation-pressed');
  }, {capture:true,passive:true});
  root.addEventListener('pointerup', release, {capture:true,passive:true});
  root.addEventListener('pointercancel', release, {capture:true,passive:true});
  root.addEventListener('click', event => animate(target(event)), true);
  root.addEventListener('keydown', event => {
    const button = target(event);
    if (!button || event.repeat || !['Enter',' '].includes(event.key)) return;
    // Native buttons produce click themselves; the logo is a span with role=button.
    if (button.matches('.brainup-brand')) animate(button);
  }, true);
  root.defaultView?.addEventListener('blur', release);
}
