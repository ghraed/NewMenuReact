"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  CircleDot,
  Clock3,
  Mail,
  MessageSquareMore,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Waypoints,
  X,
} from 'lucide-react';
import api from '../services/api';

type ChatRole = 'assistant' | 'user';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

interface StoredRozerChatState {
  backendUnavailable: boolean;
  leadFingerprint: string | null;
  messages: ChatMessage[];
  sessionUuid: string | null;
}

interface ApiEnvelope<T> {
  data: T;
  message?: string;
  success: boolean;
}

interface CreateSessionResponse {
  message: {
    content: string;
    role: 'assistant';
  };
  session_uuid: string;
}

interface SendMessageResponse {
  lead_detected: boolean;
  message: {
    content: string;
    role: 'assistant';
  };
  session_uuid: string;
}

interface GetSessionResponse {
  messages: Array<{
    content: string;
    role: ChatRole | 'system';
  }>;
  session: {
    uuid: string;
  };
}

interface DetectedLeadInput {
  businessType?: string;
  email?: string;
  name?: string;
  phone?: string;
  preferredContactMethod?: string;
}

interface BadgeProps {
  children: React.ReactNode;
  tone?: 'default' | 'accent';
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface BehaviorItemProps {
  children: React.ReactNode;
}

interface MiniInfoProps {
  icon: React.ReactNode;
  label: string;
}

interface CollapsibleSectionProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  eyebrow: string;
  title: string;
}

const INITIAL_MESSAGE = "Hi, I'm Rozer, your AI contact assistant. I'm a bot, but I'm here to help you quickly. Are you looking for support, pricing, a demo, or general contact information?";
const ROZER_CHAT_STORAGE_KEY = 'rozer-contact-chat';

