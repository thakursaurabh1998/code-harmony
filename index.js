function _registerSerialFunctions(functionsArray) {
  this._properties.serialAsyncFuncs.push(...functionsArray);
}

function _registerParallelFunctions(functionsArray) {
  this._properties.parallelAsyncFuncs.push(...functionsArray);
}

function _registerContextFunctions(functionsArray) {
  this._properties.contextAsyncFuncs.push(...functionsArray);
}

function _runContextFunctions() {
  const { contextAsyncFuncs, ingressData } = this._properties;
  this._properties.contextPromise = Promise.all(
    contextAsyncFuncs.map((asyncFnc) => asyncFnc(ingressData))
  ).then((resp) => {
    this._properties.contextData = resp.reduce(
      (data, iter) => Object.assign(iter, data),
      {}
    );
  });
}

function _runSerialFunctions() {
  const { serialAsyncFuncs, ingressData, contextData } = this._properties;
  this._properties.serialPromise = (async () => {
    const toReturn = [];
    for (let asyncFnc of serialAsyncFuncs) {
      toReturn.push(await asyncFnc(ingressData, contextData));
    }
    return toReturn;
  })();
}

function _runParallelFunctions() {
  const { parallelAsyncFuncs, ingressData, contextData } = this._properties;
  this._properties.parallelPromise = Promise.all(
    parallelAsyncFuncs.map((asyncFnc) => asyncFnc(ingressData, contextData))
  );
}

function _contextChecks() {
  if (!this._properties.contextPromise) {
    _runContextFunctions.call(this);
  }
}

class CodeHarmony {
  /**
   *
   * @param {any} data Any kind of ingress data, either by any event or passed deliberately
   */
  constructor(data) {
    this._properties = {
      contextData: null,
      ingressData: data,

      contextPromise: null,
      parallelPromise: null,
      serialPromise: null,

      contextAsyncFuncs: [],
      serialAsyncFuncs: [],
      parallelAsyncFuncs: [],
    };
  }

  /**
   * Pass any number of functions which return a Promise and
   * the data returned in the Promise is set in the **context**
   * object to share it across the subsequent `parallelly` and `serially`
   * functions (available as a second parameter, check `serially`
   * and `parallelly` function params signature)
   * @param  {...function(any):Promise} asyncFncs N number of asynchronous functions that return a Promise
   * @returns {this}
   */
  context(...asyncFncs) {
    _registerContextFunctions.call(this, asyncFncs);
    return this;
  }

  /**
   * Passed functions in the parameters run serially, one after the another
   * The passed functions should expect to receive 2 parameters:
   *   1. The ingress data which was passed during instantiation
   *   2. Context object (optional)
   * @param  {...function(any, [Object]):Promise} asyncFncs N number of asynchronous functions that return a Promise
   * @returns {this}
   */
  serially(...asyncFncs) {
    _registerSerialFunctions.call(this, asyncFncs);
    return this;
  }

  /**
   * Passed functions in the parameters run parallelly, together.
   * The passed functions should expect to receive 2 parameters:
   *   1. The ingress data which was passed during instantiation
   *   2. Context object (optional)
   * @param  {...function(any, [Object]):Promise} asyncFncs N number of asynchronous functions that return a Promise
   * @returns {this}
   */
  parallelly(...asyncFncs) {
    _registerParallelFunctions.call(this, asyncFncs);
    return this;
  }

  /**
   * Marks the finishing of the chain, returns
   * a promise which resolves when all the provided
   * functions resolve in `serially` or `parallelly`
   * @param {function(Error, object):any} [callback] optional if callback support required
   * @returns {Promise}
   */
  async finish(callback) {
    try {
      _contextChecks.call(this);
      await this._properties.contextPromise;

      _runSerialFunctions.call(this);
      _runParallelFunctions.call(this);

      const tasks = Promise.all([
        this._properties.parallelPromise,
        this._properties.serialPromise,
      ]);

      if (!callback) {
        return tasks;
      }

      return callback(null, await tasks);
    } catch (error) {
      if (!callback) {
        return Promise.reject(error);
      }
      return callback(error, null);
    }
  }
}

module.exports = CodeHarmony;
