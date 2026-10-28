import type { PropsWithChildren } from 'react';
import { configureHost } from '../shared/ui/runtime';
import { host } from './host';
configureHost(host);
export default function App({ children }: PropsWithChildren) { return children; }
