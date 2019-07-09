var mongoose = require('mongoose')
  , Schema = mongoose.Schema;
 
var TxSchema = new Schema({
  txid: { type: String, lowercase: true, unique: true, index: true},
  vin: { type: Array, default: [] },
  vout: { type: Array, default: [] },
  total: { type: Number, default: 0 , index: true},
  timestamp: { type: Number, default: 0 , index: true },
  blockhash: { type: String },
  blockindex: {type: Number, default: 0},
}, {id: false});

module.exports = mongoose.model('Tx', TxSchema);
