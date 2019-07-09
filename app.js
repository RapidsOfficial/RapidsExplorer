var express = require('express')
  , path = require('path')
  , chaincoinapi = require('chaincoin-node-api')
  , favicon = require('serve-favicon')
  , logger = require('morgan')
  , cookieParser = require('cookie-parser')
  , bodyParser = require('body-parser')
  , settings = require('./lib/settings')
  , routes = require('./routes/index')
  , lib = require('./lib/explorer')
  , db = require('./lib/database')
  , i18next = require('i18next')
  , i18nextMiddleware = require('i18next-express-middleware')
  , i18Backend = require('i18next-node-fs-backend')
  , request = require('request');

// Add this section code to here
var forceSSL = require('express-force-ssl');
var https = require('https');
var fs = require('fs');
var ssl_options = {
  key: fs.readFileSync('./cert/server.key'),
  cert: fs.readFileSync('./cert/server.crt'),
  ca: fs.readFileSync('./cert/server.ca')
};
// Add this section code to here

var app = express();

// Add this section code to here
var secureServer = https.createServer(ssl_options, app);
// Add this section code to here

// chaincoinapi
chaincoinapi.setWalletDetails(settings.wallet);
if (settings.heavy != true) {
  chaincoinapi.setAccess('only', ['getinfo', 'getnetworkhashps', 'getmininginfo','getdifficulty', 'getconnectioncount',
  'getmasternodecount', 'getmasternodecountonline', 'getmasternodelist', 'getvotelist', 'getblockcount', 'getblockhash', 'getblock', 'getrawtransaction', 
  'getpeerinfo', 'gettxoutsetinfo','listmasternodes']);
} else {
  // enable additional heavy api calls
  /*
    getvote - Returns the current block reward vote setting.
    getmaxvote - Returns the maximum allowed vote for the current phase of voting.
    getphase - Returns the current voting phase ('Mint', 'Limit' or 'Sustain').
    getreward - Returns the current block reward, which has been decided democratically in the previous round of block reward voting.
    getnextrewardestimate - Returns an estimate for the next block reward based on the current state of decentralized voting.
    getnextrewardwhenstr - Returns string describing how long until the votes are tallied and the next block reward is computed.
    getnextrewardwhensec - Same as above, but returns integer seconds.
    getsupply - Returns the current money supply.
    getmaxmoney - Returns the maximum possible money supply.
  */
  chaincoinapi.setAccess('only', ['getinfo', 'getstakinginfo', 'getnetworkhashps', 'getdifficulty', 'getconnectioncount',
    'getmasternodecount', 'getmasternodecountonline', 'getmasternodelist', 'getvotelist', 'getblockcount', 'getblockhash', 
    'getblock', 'getrawtransaction', 'getmaxmoney', 'getvote', 'getmaxvote', 'getphase', 'getreward', 'getpeerinfo', 
    'getnextrewardestimate', 'getnextrewardwhenstr', 'getnextrewardwhensec', 'getsupply', 'gettxoutsetinfo','listmasternodes']);
}
// Language setup
i18next
  .use(i18Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    interpolation: {
      format: function(value, format, lng) {
          if (format === 'uppercase') return value.toUpperCase();
          if(value instanceof Date) return moment(value).format(format);
          return value;
        }
    },
    backend: {
      loadPath: __dirname + '/locale/{{lng}}/{{ns}}.json',
      addPath: __dirname + '/locale/{{lng}}/{{ns}}.missing.json'
    },
    detection: {
      order: ['querystring', 'cookie'],
      caches: ['cookie']
    },
   
    fallbackLng: settings.language_fallback,
    preload: settings.language,
    saveMissing: true,
    debug: false
});



// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(i18nextMiddleware.handle(i18next));

app.use(favicon(path.join(__dirname, settings.favicon)));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Add Languages to Local Variabels
app.use(function (req, res, next) {
  res.locals.currentlang = req.language;

  next();
})

// Language Files for Datatable
app.use('/datatable/lang', function(req,res){
    i18next.changeLanguage(req.language, (err, t) => {
      if (err) return console.log('something went wrong loading', err);
      res.send(i18next.t("datatable", { returnObjects: true }));
    });   
});


// routes
app.use('/api', chaincoinapi.app);
app.use('/', routes);
app.use('/ext/getmoneysupply', function(req,res){
  lib.get_supply(function(supply){
    res.send(' '+supply);
  });
});

