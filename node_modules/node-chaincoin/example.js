var chaincoin = require('./lib');    

var client = new chaincoin.Client({
  host: 'localhost',
  port: '11995',
  user: 'rpcuser',
  pass: 'rpcpassword'
});

client.getBalance('*', 6, function(err, balance) {
  if (err) return console.log(err);
  console.log('Balance:', balance);
});

client.cmd('getbalance', '*', 6, function(err, balance){
  if (err) return console.log(err);
  console.log('Balance:', balance);
});  

console.log('Master node info:');

client.masternode('list', 'activeseconds', '45.63.18.110', function(err, activeseconds){
  if (err) return console.log(err);
  console.log(activeseconds);
});

client.masternode('count', function(err, count){
  if (err) return console.log(err);
  console.log(count);
});

/*client.masternode('list', function(err, list){
  if (err) return console.log(err);
  console.log(list);
});*/
