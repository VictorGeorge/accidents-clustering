var express = require('express'); // require Express
var router = express.Router(); // setup usage of the Express router engine

/* PostgreSQL and PostGIS module and connection setup */
const { Client, Query } = require('pg')

// Setup connection
var username = "postread" // sandbox username
var password = "PostRead" // read only privileges on our table
var host = "localhost:5435"
var database = "postgiscwb" // database name
var conString = "postgres://"+username+":"+password+"@"+host+"/"+database; // Your Database Connection

const queryLimit = 100000;

// Set up your database query to display GeoJSON
var accidentsQuery = "SELECT row_to_json(fc) FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, row_to_json((id, data_inversa, classificacao_acidente, dia_semana)) As properties FROM public.accidents As lg WHERE lg.ano = \'" + 2018 + "\' LIMIT " + queryLimit + ") As f) As fc";

//Get the 5 most common causes of accidents
var causesQuery = "SELECT causa_acidente, COUNT(*) FROM public.accidents WHERE ano = 2018 GROUP BY causa_acidente ORDER BY count(*) DESC LIMIT 10";
var causesQueryPrefix = "SELECT causa_acidente, COUNT(*) FROM public.accidents";
var causesQuerySuffix = " GROUP BY causa_acidente ORDER BY count(*) DESC LIMIT 10";

//Get the 5 most common hours of accidents
var hoursQuery = "SELECT hora, COUNT(*) FROM public.accidents WHERE ano = 2018 GROUP BY hora ORDER BY count(*) DESC LIMIT 5";
var hoursQueryPrefix = "SELECT hora, COUNT(*) FROM public.accidents";
var hoursQuerySuffix = " GROUP BY hora ORDER BY count(*) DESC LIMIT 5";

//Get the 10 most common states
var statesQuery = "SELECT uf, count(*) numero FROM public.accidents WHERE ano BETWEEN 2007 AND 2017 GROUP BY uf ORDER BY numero DESC LIMIT 10";
var statesQueryPrefix = "SELECT uf, count(*) numero FROM public.accidents";
var statesQuerySuffix = " GROUP BY uf ORDER BY numero DESC LIMIT 10";

//Get the 10 Br's with most accidents
var brsQuery = "SELECT br, COUNT(*) FROM public.accidents WHERE ano = 2018 GROUP BY br ORDER BY count(*) DESC LIMIT 10";
var brsQueryPrefix = "SELECT br, COUNT(*) FROM public.accidents";
var brsQuerySuffix = " GROUP BY br ORDER BY count(*) DESC LIMIT 10";

var mainQueryPrefix = "SELECT row_to_json(fc) FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, row_to_json((id, data_inversa, classificacao_acidente, dia_semana)) As properties FROM accidents  As lg ";
var mainQuerySuffix = ") As f) As fc";

