"use strict"

var Promise = require('./util').Promise,
  Cursor = require('./cursor');

class Collection {
  constructor(name, db) {
    this.name = name;
    this.db = db;
    this.namespace = db.name + "." + name;
  }

  /**
   * Inserts a single document into MongoDB. If documents passed in do not contain the **_id** field,
   * one will be added to each of the documents missing it by the driver, mutating the document. This behavior
   * can be overridden by setting the **forceServerObjectId** flag.
   *
   * @method
   * @param {object} doc Document to insert.
   * @param {object} [options=null] Optional settings.
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @return {Promise} returns Promise
   */
  insertOne(document, options) {
    return this.db.command({
      ns: this.namespace,
      insertOne: Object.assign({
        doc: document
      }, options || {})
    });
  }

  /**
   * Inserts an array of documents into MongoDB. If documents passed in do not contain the **_id** field,
   * one will be added to each of the documents missing it by the driver, mutating the document. This behavior
   * can be overridden by setting the **forceServerObjectId** flag.
   *
   * @method
   * @param {object[]} docs Documents to insert.
   * @param {object} [options=null] Optional settings.
   * @param {boolean} [options.ordered=true] Execute write operation in ordered or unordered fashion.
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @return {Promise} returns Promise
   */
  insertMany(documents, options) {
    return this.db.command({
      ns: this.namespace,
      insertMany: Object.assign({
        docs: documents
      }, options || {})
    });
  }

  /**
   * Update a single document on MongoDB
   * @method
   * @param {object} filter The Filter used to select the document to update
   * @param {object} update The update operations to be applied to the document
   * @param {object} [options=null] Optional settings.
   * @param {boolean} [options.upsert=false] Update operation is an upsert.
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @return {Promise} returns Promise
   */
  updateOne(filter, update, options) {
    return this.db.command({
      ns: this.namespace,
      updateOne: Object.assign({
        q: selector,
        u: update
      }, options || {})
    });
  }

  /**
   * Update multiple documents on MongoDB
   * @method
   * @param {object} filter The Filter used to select the document to update
   * @param {object} update The update operations to be applied to the document
   * @param {object} [options=null] Optional settings.
   * @param {boolean} [options.upsert=false] Update operation is an upsert.
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @return {Promise} returns Promise
   */
  updateMany(selector, update, options) {
    return this.db.command({
      ns: this.namespace,
      updateMany: Object.assign({
        q: selector,
        u: update
      }, options || {})
    });
  }

  /**
   * Replace a document on MongoDB
   * @method
   * @param {object} filter The Filter used to select the document to update
   * @param {object} doc The Document that replaces the matching document
   * @param {object} [options=null] Optional settings.
   * @param {boolean} [options.upsert=false] Update operation is an upsert.
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @return {Promise} returns Promise
   */
  replaceOne(filter, doc, options) {
    return this.db.command({
      ns: this.namespace,
      replaceOne: Object.assign({
        q: filter, u: doc
      }, options || {})
    });
  }

  /**
   * Delete a document on MongoDB
   * @method
   * @param {object} filter The Filter used to select the document to remove
   * @param {object} [options=null] Optional settings.
   * @return {Promise} returns Promise
   */
  deleteOne(selector, options) {
    return this.db.command({
      ns: this.namespace,
      deleteOne: Object.assign({
        q: selector
      }, options || {})
    });
  }

  /**
   * Delete multiple documents on MongoDB
   * @method
   * @param {object} filter The Filter used to select the documents to remove
   * @param {object} [options=null] Optional settings.
   * @return {Promise} returns Promise
   */
  deleteMany(selector, options) {
    return this.db.command({
      ns: this.namespace,
      deleteMany: Object.assign({
        q: selector
      }, options || {})
    });
  }

