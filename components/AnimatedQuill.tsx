'use client'

/**
 * Floating animated quill that drifts gently on the page.
 * Place in layouts/pages where a decorative quill accent is desired.
 * Uses the favicon quill image with a subtle float + rotate animation.
 */
export default function AnimatedQuill({
  className = '',
  size = 32,
  style,
}: {
  className?: string
  size?: number
  style?: React.CSSProperties
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="https://nestandquill.b-cdn.net/Nest%20and%20Quill%20favicon.webp"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`pointer-events-none select-none animate-quill-float ${className}`}
      style={{ objectFit: 'contain', ...style }}
    />
  )
}
