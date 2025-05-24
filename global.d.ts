// Global type declarations for Sports Celebrity Reels
// This file provides fallback type definitions when dependencies are not fully installed

declare module 'react' {
  export type ReactNode = any;
  export type ReactElement = any;
  export type ComponentType<P = {}> = (props: P) => ReactElement | null;
  export type RefObject<T> = { readonly current: T | null };
  export type MutableRefObject<T> = { current: T };
  export type Ref<T> = ((instance: T | null) => void) | RefObject<T> | null;

  export interface MouseEvent<T = Element> {
    stopPropagation(): void;
    preventDefault(): void;
    target: T;
  }

  export interface SyntheticEvent<T = Element, E = Event> {
    nativeEvent: E;
    target: T;
  }

  export interface FormEvent<T = Element> extends SyntheticEvent<T> {}

  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prev: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useRef<T>(initialValue: T): MutableRefObject<T>;
  export function useRef<T>(initialValue: T | null): RefObject<T>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  export function useImperativeHandle<T, R extends T>(ref: Ref<T> | undefined, init: () => R, deps?: any[]): void;
  export function forwardRef<T, P = {}>(render: (props: P, ref: Ref<T>) => ReactElement | null): ComponentType<P & { ref?: Ref<T> }>;
  export function lazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>): T;
  export function memo<P = {}>(component: ComponentType<P>): ComponentType<P>;

  export const Fragment: ComponentType<{ children?: ReactNode }>;
  export const Suspense: ComponentType<{ children?: ReactNode; fallback?: ReactNode }>;

  const React: {
    useState: typeof useState;
    useEffect: typeof useEffect;
    useRef: typeof useRef;
    useCallback: typeof useCallback;
    useImperativeHandle: typeof useImperativeHandle;
    forwardRef: typeof forwardRef;
    lazy: typeof lazy;
    memo: typeof memo;
    Fragment: typeof Fragment;
    Suspense: typeof Suspense;
  };

  export default React;
}

declare module 'framer-motion' {
  export interface MotionProps {
    className?: string;
    children?: React.ReactNode;
    initial?: any;
    animate?: any;
    exit?: any;
    transition?: any;
    whileHover?: any;
    whileTap?: any;
    onClick?: () => void;
  }

  export const motion: {
    div: React.ComponentType<MotionProps>;
    button: React.ComponentType<MotionProps>;
  };

  export const AnimatePresence: React.ComponentType<{
    children?: React.ReactNode;
    mode?: string;
  }>;
}

declare module 'lucide-react' {
  export interface IconProps {
    className?: string;
    size?: number | string;
  }

  export const Heart: React.ComponentType<IconProps>;
  export const Share: React.ComponentType<IconProps>;
  export const MessageCircle: React.ComponentType<IconProps>;
  export const MoreHorizontal: React.ComponentType<IconProps>;
  export const Play: React.ComponentType<IconProps>;
  export const Pause: React.ComponentType<IconProps>;
  export const X: React.ComponentType<IconProps>;
  export const Copy: React.ComponentType<IconProps>;
  export const Facebook: React.ComponentType<IconProps>;
  export const Twitter: React.ComponentType<IconProps>;
  export const Instagram: React.ComponentType<IconProps>;
  export const Mail: React.ComponentType<IconProps>;
  export const Download: React.ComponentType<IconProps>;
  export const ExternalLink: React.ComponentType<IconProps>;
  export const Verified: React.ComponentType<IconProps>;
  export const MapPin: React.ComponentType<IconProps>;
  export const Search: React.ComponentType<IconProps>;
  export const Menu: React.ComponentType<IconProps>;
  export const Plus: React.ComponentType<IconProps>;
  export const User: React.ComponentType<IconProps>;
  export const Settings: React.ComponentType<IconProps>;
  export const CheckCircle: React.ComponentType<IconProps>;
  export const AlertCircle: React.ComponentType<IconProps>;
  export const Info: React.ComponentType<IconProps>;
  export const AlertTriangle: React.ComponentType<IconProps>;
}

declare module 'react-intersection-observer' {
  export interface UseInViewOptions {
    threshold?: number;
    rootMargin?: string;
  }

  export interface UseInViewReturn {
    ref: React.RefObject<any>;
    inView: boolean;
  }

  export function useInView(options?: UseInViewOptions): UseInViewReturn;
}

declare module 'swr' {
  export interface SWRResponse<T> {
    data?: T;
    error?: any;
    isLoading: boolean;
    mutate: () => void;
  }

  export interface SWRConfiguration {
    revalidateOnFocus?: boolean;
    revalidateOnReconnect?: boolean;
    dedupingInterval?: number;
  }

  export default function useSWR<T>(
    key: string | null,
    fetcher: (url: string) => Promise<T>,
    config?: SWRConfiguration
  ): SWRResponse<T>;
}

declare module 'next/image' {
  export interface ImageProps {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    priority?: boolean;
    fill?: boolean;
    sizes?: string;
  }

  const Image: React.ComponentType<ImageProps>;
  export default Image;
}

// Global type augmentations
declare global {
  interface Window {
    location: {
      origin: string;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export {};
