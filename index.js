class CodeHarmony {
  /**
   *
   * @param {any} data Any kind of ingress data, either by any event or passed deliberately
   */
  constructor(data) {
    this.ingressData = data;
    this.contextData = null;
    this.contextPromise = Promise.resolve();
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
    this.contextPromise = Promise.all(
      asyncFncs.map((asyncFnc) => asyncFnc(this.ingressData))
    ).then((resp) => {
      this.contextData = resp.reduce(
        (data, iter) => Object.assign(iter, data),
        {}
      );
    });
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
    this.seriesPromise = this.contextPromise.then(async () => {
      const toReturn = [];
      for (let asyncFnc of asyncFncs) {
        toReturn.push(await asyncFnc(this.ingressData, this.contextData));
      }
      return toReturn;
    });
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
    this.parallelPromise = this.contextPromise.then(() => {
      return Promise.all(
        asyncFncs.map((asyncFnc) =>
          asyncFnc(this.ingressData, this.contextData)
        )
      );
    });
    return this;
  }

  /**
   * Marks the finishing of the chain, returns
   * a promise which resolves when all the provided
   * functions resolve in `serially` or `parallelly`
   * @param {function(Error, object):any} [cb] optional if callback support required
   * @returns {Promise}
   */
  finish(cb) {
    const dependencies = Promise.all([
      this.parallelPromise,
      this.seriesPromise,
    ]);

    if (!cb) {
      return dependencies;
    }
    return dependencies.then((data) => cb(null, data)).catch(cb);
  }
}

module.exports = CodeHarmony;
