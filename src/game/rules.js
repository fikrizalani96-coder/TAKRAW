// ISTAF Regu rules engine (pure logic, no rendering).
//  * Rally-point scoring. Set to 21 (deuce at 20-20, cap 25); deciding 3rd set to 15 (deuce 14-14, cap 17).
//  * Best of three sets. Teams change sides after each set; in the deciding set at 8 points.
//  * Service passes to the opponent after 3 consecutive services; from deuce serves alternate every rally.
//  * Max 3 touches per team, a player may touch at most twice in succession, a block is not a touch.
//  * Service faults: tosses/serves that fail to cross, land out, cross outside the net tapes, pass under the net,
//    touch a teammate first, tekong foot faults. A serve that touches the net but lands in is good.
import { MATCH_FORMATS } from './config.js';

export class MatchRules {
  constructor(format = 'istaf', opts = {}) {
    this.fmt = typeof format === 'string' ? MATCH_FORMATS[format] : format;
    this.rotation = opts.serveRotation ?? 3;
    this.sets = [0, 0];
    this.setIndex = 0;
    this.points = [0, 0];
    this.setHistory = [];
    this.serving = opts.firstServer ?? 0;
    this.servesInTurn = 0;
    this.sidesFlipped = false;          // toggled at each side change; team 0 starts on +z (near camera)
    this.sideChangedInDeciding = false;
    this.matchWinner = -1;
    this.setWinner = -1;
    this.firstServerOfMatch = this.serving;
    this.log = [];
    this._begin();
  }
  get deciding() { return this.fmt.setsToWin > 1 && this.setIndex === this.fmt.points.length - 1 && this.sets[0] === this.fmt.setsToWin - 1 && this.sets[1] === this.fmt.setsToWin - 1; }
  get target() { return this.fmt.points[Math.min(this.setIndex, this.fmt.points.length - 1)]; }
  get cap() { return this.fmt.cap[Math.min(this.setIndex, this.fmt.cap.length - 1)]; }
  get deuceAt() { return this.fmt.deuce[Math.min(this.setIndex, this.fmt.deuce.length - 1)]; }
  get isDeuce() { return this.points[0] >= this.deuceAt && this.points[1] >= this.deuceAt && this.points[0] === this.points[1]; }
  get inDeuceZone() { return this.points[0] >= this.deuceAt && this.points[1] >= this.deuceAt; }
  /** sign of the z half owned by a team (+1 near camera). */
  sideOf(team) { return (team === 0) === !this.sidesFlipped ? 1 : -1; }
  teamOnSide(sign) { return this.sideOf(0) === sign ? 0 : 1; }
  _begin() { this.points = [0, 0]; this.servesInTurn = 0; this.setWinner = -1; this.sideChangedInDeciding = false; }

  /** Award a rally to `team`. Returns {setOver, matchOver, changeSides, deuce, serverChanged}. */
  awardPoint(team, reason = '') {
    this.points[team]++;
    this.log.push({ set: this.setIndex, team, reason, score: [...this.points] });
    const res = { setOver: false, matchOver: false, changeSides: false, deuce: false, serverChanged: false, team };
    const p = this.points[team], o = this.points[1 - team];
    if (p >= this.target && (p - o >= 2 || p >= this.cap)) {
      this.sets[team]++;
      this.setHistory.push([...this.points]);
      this.setWinner = team;
      res.setOver = true;
      if (this.sets[team] >= this.fmt.setsToWin) { this.matchWinner = team; res.matchOver = true; }
      return res;
    }
    // deciding-set side change at 8
    if (this.deciding && !this.sideChangedInDeciding && (this.points[0] >= 8 || this.points[1] >= 8) && this.fmt.setsToWin > 1) {
      this.sideChangedInDeciding = true; this.sidesFlipped = !this.sidesFlipped; res.changeSides = true;
    }
    // service rotation
    this.servesInTurn++;
    if (this.inDeuceZone && this.points[0] === this.points[1]) res.deuce = true;
    const limit = this.inDeuceZone ? 1 : this.rotation;
    if (this.servesInTurn >= limit) { this.serving = 1 - this.serving; this.servesInTurn = 0; res.serverChanged = true; }
    return res;
  }

