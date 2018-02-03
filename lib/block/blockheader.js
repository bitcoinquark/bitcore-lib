'use strict';

var _ = require('lodash');
var BN = require('../crypto/bn');
var BufferUtil = require('../util/buffer');
var BufferReader = require('../encoding/bufferreader');
var BufferWriter = require('../encoding/bufferwriter');
var Hash = require('../crypto/hash');
var JSUtil = require('../util/js');
var $ = require('../util/preconditions');

var GENESIS_BITS = 0x1d00ffff;

//BitcoinQuark
//mainnet 0x1f07ffff
//testnet 0x1f7fffff
//regtest 0x207fffff
var QUARK_GENESIS_BITS = 0x1f7fffff;

var LOCKTIME_THRESHOLD = 500000000; // Tue Nov  5 00:53:20 1985 UTC

/**
 * Instantiate a BlockHeader from a Buffer, JSON object, or Object with
 * the properties of the BlockHeader
 *
 * @param {*} - A Buffer, JSON string, or Object
 * @returns {BlockHeader} - An instance of block header
 * @constructor
 */
var BlockHeader = function BlockHeader(arg) {
  if (!(this instanceof BlockHeader)) {
    return new BlockHeader(arg);
  }
  var info = BlockHeader._from(arg);
  this.version = info.version;
  this.prevHash = info.prevHash;
  this.merkleRoot = info.merkleRoot;
  this.height = info.height;
  this.reserved = info.reserved;  
  this.time = info.time;
  this.timestamp = info.time;
  this.bits = info.bits;
  this.nonce = info.nonce;
  this.solution = info.solution;  

  if (info.hash) {
    $.checkState(
      this.hash === info.hash,
      'Argument object hash property does not match block hash.'
    );
  }

  return this;
};

/**
 * @param {*} - A time or height field
 * @returns {boolean} - Is BitcoinQuark block or Legacy block
 */
BlockHeader._isBitcoinQuark = function _isBitcoinQuark(arg) {
	
    if(!arg) {
        return false;
    }
    if(arg > LOCKTIME_THRESHOLD) {
        return false;
    }
    // has height field
    return true;
};

/**
 * @param {*} - A Buffer, JSON string or Object
 * @returns {Object} - An object representing block header data
 * @throws {TypeError} - If the argument was not recognized
 * @private
 */
BlockHeader._from = function _from(arg) {
  var info = {};
  if (BufferUtil.isBuffer(arg)) {
    info = BlockHeader._fromBufferReader(BufferReader(arg));
  } else if (_.isObject(arg)) {
    info = BlockHeader._fromObject(arg);
  } else {
    throw new TypeError('Unrecognized argument for BlockHeader');
  }
  return info;
};

/**
 * @param {Object} - A JSON string
 * @returns {Object} - An object representing block header data
 * @private
 */
BlockHeader._fromObject = function _fromObject(data) {
  $.checkArgument(data, 'data is required');
  var prevHash = data.prevHash;
  var merkleRoot = data.merkleRoot;
  var height = data.height;
  var isBitcoinQuark = BlockHeader._isBitcoinQuark(height);
  var reserved = data.reserved;
  var nonce = data.nonce;
  var solution = data.solution;  
  if (_.isString(data.prevHash)) {
    prevHash = BufferUtil.reverse(new Buffer(data.prevHash, 'hex'));
  }
  if (_.isString(data.merkleRoot)) {
    merkleRoot = BufferUtil.reverse(new Buffer(data.merkleRoot, 'hex'));
  }
 
  if(isBitcoinQuark) {
      if (_.isString(data.reserved)) {
          reserved = BufferUtil.reverse(new Buffer(data.reserved, 'hex'));
      }
      if (_.isString(data.nonce)) {
          nonce = BufferUtil.reverse(new Buffer(data.nonce, 'hex'));
      }
      if (_.isString(data.solution)) {
          solution = new Buffer(data.solution, 'hex');
      }  
  } 
  
  var info = {
    hash: data.hash,
    version: data.version,
    prevHash: prevHash,
    height: height,
    merkleRoot: merkleRoot,
    reserved: reserved,
    time: data.time,
    timestamp: data.time,
    bits: data.bits,
    nonce: data.nonce,
    solution: solution
  };
  return info;
};