/* GET home page. */
router.get('/', function (req, res, next) {
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
router.get('/map', async function (req, res) {
    accidentsQuery = "SELECT row_to_json(fc) FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, row_to_json((id, data_inversa, classificacao_acidente, dia_semana, ano, br)) As properties FROM public.accidents As lg WHERE lg.ano = \'" + 2018 + "\' LIMIT " + queryLimit + ") As f) As fc";
    causesQuery = "SELECT causa_acidente, COUNT(*) FROM public.accidents WHERE ano = 2018 GROUP BY causa_acidente ORDER BY count(*) DESC LIMIT 10";
    hoursQuery = "SELECT hora, COUNT(*) FROM public.accidents WHERE ano = 2018 GROUP BY hora ORDER BY count(*) DESC LIMIT 5";
    statesQuery = "SELECT uf, count(*) numero FROM public.accidents WHERE ano BETWEEN 2007 AND 2017 GROUP BY uf ORDER BY numero DESC LIMIT 10";
    brsQuery = "SELECT br, COUNT(*) FROM public.accidents WHERE ano = 2018 GROUP BY br ORDER BY count(*) DESC LIMIT 10";
    doQueries(req, res);
});

async function doQueries(req, res) {
    var client = new Client(conString); // Setup our Postgres Client
    await client.connect();

    console.log(accidentsQuery);
    var resultQuery = await client.query(accidentsQuery);
    var data = resultQuery.rows[0].row_to_json // Save the JSON as variable data
    const resultCauses = await client.query(causesQuery);
    const resultHours = await client.query(hoursQuery);
    const resultStates = await client.query(statesQuery);
    const resultBrs = await client.query(brsQuery);

    await client.end();
    await res.render('map', {
        title: "Accidents API", // Give a title to our page
        jsonData: data, // Pass data to the View
        causesData: resultCauses,
        hoursData: resultHours,
        statesData: resultStates,
        brsData: resultBrs
    });
}

//TODO: Refactor so it doesnt repeat code and prepare for multifilter
/* GET the filtered page */
router.get('/filter*', async function (req, res) {
    var filters;
    var filtersSelects;
    var weekDay = req.query.weekDay;
    var yearAccident = req.query.yearAccident;
    var causesAccident = req.query.causesAccident;
    var hoursAccident = req.query.hoursAccident;
    var brsAccident = req.query.brsAccident;
    let yearFilterString;
    //TODO: 1 metodo pra cada filtro, que faz a query e retorna, e um pras localizações msm, que tem que ter todos os filtros na query async await talvez?
    if (yearAccident != undefined) {
        if (isRequestValid(yearAccident) === true) {
            filters = await yearFilter(yearAccident);
            filtersSelects = await yearFilterSelects(yearAccident);
        }
        else{
            filters = await yearFilter(2018);
            filtersSelects = await yearFilterSelects(2018);
        }
    }
    else{
        filters = await yearFilter(2018);
        filtersSelects = await yearFilterSelects(2018);
    }

    if (weekDay != undefined) {
        if (isRequestValid(weekDay) === true) {
            let weekdayFilterString = await weekdayFilter(weekDay);
            filters = filters.concat(weekdayFilterString);

            weekdayFilterString = await weekdayFilterSelects(weekDay);
            filtersSelects = filtersSelects.concat(weekdayFilterString);

        }
    }
    if (causesAccident != undefined) {
        if (isRequestValid(causesAccident) === true) {
            causesAccident = causesAccident.trim();
            causesQuery = "SELECT causa_acidente, COUNT(*) FROM public.accidents WHERE ano = 2018 AND causa_acidente = \'" + causesAccident + "\' GROUP BY causa_acidente ORDER BY count(*) DESC LIMIT 5";
            let causesFilterString = await causesFilter(causesAccident);
            filters = filters.concat(causesFilterString);

            causesFilterString = await causesFilterSelects(causesAccident);
            filtersSelects = filtersSelects.concat(causesFilterString);
        }
    }
    if (hoursAccident != undefined) {
        if (isRequestValid(hoursAccident) === true) {
            hoursQuery = "SELECT hora, COUNT(*) FROM public.accidents WHERE ano = 2018 AND hora = " + hoursAccident + " GROUP BY hora ORDER BY count(*) DESC LIMIT 5"; 
            let hoursString = await hoursFilter(hoursAccident);
            filters = filters.concat(hoursString);

            hoursString = await hoursFilterSelects(hoursAccident);
            filtersSelects = filtersSelects.concat(hoursString);
        }
    }
    if (brsAccident != undefined) {
        if (isRequestValid(brsAccident) === true) {
            brsQuery = "SELECT br, COUNT(*) FROM public.accidents WHERE ano = 2018 AND br = \'" + brsAccident + "\' GROUP BY br ORDER BY count(*) DESC LIMIT 1";//TODO
            let brFilterString = await brFilter(brsAccident);
            filters = filters.concat(brFilterString);

            brFilterString = await brFilterSelects(brsAccident);
            filtersSelects = filtersSelects.concat(brFilterString);
        }
    }
    var filterString = mainQueryPrefix;
    filterString = filterString.concat(filters, mainQuerySuffix);
    accidentsQuery = filterString;

    causesQuery = causesQueryPrefix + filtersSelects + causesQuerySuffix;
    hoursQuery = hoursQueryPrefix + filtersSelects + hoursQuerySuffix;
    statesQuery = statesQueryPrefix + filtersSelects + statesQuerySuffix;
    brsQuery = brsQueryPrefix + filtersSelects + brsQuerySuffix;
    doQueries(req, res);
});

function isRequestValid(request) {
    if (request != undefined) {
        if (request.indexOf("--") > -1 || request.indexOf("'") > -1 || request.indexOf(";") > -1 || request.indexOf("/*") > -1 || request.indexOf("xp_") > -1) {
            console.log("Bad request detected");
            res.redirect('/map');
            return false;
        }
        else
            return true;
    }
}

async function yearFilter(yearAccident) {
    return "WHERE lg.ano = " + yearAccident;
}

async function weekdayFilter(weekDay) {
    return " AND lg.dia_semana = \'" + weekDay + "\'";
}

async function brFilter(brsAccident) {
    return " AND lg.br = \'" + brsAccident + "\' ";
}

async function causesFilter(causes) {
    return " AND lg.causa_acidente = \'" + causes + "\'";
}

async function hoursFilter(hour) {
    return " AND lg.hora = " + hour;
}


async function yearFilterSelects(yearAccident) {
    return " WHERE ano = " + yearAccident;
}

async function weekdayFilterSelects(weekDay) {
    return " AND dia_semana = \'" + weekDay + "\' ";
}

async function brFilterSelects(brsAccident) {
    return " AND br = \'" + brsAccident + "\' ";
}

async function causesFilterSelects(causes) {
    return " AND causa_acidente = \'" + causes + "\' ";
}

async function hoursFilterSelects(hour) {
    return " AND hora = " + hour;
}

