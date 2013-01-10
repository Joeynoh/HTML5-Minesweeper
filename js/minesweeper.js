/*global $: true, console: true */

$(function(){
  "use strict";

/* =========================================== */
// --- Global & Default Variables ---
/* =========================================== */

var globals = {
  firstClick: true,
  gameover: false,
  canvas: null,
  context: null,
  totalMines: 0,
  totalFlags: 0,
  elapsedTime: 0,
  clock: '',
  restart: '',
  mineMap: '',
  flagMap: '',
  revealedMap: '',
  currentAnimation: '',
  previous: new Array(2),
  squaresX: '',
  squaresY: ''
},

defaults = {
  difficulty: 0,
  celSize: 20,
  width: 400,
  height: 400,
  background: 'white',
  font: '14px Arial',
  celColor: '#dadada',
  celStroke: 'white',
  celRadius: 5,
  mineImg: 'images/mine.png',
  flagImg: 'images/flag.png'
},

containers = {
  // In core.init(), we add containers.
};

/* =========================================== */
// --- Core Functions ---
/* =========================================== */

var core = {
  
  /* ------------------------------------------- */
  // -- Initiate function
  // -- Get the canvas and context, as well as
  // -- attach some listeners.
  // -- @return void
  /* ------------------------------------------- */
  
  init: function(){
    globals.canvas = $('#board');
    globals.context = globals.canvas[0].getContext("2d");
    globals.context.background = defaults.background;

    var ratio = this.hiDPIRatio();
    if (ratio !== 1) {
      var originalWidth = globals.canvas[0].width;
      var originalHeight = globals.canvas[0].height;

      globals.canvas[0].width = originalWidth * ratio;
      globals.canvas[0].height = originalHeight * ratio;
      globals.canvas.css({
        width: originalWidth + "px",
        height: originalHeight + "px"
      });

      globals.context.scale(ratio, ratio);
    }

    globals.context.font = defaults.font;
    
    defaults.width = globals.canvas.width();
    globals.squaresX = Math.floor(defaults.width / defaults.celSize);
    globals.squaresY = Math.floor(defaults.height / defaults.celSize);
    
    globals.mineMap = new Array(globals.squaresX);
    globals.flagMap = new Array(globals.squaresX);
    globals.revealedMap = new Array(globals.squaresX);
    
    containers.flags = $('#flags');
    containers.mines = $('#mines');
    containers.status = $('#status');
    containers.time = $('#time');
    containers.msg = $('#msg');
    containers.scoreboard = $('#scoreboard');
    
    containers.easy = $('#easybtn');
    containers.medium = $('#mediumbtn');
    containers.insane = $('#insanebtn');
    containers.switchscreens = $('#switchscreens');
    containers.reset = $('#reset');
    
    var difarr = { 9: containers.easy, 6: containers.medium, 3: containers.insane};
    
    $.each(difarr, function(index, value){
      value.on({
        click: function(){
          defaults.difficulty = index;
          util.switchScreens();
        }
      });
    });
    
    containers.switchscreens.on({
      click: function(){
        util.switchScreens();
      }
    });
    
    containers.reset.on({
      click: function(){
        core.reset();
      }
    });
  
    $('.gamescreen').hide();
    
    // Attach some listeners, at this point only mousedown
    globals.canvas.on({
      mouseup: function(e){
        action.click(e);
      },
      mousemove: function(e){
        action.hover(e);  
      }
    });
	
	// Some quick preloading of the mine and flag images
	var images = new Array();
	images[0] = new Image();
	images[0].src = defaults.mineImg;
	images[1] = new Image();
	images[1].src = defaults.flagImg;
    
    // Initialize the board
    core.setup();
    
    //animation.arrow();

  },

  hiDPIRatio: function() {
    var devicePixelRatio, backingStoreRatio;

    devicePixelRatio = window.devicePixelRatio || 1;
    backingStoreRatio = globals.context.webkitBackingStorePixelRatio ||
                        globals.context.mozBackingStorePixelRatio ||
                        globals.context.msBackingStorePixelRatio ||
                        globals.context.oBackingStorePixelRatio ||
                        globals.context.backingStorePixelRatio || 1;

    return devicePixelRatio / backingStoreRatio;
  },
  
  /* ------------------------------------------- */
  // -- Reset function
  // -- Resets the game, clears the timers, etc.
  // -- @return void
  /* ------------------------------------------- */
  
  reset: function(){  
    
    // Clear the timer
    window.clearInterval(globals.clock);
    window.clearInterval(globals.restart);
  
    // Wipe the canvas clean
    globals.context.clearRect(0,0,defaults.width,defaults.height);
    
    // Reset all global vars to their default value
    globals.gameover = false;
    globals.firstClick = true;
    globals.totalMines = 0;
    globals.totalFlags = 0;
    globals.elapsedTime = 0;
    globals.mineMap = new Array(globals.squaresX);
    globals.flagMap = new Array(globals.squaresX);
    globals.revealedMap = new Array(globals.squaresX);
    
    // Clear certain containers
    containers.flags.html('');
    containers.mines.html('');
    containers.status.html('Game on :)');
    containers.time.html('0');
    containers.msg.html('Click on a square to start the game!');
    
    // Initialize the board
    core.setup();
    
    window.clearInterval(globals.currentAnimation);
    animation.walker();
  },
  
  /* ------------------------------------------- */
  // -- Setup function
  // -- Sets up certain variables and draws the 
  // -- board. Used during both init() and reset()
  // -- @return void
  /* ------------------------------------------- */
  
  setup: function(){
    // Clear flagMap array
    for(var k = 0; k < globals.squaresX; k++){
      globals.flagMap[k] = Array(globals.squaresY);
      globals.revealedMap[k] = Array(globals.squaresY);
    }
    
    scores.display();
    
    // Make sure proper styles are set
    globals.context.strokeStyle = defaults.celStroke;
    globals.context.fillStyle = defaults.celColor;
    
    animation.standardBoard();
  },
  
  /* ------------------------------------------- */
  // -- Timer function
  // -- Starts the clock
  // -- @return void
  /* ------------------------------------------- */
  
  timer: function(){
    // Setup global var timer
    globals.clock = setInterval(function(){
      globals.elapsedTime++;
      // Append time to #time
      containers.time.html(globals.elapsedTime);
    }, 1000); 
  }
};

/* =========================================== */
// --- Action Functions ---
/* =========================================== */

var action = {
  
  /* ------------------------------------------- */
  // -- Click function
  // -- listens to right and left mouse clicks
  // -- and determines the proper cel and what 
  // -- action to take.
  // -- @return void
  /* ------------------------------------------- */
  
  click: function(e){  
  
    if(globals.gameover){
			return false;
		}
    
    // Calculate x & y relevant to the cel size, also (l) check if current x,y combo has already been revealed
    var x = Math.floor((e.pageX - globals.canvas[0].offsetLeft - 1) / defaults.celSize),
      	y = Math.floor((e.pageY - globals.canvas[0].offsetTop - 1) / defaults.celSize),
      	l = (globals.revealedMap[x][y]) ? 1 : -1;
    
    // If left-click, not a flag and the game is still going on
    if(e.which === 1 && globals.flagMap[x][y] !== 1 && defaults.difficulty !== 0){
      
      // Is this the first click of the game?
      if(globals.firstClick === true){
        
        window.clearInterval(globals.currentAnimation);
        animation.standardBoard();
        
        // Set difficulty, based on default and difficulty selector, and start the timer
        //defaults.difficulty = containers.difficulty.val();
        core.timer();
        
        // Keep generating possible minemaps till one is generate where the square first clicked is not a mine
        do{
          action.generateMines(globals.mineMap); 
        }while(globals.mineMap[x][y] === -1);
        
        // Set number of mines
        containers.mines.html('You have to find ' + globals.totalMines + ' mines to win.');
        globals.firstClick = false;
      }
      
      // Activate index function. See below for more details
      action.index(x, y);
    
		// If middle-click and a revealed square
  	}else if(e.which === 3 && util.is('revealed', x, y)){
	  
			// Calculate number of surrounding mines
			var num = 0,
					surrounded = new Array(),
					xArr = [x, x + 1, x - 1],
					yArr = [y, y + 1, y - 1];
			
			for(var a = 0; a < 3; a++){
				for(var b = 0; b < 3; b++){
			
        	if(util.is('flag', xArr[a], yArr[b])){
				  	num++;	  
          }else{
		  			surrounded.push([xArr[a], yArr[b]]);  
		  		}
        }
      }
	  
			// Compare with number of actual mines
			if(num === globals.mineMap[x][y]){
				$.each(surrounded, function(){
					// Remove non-flagged squares, using action.index	
					action.index(this[0], this[1]);	  
				});
			}
		
			// If right-click, game is not over, square has not been revealed and this is not the first click	
		}else if(e.which === 3 && l < 0 && globals.firstClick !== true){
      
      // Flag the square
      var flag = new Image();
      flag.src = defaults.flagImg;
      flag.onload = function(){
        action.flag(flag,x,y);
      };
    } 
  },
  
  /* ------------------------------------------- */
  // -- Hover function
  // -- Speaks for itself
  // -- @return void
  /* ------------------------------------------- */
  
  hover: function(e){
    
		if(!globals.gameover){
			// Calculate x & y relevant to the cel size, also (l) check if current x,y combo has already been revealed
			var x = Math.floor((e.pageX - globals.canvas[0].offsetLeft - 1) / defaults.celSize),
				y = Math.floor((e.pageY - globals.canvas[0].offsetTop - 1) / defaults.celSize),
				l = (globals.revealedMap[x][y]) ? 1 : -1,
				f = (globals.flagMap[x][y]) ? 1 : -1;
			
			var pX = globals.previous[0],
				pY = globals.previous[1];
			
			if(typeof pX !== 'undefined' && globals.revealedMap[pX][pY] !== 1 && globals.flagMap[pX][pY] !== 1){
				globals.context.fillStyle = defaults.celColor;
				util.roundRect(globals.previous[0], globals.previous[1]); 
			}
			
			if(l < 0 && f < 0 && !globals.firstClick){
				
				globals.context.fillStyle = '#aaa';
				util.roundRect(x, y);
				globals.previous[0] = x;
				globals.previous[1] = y;
			}
		}
  },
  
  /* ------------------------------------------- */
  // -- Index function
  // -- Used to determine whether square is a mine
  // -- or not 
  // -- @return void
  /* ------------------------------------------- */
  
  index: function(x, y){
    
    // If square is not revealed, is within boundaries and exists
    if(x >= 0 && y >= 0 && x <= globals.squaresX && y <= globals.squaresY && globals.mineMap[x] !== undefined){
      
      var l = (globals.revealedMap[x][y]) ? 1 : -1;
      
      if(!util.is('revealed', x, y)){
        
        // Add revealed square to the revealed array
        globals.revealedMap[x][y] = 1;
        
				if(globals.mineMap[x][y] !== -1){
					// 'remove square', by drawing a white one over it
					var alpha = 0.1,
					squareFade = setInterval(function(){
						globals.context.strokeStyle = 'white';
						globals.context.fillStyle = 'rgba(255,255,255,' + alpha + ')';
						util.roundRect(x, y);
							
						if(globals.mineMap[x][y] !== -1){
					
							// Default colors for the index numbers in an array. [0] not having a color.
							var colorMap = ['none', 'blue', 'green', 'red',  'black', 'orange', 'cyan'];
							globals.context.fillStyle = colorMap[globals.mineMap[x][y]];
							globals.context.fillText(globals.mineMap[x][y], (x * defaults.celSize) + 5, (y * defaults.celSize) + 16);	
						}
						
						alpha = alpha + .1;
						
						if(alpha > 1){
							window.clearInterval(squareFade);
						}
					}, 50);
				
        // If the square that was clicked has no surrounding mines...
				}else{
          
          // If unforutantely there is mine, display it and trigger the function leading to the end of the game
          var mine = new Image();
          mine.src = defaults.mineImg;
          mine.onload = function() {
            action.revealMines(mine);
          };
        }
				
				if(globals.mineMap[x][y] === 0){
          
          // remove all neighbors till squares are found that do have surrounding mines
          for(var i = -1; i <= 1; i++){
            for(var j = -1; j <= 1; j++){
              // If a neighboring square is also not surrounded by mines, remove his neighbors also; and repeat
              if(l < 0 && x + i >= 0 && y + j >= 0 && x + i <= globals.squaresX && y + j <= globals.squaresX){
                action.index(x + i, y + j);
              }
            }
          }
          
        // If the square does not cover a mine, display the index number
        }
      }
    }
  },
  
  /* ------------------------------------------- */
  // -- Flag function
  // -- Used to flag a square
  // -- @return void
  /* ------------------------------------------- */
  
  flag: function(flag, x, y){
    
    // If square is not already flagged
    if(globals.flagMap[x][y] !== 1){
      
      // Draw flag
      globals.context.drawImage(flag, x * defaults.celSize, y * defaults.celSize, defaults.celSize, defaults.celSize);
      globals.flagMap[x][y] = 1;
      globals.totalFlags++;
      
    }else{
      
      // Remove flag image
      var img = globals.context.createImageData(defaults.celSize, defaults.celSize);
      for(var i = img.data.length; --i >= 0;){
        img.data[i] = 0;
      }
      
      globals.context.putImageData(img, x * defaults.celSize, y * defaults.celSize);
      
      // Make sure proper styles are set
      globals.context.strokeStyle = defaults.celStroke;
      globals.context.fillStyle = defaults.celColor;
    
      util.roundRect(x, y);
        
      globals.flagMap[x][y] = 0;
      globals.totalFlags--;
    }
    
    // Adjust counters accordingly
    containers.mines.html('You have to find ' + (globals.totalMines - globals.totalFlags) + ' mines to win.');
    containers.flags.html('You have set ' + globals.totalFlags + ' flags.');
    
    // With every flag (or unflag) check if the game has been won
    action.won();
  },
  
  /* ------------------------------------------- */
  // -- Won function
  // -- Used to determine if the game has been won
  // -- @return void
  /* ------------------------------------------- */
  
  won: function(){
    
    // Setup counter
    var count = 0;
    
    // Count the number of flagged mines 
    for(var i = 0; i < globals.squaresX; i++){
      for(var j = 0; j < globals.squaresY; j++){
        if((globals.flagMap[i][j] === 1 ) && (globals.mineMap[i][j] === -1)){
          count++;
        } 
      }
    }
    
    // If the number of flagged mines equals the total number of mines, the game has been won
    if(count === globals.totalMines){
      // Set game over status
      globals.gameover = true;
      containers.status.html('You won! :D');
      
      scores.save();
      
      // Stops the timer and counts down to a reset of the game
      window.clearInterval(globals.clock);
    }
  },
  
  /* ------------------------------------------- */
  // -- Generate Mines function
  // -- Places the mines on the field, at random
  // -- @return void
  /* ------------------------------------------- */
  
  generateMines: function(){
    
    // For every square
    for(var i = 0; i < globals.squaresX; i++){
      globals.mineMap[i] = new Array(globals.squaresX);
      
      // The lower the dificulty, the more mines
      for(var j = 0; j < globals.squaresY; j++){
        globals.mineMap[i][j] = Math.floor((Math.random() * defaults.difficulty) - 1);
        
        if(globals.mineMap[i][j] > 0){
          globals.mineMap[i][j] = 0;
        }
      }
    } 
    
    // Move on to the next step of the setup
    action.calculateMines();
  },
  
  /* ------------------------------------------- */
  // -- Calculate Mines function
  // -- Used to calculate surrounding mines number
  // -- @return void
  /* ------------------------------------------- */
  
  calculateMines: function() {
    
    var mineCount = 0;
    globals.totalMines = 0;
    
    // Check every square
    for(var i = 0; i < globals.squaresX; i++){
      for(var j = 0; j < globals.squaresY; j++){
		  
			if(globals.mineMap[i][j] === -1){
				
				var xArr = [i, i + 1, i - 1],
						yArr = [j, j + 1, j - 1];	
				
					/* 
					
					The loop iterates over the surrounding squares as shown below:
								
								-------------------------
								| i - 1 |   i   | i + 1 |
								| j - 1 | j - 1 | j - 1 |
								-------------------------
								| i - 1 |   i   | i + 1 |
								|   j   |   j   |   j   |
								-------------------------
								| i - 1 |   i   | i + 1 |
								| j + 1 | j - 1 | j + 1 |
								-------------------------	
					*/
			
					for(var a = 0; a < 3; a++){
						for(var b = 0; b < 3; b++){
							if(util.is('mine', xArr[a], yArr[b])){
								globals.mineMap[xArr[a]][yArr[b]]++;
							}
						}
					}
					
					globals.totalMines++;	
				}  
      } 
    }
  },
  
  /* ------------------------------------------- */
  // -- Reveal Mines function
  // -- Reveals all the mines and triggers a game
  // -- over status
  // -- @return void
  /* ------------------------------------------- */
  
  revealMines: function(mine){
    
    // Draw all the mines
    for(var i = 0; i < globals.squaresX; i++){
      for(var j = 0; j < globals.squaresY; j++){
        if(globals.mineMap[i][j] === -1){
          globals.context.drawImage(mine, i * defaults.celSize, j * defaults.celSize, defaults.celSize, defaults.celSize);
        }
      }
    }
    
    // Set game over status
    globals.gameover = true;
    containers.status.html('Game over :(');
    containers.msg.html('Click the reset button to start a new game');
    
    // Stops the timer and counts down to a reset of the game
    window.clearInterval(globals.clock);
  }
};

/* =========================================== */
// --- Scores Functions ---
/* =========================================== */

var scores = {
  
  display: function(){
    
    if(typeof Storage !== 'undefined'){
      
      //delete localStorage.scores;
      
      if(typeof localStorage.scores !== 'undefined'){
      
        var lScores = JSON.parse(localStorage.scores);
        
        containers.scoreboard.html('<tr><th>Name</th><th>Mines</th><th>Seconds</th></tr>');
        
        $.each(lScores, function(){
          containers.scoreboard.append('<tr><td>' + this[0] + '</td><td>' + this[2] + '</td><td>' + this[3] + '</td></tr>');  
        });
      
      }else{
        
        containers.scoreboard.html('<tr><td>You have not won any games yet :(</td></tr>');
      }
    
    }else{
      containers.scoreboard.html('<tr><td>Unfortunately, your browser does not support local storage</td></tr>');       
    } 
    
  },
  
  save: function(){
    
    if(typeof Storage !== 'undefined'){
      
      var name = prompt('Your score is being stored. Please enter your name','Name'),
        score = [name, 'Insane', globals.totalMines, globals.elapsedTime, 10000];

      var scores = (typeof localStorage.scores !== 'undefined') ? JSON.parse(localStorage.scores) : new Array();
      
      scores.push(score);
      localStorage.scores = JSON.stringify(scores);
    }
  }
    
};

/* =========================================== */
// --- Animation Functions ---
/* =========================================== */

var animation = {
  
  standardBoard: function(){
    
    globals.context.fillStyle = defaults.celColor;
      
    for(var i = 0; i <= globals.squaresX; i++){
      for(var j = 0; j <= globals.squaresY; j++){
        util.roundRect(i, j);
      } 
    }
  },
  
  walker: function(){
    // Make sure proper styles are set
    globals.context.strokeStyle = defaults.celStroke;
    
    var x = 0, y = 0;
    globals.currentAnimation = setInterval(function(){
      
      animation.standardBoard();
      
      globals.context.fillStyle = '#f16529';
      util.roundRect(x, y);
      
      x++;
      
      if(x === globals.squaresX){ x = 0; y++; }
      
      if(y === globals.squaresY){ x = 0; y = 0; }
    
    }, 30);
  }, 
  
  topDown: function(){
    // Make sure proper styles are set
    globals.context.strokeStyle = defaults.celStroke;
    
    var y = 0;
    globals.currentAnimation = setInterval(function(){
      
      animation.standardBoard();
      
      globals.context.fillStyle = '#f16529';
      
      for(var x = 0; x <= globals.squaresX; x++){
        util.roundRect(x, y);
      }
      
      if(y === globals.squaresY){
        y = 0;
      }
      
      y++;
    
    }, 50);
  },
  
  leftRight: function(){
    
    globals.context.strokeStyle = defaults.celStroke;
    
    var x = 0, dir = 0;
    globals.currentAnimation = setInterval(function(){
      
      animation.standardBoard();
      
      globals.context.fillStyle = '#f16529';
      
      util.roundRect(x, y);
      
      if(dir === 0 && x === globals.squaresX){
        dir = 1;
      }else if(dir === 1 && x === -1){
        dir = 0;
      }
      
      if(dir === 0){
        x++;  
      }else if(dir === 1){
        x--;
      }
    
    }, 50);
  },
  
  arrow: function(){
    
    var longArrow = [
      [5, 9], [5, 10], [5, 11],
      [6, 9], [6, 10], [6, 11],
      [7, 9], [7, 10], [7, 11],
      [8, 9], [8, 10], [8, 11],
      [9, 9], [9, 10], [9, 11],
      [10, 9], [10, 10], [10, 11],
      [11, 9], [11, 10], [11, 11],
      
      [12, 8], [12, 9], [12, 10], [12, 11], [12, 12],
      [13, 9], [13, 10], [13, 11],
      [14, 10]
    ], 
    shortArrow = [
      [5, 9], [5, 10], [5, 11],
      [6, 9], [6, 10], [6, 11],
      [7, 9], [7, 10], [7, 11],
      [8, 9], [8, 10], [8, 11],
      [9, 9], [9, 10], [9, 11],
      [10, 9], [10, 10], [10, 11],
      
      [11, 8], [11, 9], [11, 10], [11, 11], [11, 12],
      [12, 9], [12, 10], [12, 11],
      [13, 10]
    ],
    x = 0,
    arrow = shortArrow;
    
    globals.currentAnimation = setInterval(function(){  
    
      animation.standardBoard();
    
      globals.context.fillStyle = '#f16529';
    
      for(var i = 0; i <= arrow.length; i++){
        if(arrow[i] !== undefined){
          util.roundRect(arrow[i][0] * defaults.celSize, arrow[i][1] * defaults.celSize, defaults.celSize - 1, defaults.celSize - 1); 
        }
      }
      
      if(x % 2 === 0){
        arrow = longArrow;
      }else{
        arrow = shortArrow;
      }
      
      x++;
      
    }, 200);
  }
  
};

/* =========================================== */
// --- Utility Functions ---
/* =========================================== */

var util = {
  
  /* ------------------------------------------- */
  // -- Rounded Rectangle function
  // -- Draws rounded rectangles
  /* ------------------------------------------- */
  
  roundRect: function(x, y){
		
		var width = defaults.celSize - 1,
				height = defaults.celSize - 1,
				x = x * defaults.celSize,
				y = y * defaults.celSize;
		
    globals.context.beginPath();
    globals.context.moveTo(x + defaults.celRadius, y);
    globals.context.lineTo(x + width - defaults.celRadius, y);
    globals.context.quadraticCurveTo(x + width, y, x + width, y + defaults.celRadius);
    globals.context.lineTo(x + width, y + height - defaults.celRadius);
    globals.context.quadraticCurveTo(x + width, y + height, x + width - defaults.celRadius, y + height);
    globals.context.lineTo(x + defaults.celRadius, y + height);
    globals.context.quadraticCurveTo(x, y + height, x, y + height - defaults.celRadius);
    globals.context.lineTo(x, y + defaults.celRadius);
    globals.context.quadraticCurveTo(x, y, x + defaults.celRadius, y);
    globals.context.closePath();
    globals.context.stroke();
    globals.context.fill();    
  },
  
  /* ------------------------------------------- */
  // -- Switch Screens function
  // -- Switch between start and game screen
  /* ------------------------------------------- */
  
  switchScreens: function(){
    if($('.startscreen').is(':hidden') === false){
      $('.startscreen').fadeToggle(400, 'swing', function(){
        core.reset();
        $('.gamescreen').fadeToggle();
      });   
    }else{
      $('.gamescreen').fadeToggle(400, 'swing', function(){
        core.reset();
        defaults.difficulty = 0;
        $('.startscreen').fadeToggle();
      });   
    }
  },
	
	is: function(what, x, y){
		var p = {
			'revealed': globals.revealedMap,
			'mine': globals.mineMap,
			'flag': globals.flagMap
		};
		
		if(typeof p[what][x] !== 'undefined' && typeof p[what][x][y] !== 'undefined' && p[what][x][y] > -1){
			return true;
		}else{
			return false;
		}
	}
};

/* =========================================== */
// --- Initiate Minesweeper ---
/* =========================================== */

  core.init();
});
