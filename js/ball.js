/**
 * Everything dealing with balls.
 */
(function() {
  "use strict";

  var Game = window.Game;

  var Sprite = Game.Sprite;
  var Screen = Game.Screen;

  /**
   * A sprite representing a ball.
   *
   * @param {string} id The id of the DOM element manipulated by
   * this Sprite.
   * @constructor inherits from Sprite
   */
  function Ball(id, pads) {
    // Inherit constructor
    Sprite.call(this, id);

    // We start our balls with some temporary CSS.
    // Replaced by "regular" on first display.
    this.kind = "init";
    this.nextKind = "regular";

    // The unit vector of speed for this ball
    this.event.dx = 0;
    this.event.dy = 0;

    // Information on bouncing
    this.bounceX = new Bouncer(this, pads);
    this.bounceY = new Bouncer(this, pads);

    this.previousDistanceToVortex = 0;
    this.distanceToVortex = 0;
  }
  // Inherit prototype
  Ball.prototype = Object.create(Sprite.prototype);

  /**
   * An object holding information regarding bouncing along vertical
   * obstacles (respectively horizontal obstacles).
   */
  function Bouncer(ball, pads) {
    this.ball = ball;
    this.pads = pads;
    this.bounceOnWall = false;
    this.bounceOnPad = false;
    this.bounceOnVortex = false;

    /**
     * An indication of how we need to bounce this ball against a
     * vertical (respectively horizontal) obstacle, as a number
     * between -1 (bounce somewhat towards the North, respectively
     * West) and 1 (bounce somewhat towards the South, respectively
     * East) or NaN if the ball didn't bounce at all on a vertical
     * (respectively vertical) obstacle.
     *
     * Used to represent bouncing on non-flat surfaces.
     */
    this.bounce = NaN;
  }

  /**
   * Determine whether the ball is colliding with any wall or pad,
   * update internal state accordingly.
   *
   * @param {bool} wall Whether the ball is colliding with a wall
   * already.
   * @param {string} comingFrom The direction from which the
   * ball is coming, one of "N", "S", "E", "W".
   * @param {Sprite} exclude A pad to exclude from the search as we
   * already know no collision can take place with that pad.
   */
  Bouncer.prototype.check = function(wall, comingFrom, exclude) {
    if (wall) {
      this.bounceOnWall = true;
      this.bounceOnPad = false;
      this.bounceOnVortex = false;
      this.bounce = 0;
      return;
    }
    for (var index in this.pads) {
      var pad = this.pads[index];
      if (pad == exclude) {
        continue;
      }
      var bounce = pad.getCollisionWith(comingFrom, this.ball);
      if (!Number.isNaN(bounce)) {
        this.bounceOnWall = false;
        this.bounceOnPad = true;
        this.bounceOnVortex = false;
        this.bounce = bounce;
        return;
      }
    }
    this.bounceOnWall = false;
    this.bounceOnPad = false;
    this.bounceOnVortex = false;
    this.bounce = NaN;
  };

  /**
   * A list of CSS values for colors for the ball.
   */
  var BALL_KINDS = ['regular', 'black', 'white'];

  /**
   * Change the color of the ball. This function is called when a ball touch a pad.
   * The color is taken randomly from tabColors.
   */
  Ball.prototype.changeBallColor = function() {
    var i = Math.floor(Math.random() * BALL_KINDS.length);
    var className = BALL_KINDS[i];
    this.nextKind = className;
    console.log("Switching to class", className);
  };

  /**
   * Update the current speed unit vector of the ball.
   */
  Ball.prototype.updateVector = function() {
    var bounceX = this.bounceX.bounce;
    var bounceY = this.bounceY.bounce;
    if (Number.isNaN(bounceX) && Number.isNaN(bounceY)) {
      // No bounce at all, don't change the vector.
      return;
    }
    var dx2, dy2, dangle;
    if (Number.isNaN(bounceX)) {
      // No horizontal bounce
      dx2 = this.event.dx;
      dy2 = - this.event.dy;
      dangle = - bounceY / 4;
    } else if (Number.isNaN(bounceY)) {
      // No vertical bounce
      dx2 = - this.event.dx;
      dy2 = this.event.dy;
      dangle = bounceX / 4;
    } else {
      dx2 = - this.event.dx;
      dy2 = - this.event.dy;
      dangle = 0;
    }

    this.event.dxOld = this.event.dx;
    this.event.dyOld = this.event.dy;

    var simpleAngle = Game.Utils.getAngle(dx2, dy2);

    this.event.angle = simpleAngle + dangle;
    this.event.dx = Math.cos(this.event.angle);
    this.event.dy = Math.sin(this.event.angle);

    Game.Debug.drawBounce(this, simpleAngle);
  };

  /**
   * Determine whether the ball is bouncing on a pad or a wall.
   * Update internal state accordingly.
   *
   * @param {Sprite} padNorth
   * @param {Sprite} padSouth
   * @param {Sprite} padEast
   * @param {Sprite} padWest
   */
  Ball.prototype.checkBounces = function(padNorth, padSouth, padEast, padWest) {
    if (this.event.dx < 0) {
      this.bounceX.check(this.x <= 0, "E", padEast);
    } else if (this.event.dx > 0) {
      this.bounceX.check(this.E >= Screen.width, "W", padWest);
    }

    if (this.event.dy < 0) {
      this.bounceY.check(this.y <= 0, "S", padSouth);
    } else if (this.event.dy > 0) {
      this.bounceY.check(this.S >= Screen.height, "N", padNorth);
    }
  };

  /**
   * Determine whether the ball is entering the vortex, update
   * internal state accordingly.
   *
   * The ball is entering the vortex if during the previous call, the
   * distance between centers was greater than the sum of radiuses, and
   * during this call, the distance is now lesser.
   *
   * @param {Sprite} vortex
   * @return {boolean} true if the ball is entering the vortex on this
   * call, false if the ball is out of the vortex or was already in the
   * vortex.
   */
  Ball.prototype.isEnteringVortex = function(vortex) {
    this.previousDistanceToVortex = this.distanceToVortex;
    this.distanceToVortex = this.getDistanceBetweenCenters(vortex) -
      (vortex.width + this.width) / 2;
    if (this.previousDistanceToVortex <= 0 || this.distanceToVortex > 0) {
      return false;
    }
    this.bounceX.bounceOnVortex = true;
    this.bounceX.bounce = 0;
    this.bounceY.bounceOnVortex = true;
    this.bounceY.bounce = 0;
    return true;
  };

  /**
   * Prepare two balls to be launched on the next frame.
   */
  Ball.prototype.reproduce = function() {
    var angle = Game.Utils.getAngle(
        this.centerX - Screen.width / 2,
        this.centerY - Screen.height / 2);
    var angle1 = angle + 2 * Math.PI / 3;
    var angle2 = angle - 2 * Math.PI / 3;
    Ball._pendingPairs.push(angle1, angle2);
  };

  /**
   * All the balls currently on screen.
   */
  Ball.balls = [];

  /**
   * All balls tagged for removal
   */
  Ball.toRemove = [];

  // The number of balls already launched.
  // Used to generate id of new balls.
  Ball._counter = 0;

  // The balls prepared but not launched yet.
  // These balls will be launched on the next call to Ball.flushPending
  Ball._pendingBalls = [];

  Ball._pendingPairs = [];

  /**
   * Determine whether we are out of balls.
   *
   * @return {boolean} true if there are no more balls on the screen,
   * nor balls about to be displayed.
   */
  Ball.isEmpty = function() {
    return Ball.balls.length == 0
      && Ball._pendingBalls.length == 0
      && Ball._pendingPairs.length == 0;
  };

  /**
   * Remove a ball in the array
   */
  Ball.remove = function(ball) {
    for (var key in Ball.balls) {
      if (Ball.balls[key].id == ball.id) {
        Ball.toRemove.push(ball);
        Ball.balls.splice(key, 1);
        break;
      }
    }
  };

  /**
   * Prepare a new ball for launch.
   *
   * @Note This function performs DOM writes.
   */
  Ball.preparePairs = function(screen) {
    while (Ball._pendingPairs.length
           && Ball.balls.length < Game.Config.maxNumberBalls) {
      var angle = Ball._pendingPairs.shift();
      var id = "ball_" + Ball._counter++;
      var element = document.createElement("div");
      element.id = id;
      element.classList.add("ball");
      element.classList.add("sprite");
      element.classList.add("init");
      element.classList.add("regular");
      // FIXME: Use the angle
      screen.appendChild(element);
      this._pendingBalls.push(id);
    }
  };

  /**
   * Prepare a new random ball.
   */
  Ball.introduce = function() {
    Ball._pendingPairs.push(null);
  };

  /**
   * Launch any prepared ball.
   */
  Ball.flushPending = function(pads) {
    if (!this._pendingBalls.length) {
      return;
    }
    var id = this._pendingBalls.pop();
    var ball = new Ball(id, pads);

    // Set up initial position
    ball.xpos = "center";
    ball.ypos = "center";

    // Set up initial vector
    var angle;
    if (Game.Config.Debug.startAngle == null) {
      angle = 2 * Math.random() * Math.PI;
    } else {
      angle = Game.Config.Debug.startAngle;
    }
    ball.event.angle = angle;
    ball.event.dx = Math.cos(ball.event.angle);
    ball.event.dy = Math.sin(ball.event.angle);
    ball.event.speed = Game.Config.initialBallSpeed;
    // Hack: Initially, we actually display the ball on the top left
    // but we want everything to happen as if it were centered.
    ball.x = ball.nextX;
    ball.y = ball.nextY;

    Ball.balls.push(ball);
    Sprite.all.push(ball);
  };

  Game.Ball = Ball;
})();