const makeMessageId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `rozer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const defaultMessages = (): ChatMessage[] => [
  {
    id: makeMessageId(),
    role: 'assistant',
    content: INITIAL_MESSAGE,
  },
];

const sanitizeMessages = (messages: unknown): ChatMessage[] => {
  if (!Array.isArray(messages)) {
    return defaultMessages();
  }

  const normalized = messages
    .map((message) => {
      if (!message || typeof message !== 'object') {
        return null;
      }

      const candidate = message as { content?: unknown; id?: unknown; role?: unknown };
      const role = candidate.role === 'user' ? 'user' : candidate.role === 'assistant' ? 'assistant' : null;
      const content = typeof candidate.content === 'string' ? candidate.content.trim() : '';

      if (!role || content === '') {
        return null;
      }

      return {
        id: typeof candidate.id === 'string' && candidate.id.trim() !== '' ? candidate.id : makeMessageId(),
        role,
        content,
      } satisfies ChatMessage;
    })
    .filter((message): message is ChatMessage => message !== null);

  return normalized.length > 0 ? normalized : defaultMessages();
};

const loadStoredState = (): StoredRozerChatState => {
  if (typeof window === 'undefined') {
    return {
      backendUnavailable: false,
      leadFingerprint: null,
      messages: defaultMessages(),
      sessionUuid: null,
    };
  }

  try {
    const raw = window.localStorage.getItem(ROZER_CHAT_STORAGE_KEY);
    if (!raw) {
      return {
        backendUnavailable: false,
        leadFingerprint: null,
        messages: defaultMessages(),
        sessionUuid: null,
      };
    }

    const parsed = JSON.parse(raw) as Partial<StoredRozerChatState>;

    return {
      backendUnavailable: parsed.backendUnavailable === true,
      leadFingerprint: typeof parsed.leadFingerprint === 'string' ? parsed.leadFingerprint : null,
      messages: sanitizeMessages(parsed.messages),
      sessionUuid: typeof parsed.sessionUuid === 'string' && parsed.sessionUuid.trim() !== '' ? parsed.sessionUuid : null,
    };
  } catch {
    return {
      backendUnavailable: false,
      leadFingerprint: null,
      messages: defaultMessages(),
      sessionUuid: null,
    };
  }
};

const buildLeadFingerprint = (lead: DetectedLeadInput): string | null => {
  const email = lead.email?.trim().toLowerCase() ?? '';
  const phone = lead.phone?.trim() ?? '';
  const fingerprint = `${email}::${phone}`.trim();

  return fingerprint === '::' ? null : fingerprint;
};

const detectLeadInput = (message: string): DetectedLeadInput | null => {
  const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = message.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  const nameMatch = message.match(/\b(?:my name is|i am|i'm)\s+([a-z][a-z\s'-]{1,60})/i);
  const businessTypeMatch = message.match(/\b(?:we are|i have|it is|our)\s+(?:a|an)?\s*([a-z][a-z\s-]{2,50}(?:restaurant|cafe|coffee shop|bakery|bar|food truck|hotel|bistro|pizzeria))/i);

  const preferredContactMethod = (() => {
    const normalized = message.toLowerCase();

    if (normalized.includes('whatsapp')) return 'whatsapp';
    if (normalized.includes('email')) return 'email';
    if (normalized.includes('phone') || normalized.includes('call')) return 'phone';
    return undefined;
  })();

  const lead: DetectedLeadInput = {};

  if (emailMatch) {
    lead.email = emailMatch[0].toLowerCase();
  }

  if (phoneMatch) {
    const sanitizedPhone = phoneMatch[0].replace(/[^\d+]/g, '');
    const digits = sanitizedPhone.replace(/\D/g, '');

    if (digits.length >= 8) {
      lead.phone = sanitizedPhone;
    }
  }

  if (nameMatch) {
    lead.name = nameMatch[1]
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  if (businessTypeMatch) {
    lead.businessType = businessTypeMatch[1]
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  if (preferredContactMethod) {
    lead.preferredContactMethod = preferredContactMethod;
  }

  return Object.keys(lead).length > 0 ? lead : null;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (
    error
    && typeof error === 'object'
    && 'response' in error
  ) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string' && response.data.message.trim() !== '') {
      return response.data.message.trim();
    }
  }

  if (error instanceof Error && error.message.trim() !== '') {
    return error.message.trim();
  }

  return fallback;
};

const isMissingAiRouteError = (error: unknown): boolean => {
  if (
    error
    && typeof error === 'object'
    && 'response' in error
  ) {
    const response = (error as { response?: { data?: { message?: unknown }, status?: number } }).response;
    const message = typeof response?.data?.message === 'string' ? response.data.message.toLowerCase() : '';
    return response?.status === 404 || message.includes('could not be found');
  }

  return false;
};

const buildFallbackReply = (message: string): string => {
  const normalized = message.toLowerCase();

  if (normalized.includes('demo')) {
    return 'I can help with a demo request. Please share your phone number or email, and the Rozer team will contact you to arrange a demo.';
  }

  if (normalized.includes('price') || normalized.includes('pricing') || normalized.includes('cost')) {
    return 'Pricing is handled by the Rozer team and depends on your restaurant size, features, and setup needs. Please leave your phone number or email and the team will contact you.';
  }

  if (normalized.includes('support') || normalized.includes('help') || normalized.includes('problem') || normalized.includes('issue')) {
    return 'I can help route your support request. Please briefly describe the issue and leave your phone number or email so the Rozer team can follow up quickly.';
  }

  if (normalized.includes('deepseek') || normalized.includes('ai') || normalized.includes('tech') || normalized.includes('stack') || normalized.includes('hack') || normalized.includes('security')) {
    return 'That request should be forwarded to the Rozer team directly. Please contact raed.ghanim.2014@gmail.com or leave your phone number or email for a secure follow-up.';
  }

  return 'I can help you contact the Rozer team for support, pricing, demos, and general questions. Please leave your phone number or email and the team will contact you. Support is available 24/7.';
};

const Badge: React.FC<BadgeProps> = ({ children, tone = 'default' }) => (
  <span
    className={[
      'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase',
      tone === 'accent'
        ? 'border-[color:var(--guest-accent)] bg-[var(--guest-accent-soft)] text-[var(--guest-text)]'
        : 'border-[color:var(--guest-border)] bg-[color:color-mix(in_srgb,var(--guest-panel)_84%,transparent)] text-[var(--guest-muted)]',
    ].join(' ')}
  >
    {children}
  </span>
);

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => (
  <motion.article
    initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
    whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    viewport={{ once: true, margin: '-40px' }}
    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    className="rounded-[28px] border border-[color:var(--guest-border)] bg-[var(--guest-panel)] px-5 py-5 shadow-[var(--guest-shadow-soft)]"
  >
    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--guest-accent-soft)] text-[var(--guest-text)]">
      {icon}
    </div>
    <h3 className="text-lg font-semibold tracking-[-0.02em] text-[var(--guest-text)]">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-[var(--guest-muted)]">{description}</p>
  </motion.article>
);

const BehaviorItem: React.FC<BehaviorItemProps> = ({ children }) => (
  <li className="flex items-start gap-3 text-sm leading-6 text-[var(--guest-muted)]">
    <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--guest-accent-soft)] text-[var(--guest-text)]">
      <CircleDot className="h-3.5 w-3.5" />
    </span>
    <span>{children}</span>
  </li>
);

const MiniInfo: React.FC<MiniInfoProps> = ({ icon, label }) => (
  <div className="rounded-2xl border border-[color:var(--guest-border)] bg-[var(--guest-panel-strong)] px-4 py-4 shadow-[var(--guest-shadow-soft)]">
    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--guest-panel)] text-[var(--guest-text)] shadow-[var(--guest-shadow-soft)]">
      {icon}
    </div>
    <p className="text-sm font-medium text-[var(--guest-text)]">{label}</p>
  </div>
);

const renderMessageContent = (content: string): React.ReactNode[] => {
  const parts = content.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`bold-${index}`} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
  });
};

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  children,
  defaultOpen = false,
  eyebrow,
  title,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[32px] border border-[color:var(--guest-border)] bg-[var(--guest-panel)] px-5 py-5 text-[var(--guest-text)] shadow-[var(--guest-shadow)] sm:px-6"
    >
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={isOpen}
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--guest-muted)]">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">{title}</h3>
        </div>
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--guest-accent-soft)] text-[var(--guest-text)]">
          <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-6">
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
};

const ChatPanel: React.FC<{
  input: string;
  isLoading: boolean;
  isTyping: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}> = ({ input, isLoading, isTyping, messages, onClose, onInputChange, onSubmit }) => {
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isTyping]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[color:var(--guest-border)] bg-[var(--guest-panel)] px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--color-bg1))] text-[rgb(var(--color-gold2))] shadow-[var(--guest-shadow-soft)]">
            <Bot className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--guest-panel)] bg-[rgb(var(--color-gold))]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--guest-text)]">Rozer Bot</p>
            <p className="text-xs text-[var(--guest-muted)]">Online · Contact assistant</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgb(var(--color-bg1))] text-[var(--guest-text)] transition-transform duration-200 hover:scale-[1.03]"
          aria-label="Close Rozer chat"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div
        ref={messagesRef}
        className="min-h-0 flex-1 overflow-y-auto bg-[var(--guest-bg)] px-4 py-4 sm:px-5"
      >
        <div className="flex min-h-full flex-col justify-end gap-3">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, scale: 0.96, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 8, scale: 0.96, filter: 'blur(8px)' }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className={message.role === 'assistant' ? 'flex justify-start' : 'flex justify-end'}
              >
                <div
                  className={[
                    'max-w-[88%] rounded-[24px] px-4 py-3 text-sm leading-6 shadow-[0_10px_30px_rgba(16,21,28,0.06)]',
                    message.role === 'assistant'
                      ? 'rounded-bl-[8px] border border-[color:var(--guest-border)] bg-[var(--guest-panel)] text-[var(--guest-text)]'
                      : 'rounded-br-[8px] bg-[rgb(var(--color-bg1))] text-[rgb(var(--color-text))]',
                  ].join(' ')}
                >
                  {renderMessageContent(message.content)}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <AnimatePresence>
            {isTyping ? (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 10, scale: 0.96, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 8, scale: 0.96, filter: 'blur(8px)' }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="flex justify-start"
              >
                <div className="flex items-center gap-1 rounded-[22px] rounded-bl-[8px] border border-[color:var(--guest-border)] bg-[var(--guest-panel)] px-4 py-3 shadow-[var(--guest-shadow-soft)]">
                  {[0, 1, 2].map((index) => (
                    <motion.span
                      key={index}
                      className="h-2 w-2 rounded-full bg-[color:color-mix(in_srgb,var(--guest-text)_42%,transparent)]"
                      animate={{ opacity: [0.28, 1, 0.28], y: [0, -2, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: index * 0.12 }}
                    />
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="border-t border-[color:var(--guest-border)] bg-[var(--guest-panel)] px-4 py-4 sm:px-5">
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
            rows={1}
            placeholder="Write your message..."
            className="unstyled-control max-h-32 min-h-[52px] flex-1 resize-none rounded-[22px] border border-[color:var(--guest-border)] bg-[var(--guest-panel-strong)] px-4 py-3 text-sm text-[var(--guest-text)] shadow-none outline-none placeholder:text-[color:color-mix(in_srgb,var(--guest-muted)_78%,transparent)]"
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onSubmit}
            disabled={input.trim() === '' || isLoading}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--guest-accent)] text-[var(--guest-accent-button-text)] shadow-[var(--guest-shadow-soft)] transition duration-200 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Send message"
          >
            <Send className="h-[18px] w-[18px]" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

const RozerFloatingChat: React.FC = () => {
  const initialState = useMemo(() => loadStoredState(), []);
  const [backendUnavailable, setBackendUnavailable] = useState<boolean>(initialState.backendUnavailable);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState('');
  const [leadFingerprint, setLeadFingerprint] = useState<string | null>(initialState.leadFingerprint);
  const [messages, setMessages] = useState<ChatMessage[]>(initialState.messages);
  const [sessionUuid, setSessionUuid] = useState<string | null>(initialState.sessionUuid);
  const sourcePage = typeof window !== 'undefined' ? window.location.pathname : '/contact-us';

  useEffect(() => {
    setIsBootstrapped(true);
  }, []);

  useEffect(() => {
    if (!isBootstrapped || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      ROZER_CHAT_STORAGE_KEY,
      JSON.stringify({
        backendUnavailable,
        leadFingerprint,
        messages,
        sessionUuid,
      } satisfies StoredRozerChatState),
    );
  }, [backendUnavailable, isBootstrapped, leadFingerprint, messages, sessionUuid]);

  useEffect(() => {
    if (!sessionUuid || !isBootstrapped) {
      return;
    }

    let isCancelled = false;

    const hydrateServerHistory = async () => {
      try {
        const response = await api.get<ApiEnvelope<GetSessionResponse>>(`/ai-chat/session/${sessionUuid}`);
        const payload = response.data?.data;

        if (!payload || isCancelled) {
          return;
        }

        const hydratedMessages = payload.messages
          .filter((message) => message.role === 'assistant' || message.role === 'user')
          .map((message) => ({
            id: makeMessageId(),
            role: message.role as ChatRole,
            content: message.content,
          }));

        if (hydratedMessages.length > 0) {
          setMessages(hydratedMessages);
        }
      } catch {
        // Keep local history if server hydration fails.
      }
    };

    void hydrateServerHistory();

    return () => {
      isCancelled = true;
    };
  }, [isBootstrapped, sessionUuid]);

  const ensureSession = async (): Promise<string> => {
    if (sessionUuid) {
      return sessionUuid;
    }

    const response = await api.post<ApiEnvelope<CreateSessionResponse>>('/ai-chat/session', {
      source_page: sourcePage,
    });
    const nextSessionUuid = response.data.data.session_uuid;
    setSessionUuid(nextSessionUuid);

    return nextSessionUuid;
  };

  const appendMessage = (role: ChatRole, content: string) => {
    setMessages((current) => [
      ...current,
      {
        id: makeMessageId(),
        role,
        content,
      },
    ]);
  };

  const handleSubmit = async () => {
    const content = input.trim();

    if (content === '' || isLoading) {
      return;
    }

    appendMessage('user', content);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      if (backendUnavailable) {
        appendMessage('assistant', buildFallbackReply(content));
        return;
      }

      const activeSessionUuid = await ensureSession();

      const response = await api.post<ApiEnvelope<SendMessageResponse>>('/ai-chat/message', {
        session_uuid: activeSessionUuid,
        message: content,
        source_page: sourcePage,
      });

      const payload = response.data.data;

      if (payload.message?.content?.trim()) {
        appendMessage('assistant', payload.message.content.trim());
      }

      if (payload.lead_detected) {
        const detectedLead = detectLeadInput(content);
        const fingerprint = detectedLead ? buildLeadFingerprint(detectedLead) : null;

        if (fingerprint) {
          setLeadFingerprint(fingerprint);
        }
      }
    } catch (error) {
      if (isMissingAiRouteError(error)) {
        setBackendUnavailable(true);
        appendMessage(
          'assistant',
          "Live chat is not connected on this server yet, but I can still help in contact mode. Please leave your phone number or email, or contact raed.ghanim.2014@gmail.com / +96171251044.",
        );
        return;
      }

      appendMessage(
        'assistant',
        getErrorMessage(error, 'Sorry, something went wrong. Please try again in a moment.'),
      );
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 20, scale: 0.96, filter: 'blur(8px)' }}
            transition={{ type: 'spring', stiffness: 280, damping: 24, mass: 0.88 }}
            className="fixed left-3 right-3 top-[max(12px,env(safe-area-inset-top))] bottom-[max(12px,env(safe-area-inset-bottom))] z-[2147483647] flex flex-col overflow-hidden rounded-[28px] border border-[color:var(--guest-border)] bg-[var(--guest-panel)] shadow-[var(--guest-shadow)] sm:left-5 sm:right-5 sm:top-5 sm:bottom-5 sm:h-auto sm:max-h-none sm:w-auto"
          >
            <ChatPanel
              input={input}
              isLoading={isLoading}
              isTyping={isTyping}
              messages={messages}
              onClose={() => setIsOpen(false)}
              onInputChange={setInput}
              onSubmit={() => {
                void handleSubmit();
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isOpen ? (
        <motion.button
          type="button"
          initial={{ x: 0, rotate: 0, scale: 1 }}
          animate={{
            x: [0, -2, 2, -1, 1, 0],
            rotate: [0, -2, 2, -1.5, 1.5, 0],
            scale: [1, 1.02, 1.02, 1],
          }}
          transition={{
            duration: 0.7,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatDelay: 5.4,
          }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsOpen(true)}
          className="fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-[2147483647] inline-flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(var(--color-bg1))] text-[rgb(var(--color-text))] shadow-[var(--guest-shadow)] sm:right-5 sm:bottom-5"
          aria-label="Open Rozer chat"
        >
          <MessageSquareMore className="h-6 w-6" />
          <span className="absolute right-3 top-3 h-3.5 w-3.5 rounded-full border-2 border-[rgb(var(--color-bg1))] bg-[rgb(var(--color-gold))]" />
        </motion.button>
      ) : null}
    </>
  );
};

const RozerContactAiPage: React.FC = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-bg0 text-text">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(circle at top left, color-mix(in srgb, var(--guest-accent) 18%, transparent), transparent 34%)',
            'radial-gradient(circle at 80% 20%, color-mix(in srgb, var(--guest-panel) 18%, transparent), transparent 24%)',
            'linear-gradient(180deg, color-mix(in srgb, rgb(var(--color-bg0)) 92%, transparent), rgb(var(--color-bg0)))',
          ].join(','),
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
        <motion.section
          initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-[36px] border border-[color:var(--guest-border)] bg-[var(--guest-panel)] px-5 py-6 text-[var(--guest-text)] shadow-[var(--guest-shadow)] sm:px-7 sm:py-8 lg:px-10 lg:py-10"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_360px] lg:items-center">
            <div>
              <Badge tone="accent">Rozer AI Contact Assistant</Badge>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-[var(--guest-text)] sm:text-5xl lg:text-[3.6rem]">
                Fast, professional AI help that makes contacting the right team feel easy.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--guest-muted)] sm:text-lg">
                Rozer Bot helps visitors get answers quickly, understand what to do next, and continue the conversation with confidence.
                It is designed to feel professional, clear, and trustworthy from the first message to the final follow-up.
              </p>

              <div className="mt-6 rounded-[24px] border border-[color:var(--guest-border)] bg-[var(--guest-panel-strong)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--guest-muted)]">
                  Why this helps visitors
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--guest-muted)]">
                  Visitors do not need to guess where to start or wait for a first reply.
                  The chatbot gives fast guidance, answers common questions in a professional tone,
                  and helps them reach the Rozer team through one simple conversation.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <Badge>Quick guidance</Badge>
                <Badge>Professional replies</Badge>
                <Badge>Clear next steps</Badge>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 18, filter: 'blur(12px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.08, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-[32px] bg-[rgb(var(--color-bg1))] p-5 text-[rgb(var(--color-text))] shadow-[var(--guest-shadow)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--guest-panel)_84%,transparent)] text-[rgb(var(--color-gold2))]">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold">Rozer Bot</p>
                  <p className="text-xs text-[var(--guest-muted)]">AI contact assistant</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="max-w-[92%] rounded-[24px] rounded-bl-[8px] bg-[var(--guest-panel)] px-4 py-3 text-sm leading-6 text-[var(--guest-text)]">
                  Hi, I&apos;m Rozer, your AI contact assistant. I&apos;m a bot, and I&apos;m here to help you quickly and clearly.
                </div>
                <div className="ml-auto max-w-[86%] rounded-[24px] rounded-br-[8px] bg-[color:color-mix(in_srgb,var(--guest-panel)_18%,transparent)] px-4 py-3 text-sm leading-6 text-[rgb(var(--color-text))]">
                  You can continue directly in this chat, and I&apos;ll help guide you to the Rozer team in the fastest way.
                </div>
              </div>

              <div className="mt-5 grid gap-3 rounded-[24px] border border-[color:var(--guest-border)] bg-[color:color-mix(in_srgb,var(--guest-panel)_12%,transparent)] p-4 text-sm">
                <div className="flex items-center gap-3">
                  <Clock3 className="h-[18px] w-[18px] text-[rgb(var(--color-gold2))]" />
                  <span>Fast support guidance, 24/7</span>
                </div>
                <div className="flex items-center gap-3">
                  <MessageSquareMore className="h-[18px] w-[18px] text-[rgb(var(--color-gold2))]" />
                  <span>The easiest way to contact the team is directly through the chatbot</span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        <section className="mt-8 sm:mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[rgb(var(--color-gold2))]">
                Visitor benefits
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text sm:text-3xl">
                What visitors get right away.
              </h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FeatureCard
              icon={<MessageSquareMore className="h-5 w-5" />}
              title="Fast replies"
              description="Visitors can ask immediately and get guided quickly instead of searching for the right contact path."
            />
            <FeatureCard
              icon={<Sparkles className="h-5 w-5" />}
              title="Professional tone"
              description="The conversation stays calm, clear, and respectful, which makes the experience feel more reliable."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Trustworthy guidance"
              description="The bot is honest about what it knows, escalates sensitive topics, and keeps communication safe."
            />
            <FeatureCard
              icon={<Waypoints className="h-5 w-5" />}
              title="Smooth handoff"
              description="When more help is needed, the chatbot helps the visitor move naturally toward a real team follow-up."
            />
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <CollapsibleSection
            defaultOpen={false}
            eyebrow="Bot behavior"
            title="How Rozer keeps the experience professional"
          >
            <ul className="space-y-4">
              <BehaviorItem>Introduces itself as Rozer and clearly says that it is a bot.</BehaviorItem>
              <BehaviorItem>Answers support, pricing, demo, and contact questions in a fast and professional way.</BehaviorItem>
              <BehaviorItem>Keeps replies short and clear so visitors understand the next step without confusion.</BehaviorItem>
              <BehaviorItem>Suggests leaving a phone number or email only when it helps the visitor continue smoothly.</BehaviorItem>
              <BehaviorItem>Explains that pricing is handled by the Rozer team and depends on the request and setup needs.</BehaviorItem>
              <BehaviorItem>Escalates private, technical, financial, or security-sensitive questions instead of guessing.</BehaviorItem>
              <BehaviorItem>Never pressures the visitor and always keeps the tone respectful and trustworthy.</BehaviorItem>
            </ul>
          </CollapsibleSection>

          <CollapsibleSection
            defaultOpen={true}
            eyebrow="Lead information"
            title="What the bot can collect if the visitor wants follow-up"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniInfo icon={<UserRound className="h-5 w-5" />} label="Name" />
              <MiniInfo icon={<Phone className="h-5 w-5" />} label="Phone / WhatsApp" />
              <MiniInfo icon={<Mail className="h-5 w-5" />} label="Email address" />
              <MiniInfo icon={<Clock3 className="h-5 w-5" />} label="Preferred contact time" />
              <MiniInfo icon={<MessageSquareMore className="h-5 w-5" />} label="Guest message" />
              <MiniInfo icon={<BriefcaseBusiness className="h-5 w-5" />} label="Business type" />
            </div>
          </CollapsibleSection>
        </section>
      </div>

      <RozerFloatingChat />
    </div>
  );
};

export default RozerContactAiPage;
