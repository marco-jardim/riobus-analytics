var http = require('http'); // importing http module. it's a node's default module.
var fs = require('fs');	// importing filesystem module. using fs to read riobus-config.json.
var moment = require('moment'); // easy timestamp formatting

// Access riobus-config.json
var config = JSON.parse(fs.readFileSync(__dirname + "/riobus-config.json")).dataQueuer;


// Options to do the GET Request
var options = {
	host: config.host,
	path: config.path,
	port: config.port,
	method: "GET"
};

// Global variable to store json
var data = null;
// Interval between requests for riob.us/all
var intervalTime = config.intervalTime;

// Callback function to GET Request to riob.us/all
function callback(response) {
  var str = '';

  // another chunk of data has been recieved, so append it to `str`
  response.on('data', function (chunk) {
    str += chunk.toString('utf-8');
  });

  // the whole response has been recieved, so we just parse it to JSON
  response.on('end', function () {
    console.log("GET request for riob.us/all done.");
    data = JSON.parse(str);
  });
}

// Queue the requested data into queue.json
function appendDataAsync(data_to_append) {
  //fs.appendFile('queue.json', data_to_append, function (err) {
  	//if (err) throw err;
	//});
	var date = new Date();
	var file_name = moment(date).format("YYYYMMDDHH") + ".json";
		// console.log(data_to_append);
		fs.writeFile(__dirname + "/files/" + file_name, "" + data_to_append, function(err) {
	    if(err) {
	        console.log(err);
	    } else {
	        console.log("The file was saved!");
	    }
	});	
}

// Google's Big Query timestamp format, UTC time
function toTimestamp(datetime) {
	return moment(datetime).format('YYYY-MM-DD HH:mm:ss');
}

// Parses the data to insert into bigquery
function data_formatter() {
	var formatted_data = "";
	var bus_array = data.DATA;
	for(var i = 0; i < bus_array.length; i++) {
		if(bus_array[i][6] == "") {
			bus_array[i][6] = 999; // avoid leaving DIRECAO as ""
		}		
		formatted_data += '{"DATAHORA": "' + toTimestamp(bus_array[i][0]) + '", "ORDEM": "' + bus_array[i][1] + '", "LINHA": "' + bus_array[i][2] + '", "LATITUDE": ' + bus_array[i][3] + ', "LONGITUDE": ' + bus_array[i][4] + ', "VELOCIDADE": ' + bus_array[i][5] + ', "DIRECAO":' + bus_array[i][6] + ', "LASTUPDATE": "' + toTimestamp(data.LASTUPDATE) + '"}\n';
	}

	return formatted_data;
}

function getDateTimeBoundary(hour) {
	var now = new Date();
	var offset = hour * 60 * 60 * 1000;

	return new Date(now.getTime() - offset);
}

function toDateTime(dateTimeString) {
	return new Date(dateTimeString);		
}

// Grabs data from riob.us/all and enqueues it in the json file in time intervals
setInterval(function() {
	// Make GET Request
	http.request(options, callback).end();
	
	// Checks if data already has been generated by JSON.parse.
	if(data != null) {
		// var formatted_data = data_formatter();
		if(toDateTime(data.LASTUPDATE) < getDateTimeBoundary(1)) {
			data = JSON.parse("{}");
		}
		appendDataAsync(JSON.stringify(data));
	}
}, intervalTime);