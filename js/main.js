(function bouncer() {
  "use strict";

  var Game = window.Game;

  var $ = document.getElementById.bind(document);
  var screen = $("screen");
  var eltMessage = $("message");
  var eltScore = $("score");
  var eltMultiplier = $("multiplier");
  var eltHealth = $("health");
  var eltVortex = $("vortex");

  /**
   * The time at which some events happened, in milliseconds since the epoch.
   */
  var timeStamps = {
    /**
     * The start of the game
     */
    gameStart: Date.now(),

    /**
     * Instant at which the previous frame started being prepared
     */
    previousFrame: Date.now() - 15,

    /**
     * Instant at which the current frame started being prepared
     */
    currentFrame: Date.now(),

   /**
     * Instant at the lastest score multiplier update
     */
    lastestMultiplierUpdate: Date.now(),
 };

  /**
   * The different scores and the multiplier of the current game
   */
  var score = {
    /**
     * The score of the older frame
     */
    previous: -1,

    /**
     * The score in the current frame
     */
    current: 0,

    /**
     * The score multiplier, increase when the game lasts longer
     */
    multiplier: 1,
  };

  var Screen = Game.Screen;
  var Sprite = Game.Sprite;
  var Pad = Game.Pad;
  var Ball = Game.Ball;
  Ball.introduce();

  // Initialize sprites
  var padNorth = Pad.padNorth = new Pad("pad_north");
  var padSouth = Pad.padSouth = new Pad("pad_south");
  var padEast = Pad.padEast = new Pad("pad_east");
  var padWest = Pad.padWest = new Pad("pad_west");

  padNorth.setPosition("center", "top");
  padSouth.setPosition("center", "bottom");
  padEast.setPosition("left", "center");
  padWest.setPosition("right", "center");

  // Shortcut: an array with all the pads
  var pads = [padNorth, padSouth, padEast, padWest];

  for (var index in pads) {
    Sprite.all.push(pads[index]);
  }

  var vortex = new Game.Vortex("vortex");
  vortex.setPosition("center", "center");
  Sprite.all.push(vortex);

  Sprite.all.forEach(function (sprite) {
    sprite.writeToDOM();
  });


  // Handle events

  function onmove(e) {
    for (var index in pads) {
      pads[index].event.pageX = e.pageX;
      pads[index].event.pageY = e.pageY;
    }
    e.stopPropagation();
    e.preventDefault();
  }
  function ontouch(e) {
    onmove(e);
    Pause.resume();
  }
  window.addEventListener("mousemove", onmove);
  window.addEventListener("mouseup", ontouch);
  window.addEventListener("touchstart", ontouch);
  window.addEventListener("touchmove", ontouch);

  /**
   * An object centralizing pause information.
   */
  var Pause = Game.Pause = {
    /**
     * true if the game is on pause, false otherwise
     */
    isPaused: false,

    /**
     * Put the game on pause.
     *
     * Has no effect if the game is already on pause.
     */
    start: function() {
      Pause.isPaused = true;
      eltMessage.classList.add("visible");
      eltMessage.textContent = "Pause";
      eltVortex.classList.add("pauseanimation");
    },

    /**
     * Resume the game.
     *
     * Has no effect if the game is not on pause.
     */
    resume: function() {
      if (!Pause.isPaused) {
        return;
      }
      Pause.isPaused = false;
      eltMessage.classList.remove("visible");
      eltVortex.classList.remove("pauseanimation");

      // Make sure that the game doesn't freak out by launching balls,
      // increasing speed, etc.
      var now = Date.now();
      timeStamps.previousFrame = now - 15;
      timeStamps.currentFrame = now;

      // Resume game
      requestAnimationFrame(loop);
    },

    /**
     * Switch between on pause/out of pause.
     */
    revert: function() {
      if (Pause.isPaused) {
        Pause.resume();
      } else {
        Pause.start();
      }
    }
  };
  window.addEventListener("keydown", function(event) {
    var code = event.keyCode || event.which || null;
    if (code == null) {
      // No code information, this must be an old version of
      // Internet Explorer
      return;
    }
    if (code != window.KeyEvent.DOM_VK_SPACE) {
      // Not the space key
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    Pause.revert();
  });
  window.addEventListener("blur", function() {
    Pause.start();
  });


  var nextFrame = function() {

    // -------- Read from DOM -------------

    // All reads from DOM *must* happen before the writes to DOM.
    // Otherwise, we end up recomputing the layout several times
    // for a frame, which is very much not good.

    Screen.readFromDOM();
    Sprite.all.forEach(function (sprite) {
      sprite.readFromDOM();
    });

    Ball.flushPending(pads);

    // --------- Done reading from DOM ----


    var deltaT = timeStamps.currentFrame - timeStamps.previousFrame;

    // Return pause
    if (Pause.isPaused) {
      return false;
    }

    // Handle ball movement
    for (var index in Ball.balls) {
      var ball = Ball.balls[index];
      if (ball.isEnteringVortex(vortex)) {
        // The ball just entered the vortex
        ball.reproduce();
      } else {
        ball.checkBounces(padNorth, padSouth, padEast, padWest);
      }

      var collisionWithWall = ball.bounceX.bounceOnWall ||
        ball.bounceY.bounceOnWall;

      var collisionWithPad = !collisionWithWall &&
        ball.bounceX.bounceOnPad ||
        ball.bounceY.bounceOnPad;

      ball.updateVector();

      // Update the score multiplier every 10 secondes
      if (timeStamps.currentFrame - timeStamps.lastestMultiplierUpdate >= 10000) {
        score.multiplier += 0.5;
        timeStamps.lastestMultiplierUpdate = timeStamps.currentFrame;
      }
      
      // Update the current score
      if (collisionWithPad) {
        score.current += Game.Config.Score.bounceOnPad * score.multiplier;
      } else if (collisionWithWall) {
        score.current += Game.Config.Score.bounceOnWall;
        Ball.remove(ball);
      }
    }

    // Update position of sprites
    padNorth.nextX = padNorth.event.pageX - padNorth.width / 2;
    padNorth.nextX = Game.Utils.restrictToSegment(padNorth.nextX, 0,
                                                  Screen.width - padNorth.width);

    padSouth.nextX = padSouth.event.pageX - padSouth.width / 2;
    padSouth.nextX = Game.Utils.restrictToSegment(padSouth.nextX, 0,
                                                  Screen.width - padSouth.width);

    padEast.nextY = padEast.event.pageY - padEast.height / 2;
    padEast.nextY = Game.Utils.restrictToSegment(padEast.nextY, 0,
                                                 Screen.height - padEast.height);

    padWest.nextY = padWest.event.pageY - padWest.height / 2;
    padWest.nextY = Game.Utils.restrictToSegment(padWest.nextY, 0,
                                                 Screen.height - padWest.height);

    if (Screen.hasChanged()) {
      padNorth.ypos = "top";
      padSouth.ypos = "bottom";
      padEast.xpos = "right";
      padWest.xpos = "left";
      vortex.setPosition("center", "center");
    }

    for (index in Ball.balls) {
      ball = Ball.balls[index];
      ball.nextX = ball.x + Math.round(ball.event.dx * ball.event.speed * deltaT);
      ball.nextY = ball.y + Math.round(ball.event.dy * ball.event.speed * deltaT);
    }

    // FIXME: Handle health, win/lose

    // FIXME: Handle game speed

    // FIXME: Handle score

    // -------- Write to DOM -------------

    // Prepare new balls
    Ball.preparePairs(screen);

    // Update ball colors
    for (index in Ball.balls) {
      ball = Ball.balls[index];
      if (ball.bounceX.bounceOnPad || ball.bounceY.bounceOnPad) {
        ball.changeBallColor();
      }
    }
    Sprite.all.forEach(function (sprite) {
      sprite.writeToDOM();
    });
    if (Screen.hasChanged) {
      screen.style.width = Screen.width;
      screen.style.height = Screen.height;
    }
    // Update the score if it has changed
    if (score.current != score.previous) {
      eltScore.textContent = score.current + " pts";
      score.previous = score.current;
    }

    // Update the score multiplier if it has changed
    if (timeStamps.lastestMultiplierUpdate == timeStamps.currentFrame && score.multiplier > 1) {
      eltMultiplier.textContent = "x " + score.multiplier;
    }
    
    // Remove ball in the DOM if it ask to remove
    if (Ball.toRemove.length > 0) {
      for (index in Ball.toRemove) {
        screen.removeChild(Ball.toRemove[index].element);
      }
      Ball.toRemove.length = 0;
    }

    // -------- Write to DOM -------------

    return true;
  };

  nextFrame();

  // Main loop
  function loop() {
    timeStamps.previousFrame = timeStamps.currentFrame;
    timeStamps.currentFrame = Date.now();

    if (Ball.isEmpty() && !Game.Config.Debug.immortal) {
      if (score.current > 0) {
        var bestScore = localStorage.getItem("bestScore");

        if (score.current > bestScore) {
          eltMessage.textContent = 'New record: ' + score.current + " points !!!";
          eltMessage.classList.add("visible");
          localStorage.setItem("bestScore", score.current);
        } else {
          eltMessage.textContent = 'Congratulations, you have ' + score.current + " points !";
          eltMessage.classList.add("visible");
        }
      } else {
        eltMessage.textContent = 'You lose :-(';
        eltMessage.classList.add("visible");
      }
    } else {
      nextFrame();
      requestAnimationFrame(loop);
    }
  };
  requestAnimationFrame(loop);
})();


