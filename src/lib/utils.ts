import type { RssItem } from '../types';

/**
 * URL 정규화: scheme + host + pathname 기준으로 URL 비교
 * 쿼리 파라미터, 해시는 무시
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // scheme + host(lowercase) + pathname으로 정규화
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
  } catch {
    // URL 파싱 실패 시 원본 반환
    return url;
  }
}

/**
 * 링크 배열에서 중복을 제거하고 원문 링크를 우선순위로 배치
 * @param primaryLink 원문 링크 (우선순위)
 * @param secondaryLinks AI가 추출한 링크들
 * @returns 중복 제거된 링크 배열
 */
export function deduplicateLinks(
  primaryLink: string | undefined,
  secondaryLinks: string[]
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  // 원문 링크를 먼저 추가
  if (primaryLink) {
    const normalized = normalizeUrl(primaryLink);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(primaryLink);
    }
  }

  // 보조 링크 추가 (중복 제거)
  for (const link of secondaryLinks) {
    const normalized = normalizeUrl(link);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(link);
    }
  }

  return result;
}

/**
 * 파일명으로부터 이미지 여부 판단
 * @param filename 파일명
 * @returns 이미지 파일 여부
 */
export function isImageFile(filename: string | undefined): boolean {
  if (!filename) return false;

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const lowerName = filename.toLowerCase();

  return imageExtensions.some((ext) => lowerName.endsWith(ext));
}

/**
 * 파일명으로부터 MIME type 결정
 * @param filename 파일명
 * @returns MIME type
 */
function getMimeType(filename: string | undefined): string {
  if (!filename) return 'application/octet-stream';

  const lowerName = filename.toLowerCase();

  // 이미지
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lowerName.endsWith('.png')) {
    return 'image/png';
  }
  if (lowerName.endsWith('.gif')) {
    return 'image/gif';
  }
  if (lowerName.endsWith('.bmp')) {
    return 'image/bmp';
  }
  if (lowerName.endsWith('.webp')) {
    return 'image/webp';
  }

  // 문서
  if (lowerName.endsWith('.pdf')) {
    return 'application/pdf';
  }
  if (lowerName.endsWith('.hwp') || lowerName.endsWith('.hwpx')) {
    return 'application/x-hwp';
  }
  if (lowerName.endsWith('.doc')) {
    return 'application/msword';
  }
  if (lowerName.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  // 기타
  return 'application/octet-stream';
}

/**
 * Google Calendar Attachment 인터페이스
 */
export interface GoogleCalendarAttachment {
  fileUrl: string;
  mimeType: string;
  title: string;
}

/**
 * RssItem의 첨부파일을 Google Calendar attachment로 변환
 * @param item RSS item
 * @returns Google Calendar attachment 또는 undefined
 */
export function buildAttachmentFromFile(item: RssItem): GoogleCalendarAttachment | undefined {
  if (!item.attachment) {
    return undefined;
  }

  // url 또는 preview 중 하나가 있어야 함
  const fileUrl = item.attachment.url || item.attachment.preview;
  if (!fileUrl) {
    return undefined;
  }

  return {
    fileUrl,
    mimeType: getMimeType(item.attachment.filename),
    title: item.attachment.filename || 'attachment',
  };
}
