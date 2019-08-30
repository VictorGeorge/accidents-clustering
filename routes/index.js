var express = require('express'); // require Express
var router = express.Router(); // setup usage of the Express router engine

/* PostgreSQL and PostGIS module and connection setup */
const { Client, Query } = require('pg')

// Setup connection
var username = "postgres" // sandbox username
var password = "PostRead" // read only privileges on our table
var host = "localhost:5432"
var database = "accidents" // database name
var conString = "postgres://"+username+":"+password+"@"+host+"/"+database; // Your Database Connection

const queryLimit = 50000;

// Set up your database query to display GeoJSON
var accidentsQuery = "SELECT row_to_json(fc) FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, row_to_json((id, data_inversa, classificacao_acidente, dia_semana, ano)) As properties FROM accidents  As lg LIMIT " + queryLimit + ") As f) As fc";

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;

/* GET Postgres JSON data */
router.get('/data', function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    var client = new Client(conString);
    client.connect();
    var query = client.query(new Query(accidentsQuery));
    query.on("row", function (row, result) {
        result.addRow(row);
    });
    query.on("end", function (result) {
        res.send(result.rows[0].row_to_json);
        res.end();
    });
});

/* GET the map page */
router.get('/map', function(req, res) {
    var client = new Client(conString); // Setup our Postgres Client
    client.connect(); // connect to the client
    var query = client.query(new Query(accidentsQuery)); // Run our Query
    query.on("row", function (row, result) {
        result.addRow(row);
    });
    // Pass the result to the map page
    query.on("end", function (result) {
        var data = result.rows[0].row_to_json // Save the JSON as variable data
        res.render('map', {
            title: "Express API", // Give a title to our page
            jsonData: data // Pass data to the View
        });
    });
});

//TODO: Refactor so it doesnt repeat code and prepare for multifilter
/* GET the filtered page */
router.get('/filter*', function (req, res) {
    var weekDay = req.query.weekDay;
    var yearAccident = req.query.yearAccident;
    if(weekDay != undefined){
        if (weekDay.indexOf("--") > -1 || weekDay.indexOf("'") > -1 || weekDay.indexOf(";") > -1 || weekDay.indexOf("/*") > -1 || weekDay.indexOf("xp_") > -1){
            console.log("Bad request detected");
            res.redirect('/map');
            return;
        } else {
            console.log("Request passed")
            var filter_query = "SELECT row_to_json(fc) FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, row_to_json((id, data_inversa, classificacao_acidente, dia_semana, ano)) As properties FROM accidents  As lg WHERE lg.dia_semana = \'" + weekDay + "\' LIMIT " + queryLimit + ") As f) As fc";
            var client = new Client(conString);
            client.connect();
            var query = client.query(new Query(filter_query)); // Run our Query
            query.on("row", function (row, result) {
                result.addRow(row);
            });
            query.on("end", function (result) {
                var data = result.rows[0].row_to_json
                res.render('map', {
                    title: "Express API",
                    jsonData: data
                });
            });
        };
    }
    else if(yearAccident != undefined){
        if (yearAccident.indexOf("--") > -1 || yearAccident.indexOf("'") > -1 || yearAccident.indexOf(";") > -1 || yearAccident.indexOf("/*") > -1 || yearAccident.indexOf("xp_") > -1){
            console.log("Bad request detected");
            res.redirect('/map');
            return;
        } else {
            console.log("Request passed")
            var filter_query = "SELECT row_to_json(fc) FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, row_to_json((id, data_inversa, classificacao_acidente, dia_semana, ano)) As properties FROM accidents  As lg WHERE lg.ano = \'" + yearAccident + "\' LIMIT " + queryLimit + ") As f) As fc";
            var client = new Client(conString);
            client.connect();
            var query = client.query(new Query(filter_query)); // Run our Query
            query.on("row", function (row, result) {
                result.addRow(row);
            });
            query.on("end", function (result) {
                var data = result.rows[0].row_to_json
                res.render('map', {
                    title: "Express API",
                    jsonData: data
                });
            });
        };
    }
});


