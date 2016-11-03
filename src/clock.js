var ws281x = require('rpi-ws281x-native');

// Global constants
var constants = {
  ledcount: 24,
  time_interval: 5, // Milliseconds
  render_interval: 10, // Milliseconds
  idle_color: rgb2Int(50,50,50)
};

ws281x.init(constants.ledcount);

// Trap SIGINT (ctrl-c) and reset the LED strip before exiting
process.on('SIGINT', function () {
  ws281x.reset();
  process.nextTick(function () { process.exit(0); });
});

// Template for the clock "class"
var clock = {
  inner: [],
  outer: [],
  brightness: 1.0,
};

// Placeholder colors for each LED
for (var i = 0; i < (constants.ledcount/2); i++) {
  clock.inner[i] = constants.idle_color;
  clock.outer[i] = constants.idle_color;
}

// Two quirks need to be addressed before we can pass values to the LED strip:
// 1. The inner and outer rings alternate indexes, starting with the outer
// 2. The LEDs are indexed backwards (ie, led 0 is at 11 o'clock)
// This function shuffles the inner and outer arrays back together, backwards, and renders
clock.render = function() {
  var self = clock;
  var pixeldata = [];

  // Shuffle the two rings into one array
  for (var i = 0; i < (constants.ledcount/2); i++) {
    pixeldata.push(self.outer[i]);
    pixeldata.push(self.inner[i]);
  }

  // Address the clock being indexed backwards
  pixeldata.reverse();

  // You can't perform standard javascript array operations on these funky c++ arrays
  finaldata = new Uint32Array(pixeldata.length);

  for (var j = 0; j < finaldata.length; j++) {
    finaldata[j] = pixeldata[j];
  }

  // Shift the values in
  ws281x.render(pixeldata);
};

// Determine how to color the inner and outer rings depending on the time
clock.calculateColors = function() {
  var self = clock; // TODO not this (well, actually, use 'this')
  var date = new Date();
  var tau = 2*Math.PI;
  // The unit circle is offset by 90 degrees
  var offset = Math.PI/2;

  // Minute, 0 through 59 (with the fractional seconds)
  var minute = date.getMinutes()+(date.getSeconds()/60)+((date.getMilliseconds()/1000)/60);
  // Hour, 0 through 11 (with the fractional minutes/seconds)
  var hour = (date.getHours()%12)+(minute/60);

  var time = [
    {value: minute, constant: 60, ring: self.outer},
    {value: hour,   constant: 12, ring: self.inner}
  ];

  console.log("Time is: "+time[1].value.toFixed(4)+":"+time[0].value.toFixed(4));

  // Convert the hours and minutes to angles
  var angle = [0,0];
  for (var j = 0; j < 2; j++) {
    angle[j] = (tau*(time[j].value/time[j].constant)+offset)%tau;
    console.log("Angles are: "+(angle[j]/Math.PI).toFixed(4)+" radians");
  }

  // Find the angle of each dot, and give it a brightness relative to its distance
  // from the actual time.
  for (var i = 0; i < 12; i++) {
    var dot_angle = (i*(tau/12)+offset)%tau;
    for (var k = 0; k < 2; k++) {
      var brightness = 0;
      console.log("Angle:       "+angle[k]);
      console.log("Dot Angle:   "+dot_angle);
      console.log("Dot product: "+dotProduct(dot_angle,angle[k]));
        brightness = 255-(dotProduct(dot_angle,angle[k]/Math.PI)*42);
      time[k].ring[i] = rgb2Int(brightness, brightness, brightness);
    }
  }
};

// Update the time every so often
setInterval(clock.calculateColors, constants.time_interval);

// Shift out new pixel values every so often
setInterval(clock.render, constants.render_interval);

// Global function to convert separate R, G, B values to a single int
function rgb2Int(r, g, b) {
  return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
}

// Determine the angle difference between two angles
function dotProduct(a, b)
{
  // We need to calculate the dot product.
  return Math.acos((Math.cos(a)*Math.cos(b))+(Math.sin(a)*Math.sin(b)));
}
