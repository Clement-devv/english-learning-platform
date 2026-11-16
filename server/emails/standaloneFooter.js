import { AsyncLocalStorage } from 'node:async_hooks';

const sender = new AsyncLocalStorage();

export const withStandaloneFooter = callback => sender.run('E.G.O', callback);
export const footerSender = fallback => sender.getStore() || fallback;
