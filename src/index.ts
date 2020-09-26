declare type contextAsyncFunc = <T>(data: T) => Promise<void>;
declare type serialAsyncFunc = <I, C>(
  ingressData: I,
  contextData: C
) => Promise<void>;
declare type parallelAsyncFunc = <I, C>(
  ingressData: I,
  contextData: C
) => Promise<void>;

export class CodeHarmony<ContextDataType, IngressDataType> {
  private contextData: ContextDataType | null;
  private ingressData: IngressDataType;

  private contextPromise: Promise<void> | null;
  private parallelPromise: Promise<void[]> | null;
  private serialPromise: Promise<void[]> | null;

  private contextAsyncFuncs: contextAsyncFunc[];
  private serialAsyncFuncs: serialAsyncFunc[];
  private parallelAsyncFuncs: parallelAsyncFunc[];

  /**
   * @param data Any kind of ingress data, either by any event or passed deliberately
   */
  constructor(data: IngressDataType) {
    this.contextData = null;
    this.ingressData = data;

    this.contextPromise = null;
    this.parallelPromise = null;
    this.serialPromise = null;

    this.contextAsyncFuncs = [];
    this.serialAsyncFuncs = [];
    this.parallelAsyncFuncs = [];
  }

  private registerSerialFunctions(functionsArray: serialAsyncFunc[]) {
    this.serialAsyncFuncs.push(...functionsArray);
  }

  private registerParallelFunctions(functionsArray: parallelAsyncFunc[]) {
    this.parallelAsyncFuncs.push(...functionsArray);
  }

  private registerContextFunctions(functionsArray: contextAsyncFunc[]) {
    this.contextAsyncFuncs.push(...functionsArray);
  }

  private runContextFunctions() {
    const { contextAsyncFuncs, ingressData } = this;
    this.contextPromise = Promise.all(
      contextAsyncFuncs.map((asyncFnc) => asyncFnc(ingressData))
    ).then((resp) => {
      this.contextData = resp.reduce(
        (data, iter) => Object.assign(iter, data),
        <ContextDataType>{}
      );
    });
  }

  private async runSerialFunctions() {
    const { serialAsyncFuncs, ingressData, contextData } = this;
    this.serialPromise = (async () => {
      const toReturn = [];
      for (const asyncFnc of serialAsyncFuncs) {
        toReturn.push(await asyncFnc(ingressData, contextData));
      }
      return toReturn;
    })();
  }

  private runParallelFunctions() {
    const { parallelAsyncFuncs, ingressData, contextData } = this;
    this.parallelPromise = Promise.all(
      parallelAsyncFuncs.map((asyncFnc) => asyncFnc(ingressData, contextData))
    );
  }

  private contextChecks() {
    if (!this.contextPromise) {
      this.runContextFunctions();
    }
  }

  /**
   * Pass any number of functions which return a Promise and
   * the data returned in the Promise is set in the **context**
   * object to share it across the subsequent `parallelly` and `serially`
   * functions (available as a second parameter, check `serially`
   * and `parallelly` function params signature)
   * @param asyncFncs N number of asynchronous functions that return a Promise
   * @returns this
   */
  context(...asyncFncs: contextAsyncFunc[]) {
    this.registerContextFunctions(asyncFncs);
    return this;
  }

  /**
   * Passed functions in the parameters run serially, one after the another
   * The passed functions should expect to receive 2 parameters:
   *   1. The ingress data which was passed during instantiation
   *   2. Context object (optional)
   * @param asyncFncs N number of asynchronous functions that return a Promise
   * @returns this
   */
  serially(...asyncFncs: serialAsyncFunc[]) {
    this.registerSerialFunctions(asyncFncs);
    return this;
  }

  /**
   * Passed functions in the parameters run parallelly, together.
   * The passed functions should expect to receive 2 parameters:
   *   1. The ingress data which was passed during instantiation
   *   2. Context object (optional)
   * @param asyncFncs N number of asynchronous functions that return a Promise
   * @returns this
   */
  parallelly(...asyncFncs: parallelAsyncFunc[]) {
    this.registerParallelFunctions(asyncFncs);
    return this;
  }

  /**
   * Marks the finishing of the chain, returns
   * a promise which resolves when all the provided
   * functions resolve in `serially` or `parallelly`
   * @param callback optional if callback support required
   * @returns Promise
   */
  async finish(callback?: (err: Error | null, data?: object) => void) {
    try {
      this.contextChecks();
      await this.contextPromise;

      this.runSerialFunctions();
      this.runParallelFunctions();

      const tasks = Promise.all([this.parallelPromise, this.serialPromise]);

      if (!callback) {
        return tasks;
      }

      return callback(null, await tasks);
    } catch (error) {
      if (!callback) {
        return Promise.reject(error);
      }
      return callback(error);
    }
  }
}
