// Compatibility shim: older screens import { PostCard } from '@/components/PostCard'.
// The real implementation lives in PostCard/PostCardModern.tsx.
export { PostCardModern as PostCard } from './PostCard/PostCardModern';
export type { PostCardModernProps as PostCardProps } from './PostCard/PostCardModern';
