'use strict';
/* =================================================================
   8. DISPLAY MODE (for the projector)
   Hides the side menus and editing controls, enlarges names, the picker, timer and noise meter,
   and goes full screen where the browser allows. Esc or the Exit button leaves it.
   Nothing confidential is shown on the projector: the seating plan drops its front-priority, lock and
   rule markers, groups don't flag rule clashes, and the Students and Home learning tabs (rules,
   front priority, who hasn't handed work in) are hidden.
================================================================= */
let presentFullscreen = false;
const PRIVATE_TABS = ['students', 'homework']; // never shown on the projector
function setPresent(on) {
  ui.present = on;
  document.body.classList.toggle('present', on);
  if (on && PRIVATE_TABS.includes(ui.tab)) ui.tab = 'plan';
  $('#presentExit').hidden = !on;
  if (on) {
    const req = document.documentElement.requestFullscreen;
    if (req) document.documentElement.requestFullscreen().then(() => { presentFullscreen = true; }).catch(() => { presentFullscreen = false; });
  } else {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    presentFullscreen = false;
  }
  pit.balls = []; // the ball pit is a different size now
  render();
}
function bindPresent() {
  $('#presentBtn').addEventListener('click', () => setPresent(!ui.present));
  $('#presentExit').addEventListener('click', () => setPresent(false));
  // Esc in full screen is taken by the browser to leave full screen; leave display mode with it.
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && presentFullscreen && ui.present) setPresent(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.present && !$('.modal-bg') && !menuEl) setPresent(false); });
}
