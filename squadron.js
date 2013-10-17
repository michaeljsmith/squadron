// Create the canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
canvas.width = 512;
canvas.height = 480;
document.body.appendChild(canvas);

var NUM_SQUARES = 100;
var SQUARE_SIZE = 20;
var SQUARE_SPEED_MAX = 10;

var squares = new Array();
for (var i = 0; i < NUM_SQUARES; ++i) {
  var x = Math.random() * (canvas.width - SQUARE_SIZE);
  var y = Math.random() * (canvas.height - SQUARE_SIZE);
  var vx = (2 * Math.random() - 1) * SQUARE_SPEED_MAX;
  var vy = (2 * Math.random() - 1) * SQUARE_SPEED_MAX;
  squares[i] = [x, y, vx, vy];
}

function updateTimers(dt) {
  for (var i = 0; i < squares.length; ++i) {
    squares[i][0] += dt * squares[i][2];
    if (squares[i][0] < 0 && squares[i][2] < 0) {
      squares[i][2] *= -1;
    }
    if (squares[i][0] + SQUARE_SIZE >= canvas.width && squares[i][2] > 0) {
      squares[i][2] *= -1;
    }

    squares[i][1] += dt * squares[i][3];
    if (squares[i][1] < 0 && squares[i][3] < 0) {
      squares[i][3] *= -1;
    }
    if (squares[i][1] + SQUARE_SIZE >= canvas.height && squares[i][3] > 0) {
      squares[i][3] *= -1;
    }
  }
};

function render() {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#FF0000";
  for (var i = 0; i < squares.length; ++i) {
    ctx.fillRect(squares[i][0], squares[i][1], 20, 20);
  }
};

// The main game loop
var lastTime = Date.now();
function update() {
    var now = Date.now();
    var dt = (now - lastTime) / 1000.0;

    updateTimers(dt);
    render();

    lastTime = now;
};

function runAnimLoop(fn) {
  function run() {
    fn();
    window.webkitRequestAnimationFrame(run);
  };

  window.webkitRequestAnimationFrame(run);
};

runAnimLoop(update);