app.use('/ext/getaddress/:hash', function(req,res){
  db.get_address(req.param('hash'), function(address){
    if (address) {
      var a_ext = {
        address: address.a_id,
        sent: (address.sent / 100000000),
        received: (address.received / 100000000),
        balance: (address.balance / 100000000).toString().replace(/(^-+)/mg, ''),
        last_txs: address.txs,
      };
      res.send(a_ext);
    } else {
      res.send({ error: 'address not found.', hash: req.param('hash')})
    }
  });
});

app.use('/ext/getbalance/:hash', function(req,res){
  db.get_address(req.param('hash'), function(address){
    if (address) {
      res.send((address.balance / 100000000).toString().replace(/(^-+)/mg, ''));
    } else {
      res.send({ error: 'address not found.', hash: req.param('hash')})
    }
  });
});

app.use('/ext/getdistribution', function(req,res){
  db.get_richlist(settings.coin, function(richlist){
    db.get_stats(settings.coin, function(stats){
      db.get_distribution(richlist, stats, function(dist){
        res.send(dist);
      });
    });
  });
});

app.use('/ext/getlasttxs/:min', function(req,res){
  db.get_last_txs(settings.index.last_txs, (req.params.min * 100000000), function(txs){
    res.send({data: txs});
  });
});

//FIX
app.use('/ext/getaddrtxs1/:hash', function(req,res){
  db.get_address(req.param('hash'), function(address) {
    if (address) {
      var txs = [];
      var hashes = address.txs.reverse();
      var count = 1;
      lib.syncLoop(count, function (loop) {
        var i = loop.iteration();
        db.get_tx(hashes[i].addresses, function(tx) {
          if (tx) {
            txs.push(tx);
            loop.next();
          } else {
            loop.next();
          }
        });
      }, function(){
        res.send({data: txs});
      });
    } else {
      res.send({error: 'address not found', hash: req.param('hash')});
    }
  });
});

app.use('/ext/getaddrtxs2/:hash/:count', function(req,res){
  db.get_address(req.param('hash'), function(address) {
    if (address) {
      var txs = [];
      var hashes = address.txs.reverse();
      var count = req.param('count');
      if (address.txs.length < count) {
        count = address.txs.length;
      }
      console.log(count);
      lib.syncLoop(count, function (loop) {
        var i = loop.iteration();
        db.get_tx(hashes[i].addresses, function(tx) {
          if (tx) {
            txs.push(tx);
            loop.next();
          } else {
            loop.next();
          }
        });
      }, function(){
        res.send({data: txs});
      });
    } else {
      res.send({error: 'address not found', hash: req.param('hash')});
    }
  });
});

app.use('/ext/getaddrtxs/:hash/:count/:sort', function(req,res){
  db.get_address(req.param('hash'), function(address) {
    if (address) {
      var txs = [];
      var hashes = [];
      if(req.param('sort')==='desc') {
        hashes = address.txs;
      } else {
        hashes = address.txs.reverse();
      }
      var count = req.param('count');
      if (address.txs.length < count) {
        count = address.txs.length;
      }
      console.log(count);
      lib.syncLoop(count, function (loop) {
        var i = loop.iteration();
        db.get_tx(hashes[i].addresses, function(tx) {
          if (tx) {
            txs.push(tx);
            loop.next();
          } else {
            loop.next();
          }
        });
      }, function(){
        res.send({data: txs});
      });
    } else {
      res.send({error: 'address not found', hash: req.param('hash')});
    }
  });
});


app.use('/ext/connections', function(req,res){
  db.get_peers(function(peers){
    res.send({data: peers});
  });
});

//Masternodes 
app.use('/ext/getmasternodes', function(req, res) {
   db.get_masternodes(function(masternode){
    res.send({data: masternode});
   });
});

// locals
app.set('title', settings.title);
app.set('symbol', settings.symbol);
app.set('coin', settings.coin);
//app.set('locale', locale);
app.set('display', settings.display);
app.set('markets', settings.markets);
app.set('twitter', settings.twitter);
app.set('facebook', settings.facebook);
app.set('googleplus', settings.googleplus);
app.set('bitcointalk', settings.bitcointalk);
app.set('slack', settings.slack);
app.set('github', settings.github);
app.set('discord', settings.discord);
app.set('website', settings.website);
app.set('genesis_block', settings.genesis_block);
app.set('index', settings.index);
app.set('heavy', settings.heavy);
app.set('txcount', settings.txcount);
app.set('nethash', settings.nethash);
app.set('nethash_units', settings.nethash_units);
app.set('show_sent_received', settings.show_sent_received);
app.set('logo', settings.logo);
app.set('theme', settings.theme);
app.set('labels', settings.labels);
app.set('languages', settings.languages);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

// Add below line here
secureServer.listen(443);

module.exports = app;
