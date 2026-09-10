/**
 * The gallery tab's side of the public list.
 *
 * Holds one page at a time plus whatever earlier pages have been asked for,
 * because the gallery is paged by KV's own cursor and there is no way to jump
 * to a page or count the total. "Load more" is the only navigation there can
 * be, so it is the only one offered.
 */
import { useCallback, useState } from "react";
import {
  deleteGalleryPost,
  listGallery,
  reportGalleryPost,
  type GalleryCard,
  type GalleryError,
} from "../lib/gallery";

export interface UseGalleryReturn {
  posts: GalleryCard[];
  isLoading: boolean;
  /** True while a further page is on its way. */
  isLoadingMore: boolean;
  error: GalleryError | null;
  /** False once the last page has been read. */
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  report: (id: string) => Promise<GalleryError | null>;
  remove: (id: string) => Promise<GalleryError | null>;
}

export function useGallery(): UseGalleryReturn {
  const [posts, setPosts] = useState<GalleryCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<GalleryError | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const result = await listGallery();
    if (result.ok) {
      setPosts(result.value.posts);
      setCursor(result.value.cursor);
      setError(null);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  }, []);

  // There is deliberately no effect that loads on mount. The gallery is
  // fetched because someone opened it -- most sessions never do, and a list
  // fetched at render time would also be stale by the time it was looked at.
  // The caller calls `refresh` from the same handler that opens the dialog.

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setIsLoadingMore(true);
    const result = await listGallery(cursor);
    if (result.ok) {
      // Appended rather than replaced: paging forward should not lose what the
      // reader has already scrolled past.
      setPosts((current) => [...current, ...result.value.posts]);
      setCursor(result.value.cursor);
      setError(null);
    } else {
      setError(result.error);
    }
    setIsLoadingMore(false);
  }, [cursor]);

  const report = useCallback(async (id: string) => {
    const result = await reportGalleryPost(id);
    return result.ok ? null : result.error;
  }, []);

  const remove = useCallback(async (id: string) => {
    const result = await deleteGalleryPost(id);
    if (!result.ok) return result.error;
    // Taken out here rather than by refetching: a delete is certain, and a
    // refetch would cost a round trip to learn what we already know.
    setPosts((current) => current.filter((post) => post.id !== id));
    return null;
  }, []);

  return {
    posts,
    isLoading,
    isLoadingMore,
    error,
    hasMore: cursor !== null,
    refresh,
    loadMore,
    report,
    remove,
  };
}
