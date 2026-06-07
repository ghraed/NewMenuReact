import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  GlassBoard,
  GlassCard,
  LiquidBackground,
  LiquidButton,
} from '../components/ui/liquid-glass';
import {
  fetchSuperAdminContactRequest,
  type SuperAdminContactRequestDetail,
} from '../services/superAdminContactRequestsService';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }

  return fallback;
};

const formatDate = (value?: string | null): string => {
  if (!value) return 'Unknown';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

const DetailRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div className="rounded-2xl border border-stroke bg-bg1/45 p-4">
    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</p>
    <p className="mt-2 text-sm text-text">{value?.trim() || 'Not provided'}</p>
  </div>
);

const SuperAdminContactRequestDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<SuperAdminContactRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      setPageError('Missing request id.');
      setLoading(false);
      return;
    }

    let active = true;

    const loadRequest = async () => {
      setLoading(true);
      setPageError(null);

      try {
        const data = await fetchSuperAdminContactRequest(requestId);
        if (!active) return;
        setRequest(data);
      } catch (error: unknown) {
        if (!active) return;
        setPageError(getErrorMessage(error, 'Failed to load visitor request details.'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadRequest();

    return () => {
      active = false;
    };
  }, [requestId]);

  return (
    <LiquidBackground>
      <div className="mx-auto min-h-screen max-w-6xl pb-8 pt-6">
        <GlassBoard className="mb-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gold2/85">Super Admin</p>
              <h1 className="mt-2 text-2xl font-semibold text-text">
                {request?.title || 'Visitor request details'}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                Open the saved lead, see the visitor information, and review the related conversation in one place.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LiquidButton tone="tertiary" onClick={() => navigate('/super-admin/contact-requests')}>
                Back to requests
              </LiquidButton>
            </div>
          </div>
        </GlassBoard>

        {pageError ? (
          <div className="mb-5 rounded-xl2 border border-spicy/40 bg-spicy/12 px-4 py-3 text-sm text-spicy">
            {pageError}
          </div>
        ) : null}

        {loading ? (
          <GlassCard className="p-5">
            <p className="text-sm text-muted">Loading request details...</p>
          </GlassCard>
        ) : request ? (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <GlassCard className="space-y-4 p-5">
              <h2 className="text-lg font-semibold text-text">Lead information</h2>
              <DetailRow label="Visitor" value={request.name} />
              <DetailRow label="Email" value={request.email} />
              <DetailRow label="Phone" value={request.phone} />
              <DetailRow label="Business type" value={request.business_type} />
              <DetailRow label="Preferred contact" value={request.preferred_contact_method} />
              <DetailRow label="Status" value={request.status} />
              <DetailRow label="Source page" value={request.source_page} />
              <DetailRow label="Created at" value={formatDate(request.created_at)} />
              <DetailRow label="Session UUID" value={request.session_uuid} />
            </GlassCard>

            <div className="space-y-6">
              <GlassCard className="p-5">
                <h2 className="text-lg font-semibold text-text">Saved request</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text">
                  {request.message?.trim() || request.conversation_summary?.trim() || 'No request summary saved.'}
                </p>
              </GlassCard>

              <GlassCard className="p-5">
                <h2 className="text-lg font-semibold text-text">Conversation</h2>
                {request.messages.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">No conversation messages were saved for this request.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {request.messages.map((message) => {
                      const isAssistant = message.role === 'assistant';

                      return (
                        <div
                          key={message.id}
                          className={`rounded-2xl border p-4 ${
                            isAssistant
                              ? 'border-gold/25 bg-gold/10'
                              : 'border-stroke bg-bg1/50'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted">
                              {isAssistant ? 'Assistant' : 'Visitor'}
                            </p>
                            <p className="text-xs text-muted">{formatDate(message.created_at)}</p>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text">
                            {message.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
            </div>
          </div>
        ) : (
          <GlassCard className="p-5">
            <p className="text-sm text-muted">This request could not be found.</p>
          </GlassCard>
        )}
      </div>
    </LiquidBackground>
  );
};

export default SuperAdminContactRequestDetailsPage;
