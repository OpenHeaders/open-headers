/**
 * Override CTA for the body tabs — the Response/Preview/Payload
 * equivalent of the Headers tab's rule-creation buttons. Same blue
 * `dt-btn-primary` tag as the Headers CTAs, but it lives in the body
 * viewer's bottom toolbar (or the Preview meta-bar) rather than a top
 * row, so it never carves height out of the body the user is inspecting.
 * `margin-left: auto` (via `dt-body-override-cta`) right-aligns it in
 * whichever flex bar hosts it. Clicking opens the create-rule editor
 * pre-filled from the captured payload.
 */

interface OverrideBodyButtonProps {
  label: string;
  title: string;
  onClick: () => void;
}

export default function OverrideBodyButton({ label, title, onClick }: OverrideBodyButtonProps) {
  return (
    <button type="button" className="dt-btn dt-btn-primary dt-body-override-cta" onClick={onClick} title={title}>
      {label}
    </button>
  );
}
