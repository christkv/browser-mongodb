/// reduced to ~ 410 LOCs (parser only 300 vs. 1400+) with (some, needed) BSON classes "inlined".
/// Compare ~ 4,300 (22KB vs. 157KB) in browser build at: https://github.com/mongodb/js-bson/blob/master/browser_build/bson.js

var Long = require('./long'),
  ObjectID = require('./objectid'),
  MinKey = require('./min_key'),
  MaxKey = require('./max_key'),
  Timestamp = require('./timestamp');

// JS MAX PRECISE VALUES
var JS_INT_MAX = 0x20000000000000;  // Any integer up to 2^53 can be precisely represented by a double.
var JS_INT_MIN = -0x20000000000000;  // Any integer down to -2^53 can be precisely represented by a double.

var readIEEE754 = function(buffer, offset, endian, mLen, nBytes) {
  var e, m,
      bBE = (endian === 'big'),
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = bBE ? 0 : (nBytes - 1),
      d = bBE ? 1 : -1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

module.exports.deserializeFast = deserializeFast;

function deserializeFast(buffer, i, isArray){   //// , options, isArray) {       //// no more options!
    if (buffer.length < 5) return new Error('Corrupt bson message < 5 bytes long'); /// from 'throw'
    var elementType, tempindex = 0, name;
    var string, low, high;              /// = lowBits / highBits
                                        /// using 'i' as the index to keep the lines shorter:
    i || ( i = 0 );  /// for parseResponse it's 0; set to running index in deserialize(object/array) recursion
    var object = isArray ? [] : {};         /// needed for type ARRAY recursion later!
    var size = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
    if(size < 5 || size > buffer.length) return new Error('Corrupt BSON message');
/// 'size' var was not used by anything after this, so we can reuse it

    while(true) {                           // While we have more left data left keep parsing
      elementType = buffer[i++];          // Read the type
      if (elementType === 0) break;       // If we get a zero it's the last byte, exit

      tempindex = i;  /// inlined readCStyleString & removed extra i<buffer.length check slowing EACH loop!
      while( buffer[tempindex] !== 0x00 ) tempindex++;  /// read ahead w/out changing main 'i' index
      if (tempindex >= buffer.length) return new Error('Corrupt BSON document: illegal CString')
      name = buffer.toString('utf8', i, tempindex);
      i = tempindex + 1;               /// Update index position to after the string + '0' termination

      switch(elementType) {

        case 7:     /// = BSON.BSON_DATA_OID:
          var array = new Array(12);
          for(var j = 0; j < 12; j++) {
            array[j] = String.fromCharCode(buffer[i+j]);
          }

          i = i + 12;
          object[name] = new ObjectID(array.join(''));   ///... & attach to the new ObjectID instance
          break;

        case 2:     /// = BSON.BSON_DATA_STRING:
          size = buffer[i++] | buffer[i++] <<8 | buffer[i++] <<16 | buffer[i++] <<24;
          object[name] = buffer.toString('utf8', i, i += size -1 );
          i++;
          break;          /// need to get the '0' index "tick-forward" back!

        case 16:    /// = BSON.BSON_DATA_INT:        // Decode the 32bit value
          object[name] = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
          break;

        case 1:     /// = BSON.BSON_DATA_NUMBER:     // Decode the double value
          object[name] = readIEEE754(buffer, i, 'little', 52, 8);
          i += 8;
          break;

        case 8:     /// = BSON.BSON_DATA_BOOLEAN:
          object[name] = buffer[i++] == 1;
          break;

        case 6:     /// = BSON.BSON_DATA_UNDEFINED:     /// deprecated
        case 10:    /// = BSON.BSON_DATA_NULL:
          object[name] = null;
          break;

        case 4:     /// = BSON.BSON_DATA_ARRAY
          size = buffer[i] | buffer[i+1] <<8 | buffer[i+2] <<16 | buffer[i+3] <<24;  /// NO 'i' increment since the size bytes are reread during the recursion!
          object[name] = deserializeFast(buffer, i, true );  /// pass current index & set isArray = true
          i += size;
          break;
        case 3:     /// = BSON.BSON_DATA_OBJECT:
          size = buffer[i] | buffer[i+1] <<8 | buffer[i+2] <<16 | buffer[i+3] <<24;
          object[name] = deserializeFast(buffer, i, false );          /// isArray = false => Object
          i += size;
          break;

        case 5:     /// = BSON.BSON_DATA_BINARY:             // Decode the size of the binary blob
          size = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
          buffer[i++];             /// Skip, as we assume always default subtype, i.e. 0!
          object[name] = buffer.slice(i, i += size); 
          break;

        case 9:     /// = BSON.BSON_DATA_DATE:      /// SEE notes below on the Date type vs. other options...
          low  = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
          high = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
          object[name] = new Date( high * 4294967296 + (low < 0 ? low + 4294967296 : low) );
          break;

        case 18:    /// = BSON.BSON_DATA_LONG:  /// usage should be somewhat rare beyond parseResponse() -> cursorId, where it is handled inline, NOT as part of deserializeFast(returnedObjects); get lowBits, highBits:
          low  = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
          high = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;

          // size = high * 4294967296 + (low < 0 ? low + 4294967296 : low);      /// from long.toNumber()
          object[name] = new Long(low, high);
          break;
          // if (size < JS_INT_MAX && size > JS_INT_MIN) object[name] = size;    /// positive # more likely!
          // else object[name] = new Long(low, high);    break;

        case 127:   /// = BSON.BSON_DATA_MIN_KEY:   /// do we EVER actually get these BACK from MongoDB server?!
          object[name] = new MinKey();
          break;
        case 255:   /// = BSON.BSON_DATA_MAX_KEY:
          object[name] = new MaxKey();
          break;

        case 17:    /// = BSON.BSON_DATA_TIMESTAMP:   /// somewhat obscure internal BSON type; MongoDB uses it for (pseudo) high-res time timestamp (past millisecs precision is just a counter!) in the Oplog ts: field, etc.
          low  = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
          high = buffer[i++] | buffer[i++] << 8 | buffer[i++] << 16 | buffer[i++] << 24;
          object[name] = new Timestamp(low, high);
          break;

///        case 11:    /// = RegExp is skipped; we should NEVER be getting any from the MongoDB server!?
        }   /// end of switch(elementType)
    }   /// end of while(1)
    return object;  // Return the finalized object
}
