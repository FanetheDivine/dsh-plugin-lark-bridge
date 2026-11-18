/** 插件可诊断错误：携带稳定错误码，供工具与路由返回。 */
export class BridgeError extends Error {
  /** 稳定错误码。 */
  readonly code: string;

  /**
   * @param code - 稳定错误码。
   * @param message - 面向用户的说明。
   */
  constructor(code: string, message: string) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
  }
}
