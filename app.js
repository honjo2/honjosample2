
/**
 * Module dependencies.
 */

var DB_NAME = 'db';
var COLLECTION_NAME = 'names';
var LIMIT = 100;

// helpers
function myfind(collection, cb) {
    collection.find({}, {sort: [['created', -1]], limit: LIMIT}).toArray(cb);
}

function generateJson(names) {
    var ret = { names: [ {_attr: {count: names.length} } ] };
    for (var i = 0; i < names.length; i++) {
        ret.names.push({ name: names[i].name });
    }
    return ret;
}

require.paths.unshift('./node_modules');

var XML = require('xml');

var express = require('express');
var mongodb = require('mongodb');
var Db = mongodb.Db;
var Server = mongodb.Server;
var BSON = mongodb.BSONPure;

var app = module.exports = express.createServer();
var client = {};

// Configuration
app.configure(function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
});

app.configure('development', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
    client = new Db(DB_NAME, new Server('127.0.0.1', 27017, {}));
    client.open(function(err, p_client) {});
});

app.configure('production', function() {
    app.use(express.errorHandler());
    var env = JSON.parse(process.env.VCAP_SERVICES);
    var mongo = env['mongodb-1.8'][0].credentials;
    client = new Db(DB_NAME, new Server(mongo.hostname, mongo.port, {}));
    client.open(function(err, p_client) {
        client.authenticate(mongo.username, mongo.password, function() {
        });
    });
});

// Routes

app.get('/', function(req, res) {
    client.collection(COLLECTION_NAME, function(err, collection) {
        if (req.query.remove) {
            // collection.removeだとエラーになってしまったのでこうしてる
            collection.findAndModify(
                { _id: new BSON.ObjectID(req.query.remove) },
                [],
                {},
                { remove: true },
                function(err, object) {
                    myfind(collection, function(err, names) {
                        res.render('index', {
                            names: names
                        });
                    });
                }
            );
        } else {
            myfind(collection, function(err, names) {
                res.render('index', {
                    names: names
                });
            });
        }
    });
});

app.post('/', function(req, res) {
    var name = req.body.name || '';
    client.collection(COLLECTION_NAME, function(err, collection) {
        collection.insert(
            { name: name, created: new Date().getTime() },
            function(err, result) {
                res.redirect('/');
            }
        );
    });
});

app.get('/xml', function(req, res) {
    client.collection(COLLECTION_NAME, function(err, collection) {
        myfind(collection, function(err, names) {
            res.send(
                XML(generateJson(names), true),
                { 'Content-Type': 'application/xml' },
                200
            );
        });
    });
});

app.get('/json', function(req, res) {
    client.collection(COLLECTION_NAME, function(err, collection) {
        myfind(collection, function(err, names) {
            res.send(
                JSON.stringify(generateJson(names)),
                { 'Content-Type': 'application/json' },
                200
            );
        });
    });
});

// Only listen on $ node app.js

if (!module.parent) {
    app.listen(process.env.VMC_APP_PORT || 3000);
    console.log("Express server listening on port %d", app.address().port);
}