/**
 * @param {Object} - A plain JavaScript object
 * @returns {BlockHeader} - An instance of block header
 */
BlockHeader.fromObject = function fromObject(obj) {
  var info = BlockHeader._fromObject(obj);
  return new BlockHeader(info);
};

/**
 * @param {Binary} - Raw block binary data or buffer
 * @returns {BlockHeader} - An instance of block header
 */
BlockHeader.fromRawBlock = function fromRawBlock(data) {
  if (!BufferUtil.isBuffer(data)) {
    data = new Buffer(data, 'binary');
  }
  var br = BufferReader(data);
  br.pos = BlockHeader.Constants.START_OF_HEADER;
  var info = BlockHeader._fromBufferReader(br);
  return new BlockHeader(info);
};

/**
 * @param {Buffer} - A buffer of the block header
 * @returns {BlockHeader} - An instance of block header
 */
BlockHeader.fromBuffer = function fromBuffer(buf) {
  var info = BlockHeader._fromBufferReader(BufferReader(buf));
  return new BlockHeader(info);
};

/**
 * @param {string} - A hex encoded buffer of the block header
 * @returns {BlockHeader} - An instance of block header
 */
BlockHeader.fromString = function fromString(str) {
  var buf = new Buffer(str, 'hex');
  return BlockHeader.fromBuffer(buf);
};

/**
 * @param {BufferReader} - A BufferReader of the block header
 * @returns {Object} - An object representing block header data
 * @private
 */
BlockHeader._fromBufferReader = function _fromBufferReader(br) {
  var info = {};
  info.version = br.readUInt32LE();
  info.prevHash = br.read(32);
  info.merkleRoot = br.read(32);
  var timeOrHeight = br.readUInt32LE();
  var isBitcoinQuark = BlockHeader._isBitcoinQuark(timeOrHeight);
  if(isBitcoinQuark) {
      info.height = timeOrHeight;
      info.reserved = br.read(28);
      info.time = br.readUInt32LE();
      info.bits = br.readUInt32LE();
      info.nonce = br.read(32);
      var lenSolution = br.readVarintNum();
      info.solution = br.read(lenSolution); 
  } else {
      info.time = timeOrHeight;
      info.bits = br.readUInt32LE();
      info.nonce = br.readUInt32LE();
  }
  return info;
};

/**
 * @param {BufferReader} - A BufferReader of the block header
 * @returns {BlockHeader} - An instance of block header
 */
BlockHeader.fromBufferReader = function fromBufferReader(br) {
  var info = BlockHeader._fromBufferReader(br);
  return new BlockHeader(info);
};

/**
 * @returns {Object} - A plain object of the BlockHeader
 */
BlockHeader.prototype.toObject = BlockHeader.prototype.toJSON = function toObject() {
    var isBitcoinQuark = BlockHeader._isBitcoinQuark(this.height);
    if(isBitcoinQuark) {
        return {
        hash: this.hash,
        version: this.version,
        prevHash: BufferUtil.reverse(this.prevHash).toString('hex'),
        merkleRoot: BufferUtil.reverse(this.merkleRoot).toString('hex'),
        height: this.height,
        reserved: BufferUtil.reverse(this.reserved).toString('hex'),
        time: this.time,
        bits: this.bits,
        nonce: BufferUtil.reverse(this.nonce).toString('hex'),
        solution: this.solution.toString('hex')
        };
    } else {
        return {
        hash: this.hash,
        version: this.version,
        prevHash: BufferUtil.reverse(this.prevHash).toString('hex'),
        merkleRoot: BufferUtil.reverse(this.merkleRoot).toString('hex'),
        time: this.time,
        bits: this.bits,
        nonce: this.nonce
        };
    }
};

/**
 * @returns {Buffer} - A Buffer of the BlockHeader
 */
BlockHeader.prototype.toBuffer = function toBuffer() {
  return this.toBufferWriter().concat();
};

/**
 * @returns {string} - A hex encoded string of the BlockHeader
 */
BlockHeader.prototype.toString = function toString() {
  return this.toBuffer().toString('hex');
};

/**
 * @param {BufferWriter} - An existing instance BufferWriter
 * @returns {BufferWriter} - An instance of BufferWriter representation of the BlockHeader
 */
