import {
  IFrameEthereumProvider,
  MinimalEventSourceInterface,
  MinimalEventTargetInterface,
} from '../src';

class FakeParentWindow implements MinimalEventTargetInterface {
  fakeWindow = new FakeWindow();

  received: { payload: any; targetOrigin: string }[] = [];

  postMessage(payload: any, targetOrigin: string) {
    this.received.push({ payload, targetOrigin });
  }
}

class FakeWindow implements MinimalEventSourceInterface {
  private listeners: any[] = [];

  addEventListener(eventType: string, listener: any) {
    if (eventType !== 'message') {
      throw new Error();
    }

    this.listeners.push(listener);
  }

  sendMessage(message: any) {
    this.listeners.forEach(listener => listener(message));
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

  describe('#enable', () => {
    test('sends a message to parent', async () => {
      provider.enable();

      expect(parent.received).toHaveLength(1);
      const message = parent.received[0];
      expect(message.targetOrigin).toEqual('*');
      expect(message.payload.jsonrpc).toEqual('2.0');
      expect(message.payload.method).toEqual('enable');
      expect(message.payload.params).toBeUndefined();
      expect(typeof message.payload.id).toBe('string');
    });
  });
});
