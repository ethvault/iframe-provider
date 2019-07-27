import {
  IFrameEthereumProvider,
  MinimalEventSourceInterface,
  MinimalEventTargetInterface,
} from '../src/index';

class FakeParentWindow implements MinimalEventTargetInterface {
  fakeWindow = new FakeWindow();

  received: { payload: any; targetOrigin: string }[] = [];

  postMessage(payload: any, targetOrigin: string) {
    this.received.push({ payload, targetOrigin });
  }
}

class FakeWindow implements MinimalEventSourceInterface {
  private listeners: any[] = [];

  addEventListener(
    eventType: 'message',
    listener: (event: MessageEvent) => void
  ) {
    if (eventType !== 'message') {
      throw new Error('event type must be message');
    }

    this.listeners.push(listener);
  }

  sendMessage(message: any) {
    this.listeners.forEach(listener => listener({ data: message }));
  }
}

describe('IFrameEthereumProvider', () => {
  let provider: IFrameEthereumProvider;
  let parent: FakeParentWindow;
  let child: FakeWindow;

  beforeEach(() => {
    parent = new FakeParentWindow();
    child = parent.fakeWindow;
    provider = new IFrameEthereumProvider({
      eventTarget: parent,
      eventSource: child,
    });
  });

  describe('properties', () => {
    test('#isIFrame', () => {
      expect(typeof provider.isIFrame).toEqual('boolean');
      expect(provider.isIFrame).toEqual(true);
    });

    test('#currentProvider', () => {
      expect(provider.currentProvider).toEqual(provider);
    });
  });

  describe('#enable', () => {
    test('sends a message to parent', async () => {
      provider.enable();

      expect(parent.received).toHaveLength(1);
      const message = parent.received[0];
      expect(message.payload.jsonrpc).toEqual('2.0');
      expect(message.payload.method).toEqual('enable');
      expect(message.payload.params).toBeUndefined();
      expect(typeof message.payload.id).toBe('number');
    });

    test('returns accounts if the parent responds', async () => {
      const promise = provider.enable();
      const message = parent.received[0];

      child.sendMessage({ jsonrpc: '2.0', result: [], id: message.payload.id });
      expect(await promise).toEqual([]);
    });

    test('throws if parent rejects', async () => {
      const promise = provider.enable();
      const message = parent.received[0];

      child.sendMessage({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Unauthorized' },
        id: message.payload.id,
      });

      let threw = false;
      try {
        await promise;
      } catch (error) {
        threw = true;
        expect(error.isRpcError).toBe(true);
        expect(error.code).toBe(-32000);
        expect(error.reason).toBe('Unauthorized');
      }
      expect(threw).toEqual(true);
    });
  });

  describe('#send', () => {
    test('message structure', async () => {
      provider.send('eth_sign', ['hello', 'world']);
      const message = parent.received[0];

      expect(typeof message.payload.id).toBe('number');
      expect(message.payload.method).toBe('eth_sign');
      expect(message.payload.params).toStrictEqual(['hello', 'world']);
      expect(message.payload.jsonrpc).toBe('2.0');
    });

    test('returns when message received', async () => {
      const promise = provider.send('eth_sign', ['hello', 'world']);
      const message = parent.received[0];

      child.sendMessage({
        jsonrpc: '2.0',
        id: message.payload.id,
        result: '0x0000',
      });
      expect(await promise).toStrictEqual('0x0000');
    });

    test('throws when error received', async () => {
      const promise = provider.send('eth_sign', ['hello', 'world']);
      const message = parent.received[0];

      child.sendMessage({
        jsonrpc: '2.0',
        id: message.payload.id,
        error: { code: 10000, message: 'abc' },
      });

      let threw = false;
      try {
        await promise;
      } catch (error) {
        threw = true;
        expect(error.isRpcError).toBe(true);
        expect(error.code).toBe(10000);
        expect(error.reason).toBe('abc');
      }
      expect(threw).toEqual(true);
    });
  });

  describe('#sendAsync', () => {
    test('message structure', () => {
      provider.sendAsync(
        { method: 'eth_sign', params: ['hello', 'world'] },
        () => {}
      );
      const message = parent.received[0];

      expect(typeof message.payload.id).toBe('number');
      expect(message.payload.method).toBe('eth_sign');
      expect(message.payload.params).toStrictEqual(['hello', 'world']);
      expect(message.payload.jsonrpc).toBe('2.0');
    });

    test('callback is executed', done => {
      let message: any;
      provider.sendAsync(
        { method: 'eth_sign', params: ['hello', 'world'] },
        (error, result) => {
          expect(result).toStrictEqual({
            jsonrpc: '2.0',
            id: message.payload.id,
            result: '0x0',
          });
          expect(error).toBeNull();
          done();
        }
      );
      message = parent.received[0];
      child.sendMessage({
        id: message.payload.id,
        result: '0x0',
        jsonrpc: '2.0',
      });
    });
  });
});