BlockHeader.prototype.toBufferWriter = function toBufferWriter(bw) {
  if (!bw) {
    bw = new BufferWriter();
  }
  bw.writeUInt32LE(this.version);
  bw.write(this.prevHash);
  bw.write(this.merkleRoot);
  var isBitcoinQuark = BlockHeader._isBitcoinQuark(this.height);
  if(isBitcoinQuark) {
        bw.writeUInt32LE(this.height);
        bw.write(this.reserved);
        bw.writeUInt32LE(this.time);
        bw.writeUInt32LE(this.bits);
        bw.write(this.nonce);
        bw.writeVarintNum(this.solution.length);
        bw.write(this.solution);  
  } else {
	    bw.writeUInt32LE(this.time);
        bw.writeUInt32LE(this.bits);
        bw.writeUInt32LE(this.nonce);
  }
  return bw;
};

/**
 * Returns the target difficulty for this block
 * @param {Number} bits
 * @returns {BN} An instance of BN with the decoded difficulty bits
 */
BlockHeader.prototype.getTargetDifficulty = function getTargetDifficulty(bits) {
  bits = bits || this.bits;

  var target = new BN(bits & 0xffffff);
  var mov = 8 * ((bits >>> 24) - 3);
  while (mov-- > 0) {
    target = target.mul(new BN(2));
  }
  return target;
};

/**
 * @link https://en.bitcoin.it/wiki/Difficulty
 * @return {Number}
 */
BlockHeader.prototype.getDifficulty = function getDifficulty() {

  var isBitcoinQuark = BlockHeader._isBitcoinQuark(this.height);

  var genesisBits = GENESIS_BITS;
  if(isBitcoinQuark) {
      genesisBits = QUARK_GENESIS_BITS;
  }
  var difficulty1TargetBN = this.getTargetDifficulty(genesisBits).mul(new BN(Math.pow(10, 8)));
	  
  var currentTargetBN = this.getTargetDifficulty();
  if(currentTargetBN == 0) {
      return 1;
  }  

  var difficultyString = difficulty1TargetBN.div(currentTargetBN).toString(10);
  var decimalPos = difficultyString.length - 8;
  difficultyString = difficultyString.slice(0, decimalPos) + '.' + difficultyString.slice(decimalPos);

  return parseFloat(difficultyString);
};

/**
 * @returns {Buffer} - The little endian hash buffer of the header
 */
BlockHeader.prototype._getHash = function hash() {
  var buf = this.toBuffer();
  return Hash.sha256sha256(buf);
};

var idProperty = {
  configurable: false,
  enumerable: true,
  /**
   * @returns {string} - The big endian hash buffer of the header
   */
  get: function() {
    if (!this._id) {
      this._id = BufferReader(this._getHash()).readReverse().toString('hex');
    }
    return this._id;
  },
  set: _.noop
};
Object.defineProperty(BlockHeader.prototype, 'id', idProperty);
Object.defineProperty(BlockHeader.prototype, 'hash', idProperty);

/**
 * @returns {Boolean} - If timestamp is not too far in the future
 */
BlockHeader.prototype.validTimestamp = function validTimestamp() {
  var currentTime = Math.round(new Date().getTime() / 1000);
  if (this.time > currentTime + BlockHeader.Constants.MAX_TIME_OFFSET) {
    return false;
  }
  return true;
};

/**
 * @returns {Boolean} - If the proof-of-work hash satisfies the target difficulty
 */
BlockHeader.prototype.validProofOfWork = function validProofOfWork() {
  var pow = new BN(this.id, 'hex');
  var target = this.getTargetDifficulty();

  if (pow.cmp(target) > 0) {
    return false;
  }
  return true;
};

/**
 * @returns {string} - A string formatted for the console
 */
BlockHeader.prototype.inspect = function inspect() {
  return '<BlockHeader ' + this.id + '>';
};

BlockHeader.Constants = {
  START_OF_HEADER: 8, // Start buffer position in raw block data
  MAX_TIME_OFFSET: 2 * 60 * 60, // The max a timestamp can be in the future
  LARGEST_HASH: new BN('10000000000000000000000000000000000000000000000000000000000000000', 'hex')
};

module.exports = BlockHeader;
