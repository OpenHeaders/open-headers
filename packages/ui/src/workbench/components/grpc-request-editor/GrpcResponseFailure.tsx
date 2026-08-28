/**
 * GrpcResponseFailure — the unary call's local failure body: the
 * friendly error state and, when the failure carries the trust hint,
 * the Trust certificate button under it that reveals the offer card
 * (the session timelines' error-row gesture — the card never shows
 * unasked).
 */

import { CloseOutlined } from '@ant-design/icons';
import type { TrustCertificateErrorHint } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button } from 'antd';
import type React from 'react';
import { useState } from 'react';
import TrustCertificateOffer from '../request-editor/response/TrustCertificateOffer';
import GrpcResponseErrorState from './GrpcResponseErrorState';

interface GrpcResponseFailureProps {
  detail: string;
  hint?: TrustCertificateErrorHint;
  onReinvoke?: () => void;
}

const GrpcResponseFailure: React.FC<GrpcResponseFailureProps> = ({ detail, hint, onReinvoke }) => {
  const t = useT();
  const [offerOpen, setOfferOpen] = useState(false);
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <GrpcResponseErrorState status={null} detail={detail} />
      {hint !== undefined && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
          <Button
            size="small"
            aria-pressed={offerOpen}
            onClick={() => setOfferOpen((open) => !open)}
            data-testid="grpc-response-trust-certificate"
          >
            {t('workbench.editors.grpc.timeline.trustCertificate')}
          </Button>
          {offerOpen && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 4 }}>
              <TrustCertificateOffer hint={hint} {...(onReinvoke !== undefined ? { onResend: onReinvoke } : {})} />
              <Button
                size="small"
                type="text"
                icon={<CloseOutlined style={{ fontSize: 11 }} />}
                onClick={() => setOfferOpen(false)}
                aria-label={t('shared.action.close')}
                data-testid="grpc-response-trust-offer-close"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GrpcResponseFailure;
