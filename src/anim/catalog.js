// Animation catalogue: every family registers its parametric clips here.
import { registerKicks } from './builders/kicks.js';
import { registerBodyContacts } from './builders/bodycontact.js';
import { registerJumps } from './builders/jumps.js';
import { registerLocomotion } from './builders/locomotion.js';
import { registerGround } from './builders/ground.js';
import { registerToss } from './builders/toss.js';
import { registerGestures, registerOfficials, registerFreestyle } from './builders/gestures.js';
export { getClip, clipCount, allEntries, categoryCounts, findEntries } from './clip.js';
let done = false;
export function buildCatalog() {
  if (done) return; done = true;
  registerKicks();
  registerBodyContacts();
  registerJumps();
  registerLocomotion();
  registerGround();
  registerToss();
  registerGestures();
  registerOfficials();
  registerFreestyle();
}
buildCatalog();
