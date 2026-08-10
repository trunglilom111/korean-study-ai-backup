export type MediaSource =
  | { type: "youtube"; videoId: string; embedUrl: string; watchUrl: string }
  | { type: "vimeo"; videoId: string; embedUrl: string; watchUrl: string }
  | { type: "direct"; url: string }
  | { type: "unknown"; url: string };

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
  /youtube\.com\/embed\/([\w-]{11})/,
  /youtube\.com\/shorts\/([\w-]{11})/,
];

const VIMEO_PATTERN = /vimeo\.com\/(?:video\/)?(\d+)/;

const DIRECT_MEDIA_PATTERN =
  /\.(mp4|webm|ogg|mp3|wav|m4a)(\?|$)/i;

export function parseMediaUrl(rawUrl: string): MediaSource | null {
  const url = rawUrl.trim();

  if (!url) {
    return null;
  }

  try {
    new URL(url);
  } catch {
    return null;
  }

  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);

    if (match?.[1]) {
      const videoId = match[1];

      return {
        type: "youtube",
        videoId,
        embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };
    }
  }

  const vimeoMatch = url.match(VIMEO_PATTERN);

  if (vimeoMatch?.[1]) {
    const videoId = vimeoMatch[1];

    return {
      type: "vimeo",
      videoId,
      embedUrl: `https://player.vimeo.com/video/${videoId}`,
      watchUrl: `https://vimeo.com/${videoId}`,
    };
  }

  if (DIRECT_MEDIA_PATTERN.test(url)) {
    return { type: "direct", url };
  }

  return { type: "unknown", url };
}

export type OEmbedInfo = {
  title: string;
  author: string;
  thumbnailUrl: string;
};

export async function fetchOEmbedInfo(
  watchUrl: string
): Promise<OEmbedInfo | null> {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const response = await fetch(endpoint, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };

    return {
      title: data.title || "",
      author: data.author_name || "",
      thumbnailUrl: data.thumbnail_url || "",
    };
  } catch {
    return null;
  }
}
