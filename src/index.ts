import { EventEmitter } from 'eventemitter3';

const DEFAULT_TARGET_ORIGIN = '*';
const DEFAULT_TIMEOUT_MILLISECONDS = 60000;

const JSON_RPC_VERSION = '2.0';

interface IFrameEthereumProviderOptions {
  // The origin to communicate with. Default '*'
  targetOrigin?: string;
  // How long to time out waiting for responses.
  timeoutMilliseconds?: number;
}

/**
 * Return true if the current window context appears to be embedded within an iframe element.
 *
 * This should be checked before the provider is used.
 */
export function isEmbeddedInIFrame(): boolean {
  return window && window.parent !== window.self;
}

interface PromiseCompleter<T = any> {
  resolve: (result: T) => void;
  reject: (error: Error) => void;
}

type MessageId = number | string | null;

interface JsonRpcRequestMessage<TParams = any> {
  jsonrpc: '2.0';
  // Optional in the request.
  id?: MessageId;
  method: string;
  params?: TParams;
}

interface BaseJsonRpcResponseMessage {
  // Required but null if not identified in request
  id: MessageId;
  jsonrpc: '2.0';
}

interface JsonRpcSucessfulResponseMessage<TResult = any>
  extends BaseJsonRpcResponseMessage {
  result: TResult;
}

interface JsonRpcError<TData = any> {
  code: number;
  message: string;
  data?: TData;
}

interface JsonRpcErrorResponseMessage<TErrorData = any>
  extends BaseJsonRpcResponseMessage {
  error: JsonRpcError<TErrorData>;
}

type ReceivedMessageType =
  | JsonRpcRequestMessage
  | JsonRpcErrorResponseMessage
  | JsonRpcSucessfulResponseMessage;

/**
 * We return a random number between the 0 and the maximum safe integer so that we always generate a unique identifier,
 * across all communication channels.
 */
function getUniqueId(): string {
  return '' + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

export type IFrameEthereumProviderEventTypes =
  | 'connect'
  | 'close'
  | 'notification'
  | 'chainChanged'
  | 'networkChanged'
  | 'accountsChanged';

/**
 * Export the type information about the different events that are emitted.
 */
export interface IFrameEthereumProvider {
  on(event: 'connect', handler: () => void): this;

  on(event: 'close', handler: (code: number, reason: string) => void): this;

  on(event: 'notification', handler: (result: any) => void): this;

  on(event: 'chainChanged', handler: (chainId: string) => void): this;

  on(event: 'networkChanged', handler: (networkId: string) => void): this;

  on(event: 'accountsChanged', handler: (accounts: string[]) => void): this;
}

export class IFrameEthereumProvider extends EventEmitter<
  IFrameEthereumProviderEventTypes
> {
  private readonly targetOrigin: string;
  private readonly timeoutMilliseconds: number;
  private readonly completers: { [id: string]: PromiseCompleter } = {};

  public constructor({
    targetOrigin = DEFAULT_TARGET_ORIGIN,
    timeoutMilliseconds = DEFAULT_TIMEOUT_MILLISECONDS,
  }: IFrameEthereumProviderOptions = {}) {
    // Call super for `this` to be defined
    super();

    this.targetOrigin = targetOrigin;
    this.timeoutMilliseconds = timeoutMilliseconds;

    // Listen for messages from the provider
    window.addEventListener('message', this.handleJsonrpcMessage.bind(this));
  }

  /**
   * Send the JSON RPC
   * @param method method to send to the parent provider
   * @param params parameters to send
   */
  public async send<TParams = any[], TResult = any>(
    method: string,
    params: TParams
  ): Promise<TResult> {
    if (!isEmbeddedInIFrame()) {
      throw new Error('Not embedded within an iframe.');
    }

    const id = getUniqueId();
    const payload: JsonRpcRequestMessage = {
      jsonrpc: JSON_RPC_VERSION,
      id,
      method,
      params,
    };

    const promise = new Promise<TResult>((resolve, reject) => {
      this.completers[id] = { resolve, reject };
    });

    // Send the JSON RPC to the parent window.
    window.parent.postMessage(payload, this.targetOrigin);

    // Delete the completer within the timeout and reject the promise.
    window.setTimeout(() => {
      if (this.completers[id]) {
        this.completers[id].reject(
          new Error(
            `RPC ID ${id} timed out after ${this.timeoutMilliseconds} milliseconds`
          )
        );
        delete this.completers[id];
      }
    }, this.timeoutMilliseconds);

    return promise;
  }

  /**
   * Backwards compatibility method for web3.
   * @param payload payload to send to the provider
   * @param callback callback to be called when the provider resolves
   */
  public async sendAsync(
    payload: { method: string; params?: any[] },
    callback: (
      error: Error | null,
      result: { method: string; params?: any[]; result: any } | null
    ) => void
  ): Promise<void> {
    try {
      const result = await this.send(payload.method, payload.params);
      callback(null, { ...payload, result });
    } catch (error) {
      callback(error, null);
    }
  }

  /**
   * Handle a message on the window.
   * @param event message event that will be considered if from the parent window
   */
  private handleJsonrpcMessage(event: MessageEvent) {
    const data = event.data;

    // No data to parse, skip.
    if (!data) {
      return;
    }

    const message = data as ReceivedMessageType;

    // Always expect jsonrpc to be set to '2.0'
    if (message.jsonrpc !== JSON_RPC_VERSION) {
      return;
    }

    // If the message has an ID, it is possibly a response message
    if (typeof message.id !== 'undefined' && message.id !== null) {
      const completer = this.completers['' + message.id];

      // True if we haven't timed out and this is a response to a message we sent.
      if (completer) {
        // Handle pending promise
        if ('error' in message) {
          const error = new Error(message.error.message);
          completer.reject(error);
        } else if ('result' in message) {
          completer.resolve(message.result);
        }

        delete this.completers[message.id];
      }
    }

    // If the method is a request from the parent window, it is likely a subscription.
    if ('method' in message) {
      switch (message.method) {
        case 'notification':
          this.emitNotification(message.params);
          break;

        case 'connect':
          this.emitConnect();
          break;

        case 'close':
          this.emitClose(message.params[0], message.params[1]);
          break;

        case 'chainChanged':
          this.emitChainChanged(message.params[0]);
          break;

        case 'networkChanged':
          this.emitNetworkChanged(message.params[0]);
          break;

        case 'accountsChanged':
          this.emitAccountsChanged(message.params[0]);
          break;
      }
    }
  }

  private emitNotification(result: any) {
    this.emit('notification', result);
  }

  private emitConnect() {
    this.emit('connect');
  }

  private emitClose(code: number, reason: string) {
    this.emit('close', code, reason);
  }

  private emitChainChanged(chainId: string) {
    this.emit('chainChanged', chainId);
  }

  private emitNetworkChanged(networkId: string) {
    this.emit('networkChanged', networkId);
  }

  private emitAccountsChanged(accounts: string[]) {
    this.emit('accountsChanged', accounts);
  }
}
