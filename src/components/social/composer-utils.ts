export function requiresMedia(platform: 'linkedin' | 'facebook' | 'instagram'): boolean {
  return platform === 'instagram'
}

export function getComposerValidationError(
  platform: 'linkedin' | 'facebook' | 'instagram',
  content: string,
  mediaUploadedUrl?: string
): string | null {
  if (!content.trim()) return 'Write a caption before adding this post to the queue.'
  if (requiresMedia(platform) && !mediaUploadedUrl) {
    return 'Instagram posts require an uploaded image or video.'
  }
  return null
}