  /** Start the next set (after side change). */
  nextSet(coinToss = 0) {
    this.setIndex++;
    this._begin();
    this.sidesFlipped = !this.sidesFlipped;
    // 2nd set: the team that did not serve first; deciding set: coin toss
    const decidingNext = this.fmt.setsToWin > 1 && this.sets[0] === this.fmt.setsToWin - 1 && this.sets[1] === this.fmt.setsToWin - 1;
    this.serving = decidingNext ? coinToss : 1 - this.firstServerOfMatch;
  }
  get scoreText() { return `${this.points[0]}-${this.points[1]}`; }
}

/**
 * Adjudicates a single rally. The match controller feeds physical events; the rally answers
 * with faults/outcomes.
 */
export class RallyRules {
  constructor(rules, servingTeam, opts = {}) {
    this.rules = rules; this.serving = servingTeam;
    this.phase = 'toss';                 // toss -> serve -> inplay -> dead
    this.touches = [];                   // {team, player, block}
    this.possession = servingTeam;       // team allowed to touch next
    this.count = 0;                      // touches by the possession team since last change
    this.lastPlayer = null; this.lastPlayerRun = 0;
    this.lastToucher = null;             // {team, player}
    this.crossed = false;
    this.result = null;
    this.serveContactTeam = null;
    this.floorHits = 0;
  }
  _end(winner, reason) { if (!this.result) { this.result = { winner, reason }; this.phase = 'dead'; } return this.result; }

  serveTouch(team, player) {
    this.phase = 'serve';
    this.lastToucher = { team, player };
    this.count = 0; this.crossed = false;
    this.touches.push({ team, player, serve: true });
  }
  /** Any touch after the service. `block` touches do not count against the three-touch limit. */
  touch(team, player, block = false) {
    if (this.result) return this.result;
    if (this.phase === 'serve') {
      // service must cross the net first: touching it with a teammate is a fault
      if (!this.crossed) {
        if (team === this.serving) return this._end(1 - team, 'Service fault: touched by teammate');
      }
      this.phase = 'inplay';
    }
    this.phase = 'inplay';
    if (team !== this.possession) { this.possession = team; this.count = 0; this.lastPlayer = null; this.lastPlayerRun = 0; }
    this.lastToucher = { team, player };
    this.touches.push({ team, player, block });
    if (block) { this.lastPlayer = null; this.lastPlayerRun = 0; this.count = 0; return null; }
    this.count++;
    if (this.count > 3) return this._end(1 - team, 'Four touches');
    if (player === this.lastPlayer) { this.lastPlayerRun++; if (this.lastPlayerRun > 2) return this._end(1 - team, 'Player touched the ball three times in succession'); }
    else { this.lastPlayer = player; this.lastPlayerRun = 1; }
    return null;
  }
  ballCrossed(x, y, fromSign) {
    // crossing the net plane inside the net tapes and above the net is legal
    const tapeX = 3.05 + 0.01;
    if (Math.abs(x) > tapeX) { const t = this.lastToucher ? this.lastToucher.team : this.serving; return this._end(1 - t, 'Ball crossed outside the net tape'); }
    this.crossed = true;
    if (this.phase === 'serve') { /* serve is now in the receiving court's airspace */ }
    return null;
  }
  netFault(team, why = 'Net touch') { return this._end(1 - team, why); }
  footFault(team, why = 'Service foot fault') { return this._end(1 - team, why); }
  /** ball went dead through the ceiling/post/under-net etc; last toucher's team loses */
  ballDead(reason) { const t = this.lastToucher ? this.lastToucher.team : this.serving; return this._end(1 - t, reason); }
  ballLanded(x, z, sideTeamFn) {
    if (this.result) return this.result;
    const inX = Math.abs(x) <= 3.05 + 0.04, inZ = Math.abs(z) <= 6.7 + 0.04;
    const t = this.lastToucher ? this.lastToucher.team : this.serving;
    if (!inX || !inZ) return this._end(1 - t, this.phase === 'serve' ? 'Service fault: ball out' : 'Ball out');
    const landedTeam = sideTeamFn(Math.sign(z) || 1);
    if (this.phase === 'toss') return this._end(1 - this.serving, 'Service fault: missed the ball');
    if (this.phase === 'serve' && landedTeam === this.serving) return this._end(1 - this.serving, 'Service fault: ball did not cross the net');
    return this._end(1 - landedTeam, 'Ball landed in court');
  }
}
