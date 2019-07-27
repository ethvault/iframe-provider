# ethvault/iframe-provider

[![Build Status](https://travis-ci.org/ethvault/iframe-provider.svg?branch=master)](https://travis-ci.org/ethvault/iframe-provider)
[![MinZipped size](https://badgen.net/bundlephobia/minzip/@ethvault/iframe-provider)](https://bundlephobia.com/result?p=@ethvault/iframe-provider@0.1.6)
![NPM Version](https://img.shields.io/npm/v/@ethvault/iframe-provider.svg)

This is an [EIP-1193](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1193.md) compliant Ethereum provider that
communicates with a parent iframe using the [Ethereum JSON RPC](https://github.com/ethereum/wiki/wiki/JSON-RPC).

## Purpose

Use the iframe provider to enable a dApp to communicate with an Ethereum provider in a different context.

This was built to serve the dApps that integrate with [Ethvault](https://ethvault.xyz).

## Compatibility

While the protocol is designed for the [Ethvault dApp browser](https://ethvault.xyz), it is meant to be general
and work for any iframe based dApp browser.

Contributions are welcome.

## Usage

If you want an easy drop-in solution, consider [the polyfill package](https://github.com/ethvault/iframe-provider-polyfill)
which sets `window.web3` and `window.ethereum` to an iframe provider when the dApp is embedded in an iframe.

Use this package if you want to give the user the option to connect to the iframe provider or another provider.

You can use this provider exactly how you use the MetaMask and other injected Ethereum/web3 providers. It supports
both the legacy `sendAsync` method as well as the newer `send` method. It also has an `enable` method for compatibility with MetaMask which sends a JSON RPC with method `enable` and expects the parent to return a list of accounts in the result.

```typescript
import { IFrameEthereumProvider } from '@ethvault/iframe-provider';

let ethereum;

function isIframe(): boolean {
  /// Do some logic...
  return true;
}

if (isIframe()) {
  ethereum = new IFrameEthereumProvider();
} else {
  // Use some other provider, e.g. window.ethereum from MetaMask or Infura
  // ...
}

// Anything from https://github.com/ethereum/wiki/wiki/JSON-RPC should be supported
function getNetwork(): Promise<string> {
  return ethereum.send('net_version');
}
```

You can also use this with the [ethers.js](https://github.com/ethers-io/ethers.js) library
via the [Web3Provider](https://docs.ethers.io/ethers.js/html/api-providers.html#web3provider-inherits-from-jsonrpcprovider).

```typescript
import { IFrameEthereumProvider } from '@ethvault/iframe-provider';
import { Web3Provider } from 'ethers';

let web3Provider = new Web3Provider(new IFrameEthereumProvider());
```

There are some options for the construction of the ethereum provider:

```typescript
import { IFrameEthereumProvider } from '@ethvault/iframe-provider';

new IFrameEthereumProvider({
  // How long to wait for the response, default 1 minute
  timeoutMilliseconds: 60000,
  // The origins with which this provider is allowed to communicate, default '*'
  // See postMessage docs https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
  targetOrigin: 'https://ethvault.xyz',
});
```

## Local Development

This project was bootstrapped with [TSDX](https://github.com/jaredpalmer/tsdx).

Below is a list of commands you will probably find useful.

### `npm start` or `yarn start`

Runs the project in development/watch mode. Your project will be rebuilt upon changes. TSDX has a special logger for you convenience. Error messages are pretty printed and formatted for compatibility VS Code's Problems tab.

<img src="https://user-images.githubusercontent.com/4060187/52168303-574d3a00-26f6-11e9-9f3b-71dbec9ebfcb.gif" width="600" />

Your library will be rebuilt if you make edits.

### `npm run build` or `yarn build`

Bundles the package to the `dist` folder.
The package is optimized and bundled with Rollup into multiple formats (CommonJS, UMD, and ES Module).

<img src="https://user-images.githubusercontent.com/4060187/52168322-a98e5b00-26f6-11e9-8cf6-222d716b75ef.gif" width="600" />

### `npm test` or `yarn test`

Runs the test watcher (Jest) in an interactive mode.
By default, runs tests related to files changed since the last commit.
