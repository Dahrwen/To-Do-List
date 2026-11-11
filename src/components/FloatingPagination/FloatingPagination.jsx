/**
 * ============================================================================
 * FILE: src/components/FloatingPagination/FloatingPagination.jsx
 * ============================================================================
 * PURPOSE:
 *   Dedicated floating pagination slider pill (`[ < • • • > ]`) pinned at the
 *   bottom-center of the viewport so slide navigation is always visible and
 *   never clipped in either default (2-row) or expanded (3-row) views.
 *
 * CORE RESPONSIBILITIES:
 *   1. Floating Pill Container:
 *      Renders a bordered, shadowed pill card (`position: fixed; bottom: ...;
 *      left: 50%; transform: translateX(-50%);`) matching the application's
 *      3px solid black border and drop-shadow design tokens.
 *   2. Single-Page Disabled Invariant:
 *      When `totalPages <= 1` (≤10 cards in default view, ≤15 in expanded view),
 *      renders a single dot and disables both `<` and `>` arrows (`disabled`,
 *      gray, `cursor-not-allowed`, `pointer-events-none`).
 *   3. Multi-Page Slide Navigation:
 *      When `totalPages > 1`, dynamically renders one circle dot per page chunk
 *      and enables `<` / `>` and direct dot click navigation.
 *
 * IMPORTS FROM:
 *   - 'react': Core React library
 *   - './FloatingPagination.css': Scoped component styles
 *
 * EXPORTS TO:
 *   - `src/components/FloatingPagination/index.js`
 *   - `src/components/TaskList/TaskList.jsx` / `src/App.jsx`: Default export `FloatingPagination`
 * ============================================================================
 */

import React from 'react';
import './FloatingPagination.css';

/**
 * FloatingPagination Component
 *
 * @param {Object} props
 * @param {number} props.currentPage - Zero-based active page index
 * @param {number} props.totalPages - Total number of pages (minimum 1)
 * @param {Function} props.onPageChange - Callback `(newPageIndex) => void`
 * @param {boolean} [props.isHidden=false] - Hides the floating slider when Calendar view is active
 */
export default function FloatingPagination({
  currentPage = 0,
  totalPages = 1,
  onPageChange,
  isHidden = false,
}) {
  if (isHidden) {
    return null;
  }

  const isSinglePage = totalPages <= 1;
  const isPrevDisabled = isSinglePage || currentPage <= 0;
  const isNextDisabled = isSinglePage || currentPage >= totalPages - 1;

  const handlePrevPage = () => {
    if (!isPrevDisabled && onPageChange) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (!isNextDisabled && onPageChange) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <nav
      className="floating-pagination-pill"
      aria-label="Task pagination"
    >
      <button
        type="button"
        className={`pagination-arrow ${isPrevDisabled ? 'disabled' : ''}`}
        onClick={handlePrevPage}
        disabled={isPrevDisabled}
        aria-label="Previous page"
      >
        &lt;
      </button>

      <div className="pagination-dots">
        {Array.from({ length: Math.max(1, totalPages) }).map((_, idx) => (
          <button
            key={idx}
            type="button"
            className={`pagination-dot ${
              idx === currentPage ? 'active' : ''
            } ${isSinglePage ? 'single-dot' : ''}`}
            onClick={() => {
              if (!isSinglePage && onPageChange) {
                onPageChange(idx);
              }
            }}
            disabled={isSinglePage}
            aria-label={`Page ${idx + 1}`}
          />
        ))}
      </div>

      <button
        type="button"
        className={`pagination-arrow ${isNextDisabled ? 'disabled' : ''}`}
        onClick={handleNextPage}
        disabled={isNextDisabled}
        aria-label="Next page"
      >
        &gt;
      </button>
    </nav>
  );
}
