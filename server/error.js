function ServerError(code, message) {
  this.code = code;
  this.message = message;
}

module.exports = ServerError;