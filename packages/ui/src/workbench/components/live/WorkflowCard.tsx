/**
 * WorkflowCard — one section of the workflow view's panel (the workflows
 * redesign, Step panel): a title with a line under it that says what the
 * section is, what the section offers at the head's right, its content,
 * and a note at its foot. Always open.
 *
 * The frame's rules are the workbench's editor stylesheet's
 * (`.oh-wf-card`); a section lays its own content out with the classes
 * that stylesheet gives a card's body, its rows and its column heads.
 */

import type React from 'react';

interface Props {
  title: string;
  /** One line under the title. */
  description?: React.ReactNode;
  /** At the head's right: a state's word, a switch, the section's action. */
  extra?: React.ReactNode;
  /** A note at the card's foot. */
  footer?: React.ReactNode;
  testId?: string;
  /** Canonical schema path of the field the card edits — read by field-focus awareness. */
  fieldPath?: string;
  /** The card's own element, for a panel that brings the card into view. */
  ref?: React.Ref<HTMLElement>;
  children?: React.ReactNode;
}

const WorkflowCard: React.FC<Props> = ({ title, description, extra, footer, testId, fieldPath, ref, children }) => (
  <section ref={ref} className="oh-wf-card" data-testid={testId} data-field-path={fieldPath}>
    <div className="oh-wf-card-head">
      <div className="oh-wf-card-heading">
        <h3 className="oh-wf-card-title">{title}</h3>
        {description !== undefined && <p className="oh-wf-card-description">{description}</p>}
      </div>
      {extra}
    </div>
    {children}
    {footer !== undefined && <div className="oh-wf-card-foot">{footer}</div>}
  </section>
);

/** A field of a card's body: its label over its control. `wide` takes the whole line of a body laid out in columns. */
export const CardField: React.FC<{ label: string; wide?: boolean; children: React.ReactNode }> = ({
  label,
  wide = false,
  children,
}) => (
  <div className={wide ? 'oh-wf-field oh-wf-field--wide' : 'oh-wf-field'}>
    <span className="oh-wf-label">{label}</span>
    {children}
  </div>
);

export default WorkflowCard;