  /**
   * Find a document and delete it in one atomic operation, requires a write lock for the duration of the operation.
   *
   * @method
   * @param {object} filter Document selection filter.
   * @param {object} [options=null] Optional settings.
   * @param {object} [options.projection=null] Limits the fields to return for all matching documents.
   * @param {object} [options.sort=null] Determines which document the operation modifies if the query selects multiple documents.
   * @param {number} [options.maxTimeMS=null] The maximum amount of time to allow the query to run.
   * @return {Promise} returns Promise
   */
  findOneAndDelete(selector, options) {
    return this.db.command({
      ns: this.namespace,
      findOneAndDelete: Object.assign({
        q: selector
      }, options || {})
    });
  }

  /**
   * Find a document and update it in one atomic operation, requires a write lock for the duration of the operation.
   *
   * @method
   * @param {object} filter Document selection filter.
   * @param {object} update Update operations to be performed on the document
   * @param {object} [options=null] Optional settings.
   * @param {object} [options.projection=null] Limits the fields to return for all matching documents.
   * @param {object} [options.sort=null] Determines which document the operation modifies if the query selects multiple documents.
   * @param {number} [options.maxTimeMS=null] The maximum amount of time to allow the query to run.
   * @param {boolean} [options.upsert=false] Upsert the document if it does not exist.
   * @param {boolean} [options.returnOriginal=true] When false, returns the updated document rather than the original. The default is true.
   * @return {Promise} returns Promise
   */
  findOneAndUpdate(selector, update, options) {
    return this.db.command({
      ns: this.namespace,
      findOneAndUpdate: Object.assign({
        q: selector,
        u: update
      }, options || {})
    });
  }

  /**
   * Find a document and replace it in one atomic operation, requires a write lock for the duration of the operation.
   *
   * @method
   * @param {object} filter Document selection filter.
   * @param {object} replacement Document replacing the matching document.
   * @param {object} [options=null] Optional settings.
   * @param {object} [options.projection=null] Limits the fields to return for all matching documents.
   * @param {object} [options.sort=null] Determines which document the operation modifies if the query selects multiple documents.
   * @param {number} [options.maxTimeMS=null] The maximum amount of time to allow the query to run.
   * @param {boolean} [options.upsert=false] Upsert the document if it does not exist.
   * @param {boolean} [options.returnOriginal=true] When false, returns the updated document rather than the original. The default is true.
   * @return {Promise} returns Promise
   */
  findOneAndReplace(selector, replace, options) {
    return this.db.command({
      ns: this.namespace,
      findOneAndReplace: Object.assign({
        q: selector,
        u: replace
      }, options || {})
    });
  }

  /**
   * Perform a bulkWrite operation without a fluent API
   *
   * Legal operation types are
   *
   *  { insertOne: { document: { a: 1 } } }
   *
   *  { updateOne: { filter: {a:2}, update: {$set: {a:2}}, upsert:true } }
   *
   *  { updateMany: { filter: {a:2}, update: {$set: {a:2}}, upsert:true } }
   *
   *  { deleteOne: { filter: {c:1} } }
   *
   *  { deleteMany: { filter: {c:1} } }
   *
   *  { replaceOne: { filter: {c:3}, replacement: {c:4}, upsert:true}}
   *
   * If documents passed in do not contain the **_id** field,
   * one will be added to each of the documents missing it by the driver, mutating the document. This behavior
   * can be overridden by setting the **forceServerObjectId** flag.
   *
   * @method
   * @param {object[]} operations Bulk operations to perform.
   * @param {object} [options=null] Optional settings.
   * @param {(number|string)} [options.w=null] The write concern.
   * @param {number} [options.wtimeout=null] The write concern timeout.
   * @param {boolean} [options.ordered=true] Execute write operation in ordered or unordered fashion.
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @return {Promise} returns Promise
   */
  bulkWrite(operations, options) {
    return this.db.command({
      ns: this.namespace,
      bulkWrite: Object.assign({ops: operations}, options || {})
    });
  }

  /**
   * Creates a cursor for a query that can be used to iterate over results from MongoDB
   * @method
   * @param {object} query The cursor query object.
   * @throws {MongoError}
   * @return {Cursor}
   */
  find(query) {
    return new Cursor(this.db, this, query);
  }
}

module.exports = Collection;
