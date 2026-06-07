import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GlassBoard,
  GlassCard,
  GlassInput,
  LiquidBackground,
  LiquidButton,
} from '../components/ui/liquid-glass';
import {
  fetchSuperAdminContactRequests,
  type SuperAdminContactRequestSummary,
} from '../services/superAdminContactRequestsService';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }

  return fallback;
};

const formatDate = (value?: string | null): string => {
  if (!value) return 'Unknown date';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

const buildVisitorLabel = (request: SuperAdminContactRequestSummary): string => {
  return request.name?.trim()
    || request.email?.trim()
    || request.phone?.trim()
    || 'Unknown visitor';
};

const SuperAdminContactRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SuperAdminContactRequestSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadRequests = async () => {
      setLoading(true);
      setPageError(null);

      try {
        const data = await fetchSuperAdminContactRequests();
        if (!active) return;
        setRequests(data);
      } catch (error: unknown) {
        if (!active) return;
        setPageError(getErrorMessage(error, 'Failed to load visitor requests.'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadRequests();

    return () => {
      active = false;
    };
  }, []);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;

    return requests.filter((request) => (
      request.title.toLowerCase().includes(query)
      || (request.name ?? '').toLowerCase().includes(query)
      || (request.email ?? '').toLowerCase().includes(query)
      || (request.phone ?? '').toLowerCase().includes(query)
      || (request.business_type ?? '').toLowerCase().includes(query)
    ));
  }, [requests, search]);

  return (
    <LiquidBackground>
      <div className="mx-auto min-h-screen max-w-6xl pb-8 pt-6">
        <GlassBoard className="mb-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gold2/85">Super Admin</p>
              <h1 className="mt-2 text-2xl font-semibold text-text">Visitor requests</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                Review chatbot contact requests, see what each visitor asked for, and open the full details when you need context.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LiquidButton tone="tertiary" onClick={() => navigate('/super-admin/dashboard')}>
                Back to dashboard
              </LiquidButton>
            </div>
          </div>
        </GlassBoard>

        <GlassCard className="mb-6 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text">Saved requests</h2>
              <p className="mt-1 text-sm text-muted">
                Each item shows the request title and who submitted it.
              </p>
            </div>
            <div className="w-full max-w-sm">
              <GlassInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, name, email, or phone..."
              />
            </div>
          </div>
        </GlassCard>

        {pageError ? (
          <div className="mb-5 rounded-xl2 border border-spicy/40 bg-spicy/12 px-4 py-3 text-sm text-spicy">
            {pageError}
          </div>
        ) : null}

        <div className="grid gap-4">
          {loading ? (
            <GlassCard className="p-5">
              <p className="text-sm text-muted">Loading visitor requests...</p>
            </GlassCard>
          ) : filteredRequests.length === 0 ? (
            <GlassCard className="p-5">
              <p className="text-sm text-muted">No visitor requests found yet.</p>
            </GlassCard>
          ) : (
            filteredRequests.map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => navigate(`/super-admin/contact-requests/${request.id}`)}
                className="text-left"
              >
                <GlassCard className="p-5 transition hover:-translate-y-0.5 hover:border-gold/35">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold text-text">{request.title}</p>
                      <p className="mt-1 text-sm text-muted">{buildVisitorLabel(request)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      <span className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-gold2">
                        {request.status?.replace(/_/g, ' ') || 'new'}
                      </span>
                      <p className="text-xs text-muted">{formatDate(request.created_at)}</p>
                    </div>
                  </div>
                </GlassCard>
              </button>
            ))
          )}
        </div>
      </div>
    </LiquidBackground>
  );
};

export default SuperAdminContactRequestsPage;
