var express = require('express'); // require Express
var router = express.Router(); // setup usage of the Express router engine

/* PostgreSQL and PostGIS module and connection setup */
var pg = require("pg"); // require Postgres module
// Setup connection
var username = "postgres" // sandbox username
var password = "PostRead" // read only privileges on our table
var host = "localhost:5432"
var database = "accidents" // database name
var conString = "postgres://"+username+":"+password+"@"+host+"/"+database; // Your Database Connection

const queryLimit = 100000;

// Set up your database query to display GeoJSON
var coffee_query = "SELECT row_to_json(fc) FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, row_to_json((id, data_inversa, classificacao_acidente)) As properties FROM accidents  As lg LIMIT " + queryLimit + ") As f) As fc";

/* GET home page. */
router.get('/', function(req, res) {
    res.render('index', {
        title: 'Express'
    });
});

module.exports = router;

/* GET Postgres JSON data */
router.get('/data', function (req, res) {
    var client = new pg.Client(conString);
    client.connect();
    var query = client.query(coffee_query);
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
    var client = new pg.Client(conString);
    client.connect();
    var query = client.query(coffee_query);
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
});

/* GET the filtered page */
router.get('/filter*', function (req, res) {
    var weekDay = req.query.weekDay;
    if (weekDay.indexOf("--") > -1 || weekDay.indexOf("'") > -1 || weekDay.indexOf(";") > -1 || weekDay.indexOf("/*") > -1 || weekDay.indexOf("xp_") > -1){
        console.log("Bad request detected");
        res.redirect('/map');
        return;
    } else {
        console.log("Request passed")
        var filter_query = "SELECT row_to_json(fc) FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, row_to_json((id, data_inversa, classificacao_acidente)) As properties FROM accidents  As lg WHERE lg.dia_semana = \'" + weekDay + "\' LIMIT 50000) As f) As fc";
        var client = new pg.Client(conString);
        client.connect();
        var query = client.query(filter_query);
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
});


