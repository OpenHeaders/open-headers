/**
 * The one frame every screen drawn INSTEAD of the Workbench shares —
 * the login gate, the consent card, the awaiting-access screen: a
 * narrow card under the product mark, the way an identity page opens
 * with the brand it belongs to so the person knows whose server they
 * are signing in to before they read a word.
 */

import { hostAssets } from '@openheaders/core/assets';

const CARD_STYLE: React.CSSProperties = {
  maxWidth: 400,
  margin: '14vh auto 0',
  padding: '32px 36px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const MARK_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  marginBottom: 8,
};

const WORDMARK_STYLE: React.CSSProperties = {
  fontFamily: "'Press Start 2P', monospace",
  fontSize: 14,
  lineHeight: 1,
};

export interface GateCardProps {
  testId: string;
  /** The card's `data-state`, for the screens whose state a spec reads off the frame. */
  state?: string;
  children: React.ReactNode;
}

export function GateCard({ testId, state, children }: GateCardProps): React.JSX.Element {
  return (
    <div style={CARD_STYLE} data-testid={testId} data-state={state}>
      <div style={MARK_STYLE}>
        <img src={hostAssets.resolveUrl('images/logo-pixel.svg')} alt="" width={28} height={28} />
        <span style={WORDMARK_STYLE}>Open Headers</span>
      </div>
      {children}
    </div>
  );
}
