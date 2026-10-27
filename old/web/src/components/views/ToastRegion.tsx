import type { Vals } from '@/lib/useDashboard';

/** Ported from Main.dc.html by tools/dc2jsx.py, then edited by hand. */
export const ToastRegion = ({ v }: { v: Vals }) => (
  <>
    <div aria-live="polite" role="status">
      {' '}
      {v.toast ? (
        <>
          {' '}
          <div className="toast">
            <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5"></circle>
              <path d="M12 11v5M12 8h.01"></path>
            </svg>
            {v.toast}
          </div>{' '}
        </>
      ) : null}{' '}
    </div>
  </>
);
