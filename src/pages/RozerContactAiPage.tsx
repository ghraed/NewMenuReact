"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  BriefcaseBusiness,
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

const INITIAL_MESSAGE = "Hi, I'm Rozer, your AI contact assistant. I'm a bot, but I'm here to help you quickly. Are you looking for support, pricing, a demo, or general contact information?";
const ROZER_CHAT_STORAGE_KEY = 'rozer-contact-ai-chat';

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
        ? 'border-[rgb(var(--color-gold)/0.38)] bg-[rgb(var(--color-gold)/0.16)] text-[rgb(var(--color-bg0))]'
        : 'border-[rgb(var(--color-bg0)/0.08)] bg-white/80 text-[rgb(var(--color-bg0)/0.72)]',
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
    className="rounded-[28px] border border-[rgb(var(--color-bg0)/0.08)] bg-white px-5 py-5 shadow-[0_18px_48px_rgba(5,8,19,0.08)]"
  >
    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--color-gold)/0.14)] text-[rgb(var(--color-bg0))]">
      {icon}
    </div>
    <h3 className="text-lg font-semibold tracking-[-0.02em] text-[rgb(var(--color-bg0))]">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-[rgb(var(--color-bg0)/0.66)]">{description}</p>
  </motion.article>
);

const BehaviorItem: React.FC<BehaviorItemProps> = ({ children }) => (
  <li className="flex items-start gap-3 text-sm leading-6 text-[rgb(var(--color-bg0)/0.7)]">
    <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-gold)/0.14)] text-[rgb(var(--color-bg0))]">
      <CircleDot className="h-3.5 w-3.5" />
    </span>
    <span>{children}</span>
  </li>
);

const MiniInfo: React.FC<MiniInfoProps> = ({ icon, label }) => (
  <div className="rounded-2xl border border-[rgb(var(--color-bg0)/0.08)] bg-[rgb(251,249,244)] px-4 py-4 shadow-[0_8px_24px_rgba(5,8,19,0.04)]">
    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[rgb(var(--color-bg0))] shadow-[0_8px_18px_rgba(5,8,19,0.08)]">
      {icon}
    </div>
    <p className="text-sm font-medium text-[rgb(var(--color-bg0)/0.8)]">{label}</p>
  </div>
);

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isTyping]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#e9e1d5] bg-white px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10151c] text-[rgb(var(--color-gold2))] shadow-[0_18px_38px_rgba(16,21,28,0.18)]">
            <Bot className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#b89560]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--color-bg0))]">Rozer Bot</p>
            <p className="text-xs text-[rgb(var(--color-bg0)/0.56)]">Online · Contact assistant</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#10151c] text-[rgb(251,249,244)] transition-transform duration-200 hover:scale-[1.03]"
          aria-label="Close Rozer chat"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div
        ref={messagesRef}
        className="min-h-0 flex-1 overflow-y-auto bg-[#fbf9f4] px-4 py-4 sm:px-5"
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
                      ? 'rounded-bl-[8px] border border-[#e9e1d5] bg-white text-[rgb(var(--color-bg0)/0.88)]'
                      : 'rounded-br-[8px] bg-[#10151c] text-[#f5eee3]',
                  ].join(' ')}
                >
                  {message.content}
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
                <div className="flex items-center gap-1 rounded-[22px] rounded-bl-[8px] border border-[#e9e1d5] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(16,21,28,0.06)]">
                  {[0, 1, 2].map((index) => (
                    <motion.span
                      key={index}
                      className="h-2 w-2 rounded-full bg-[rgb(var(--color-bg0)/0.44)]"
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

      <div className="border-t border-[#e9e1d5] bg-white px-4 py-4 sm:px-5">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
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
            className="unstyled-control max-h-32 min-h-[52px] flex-1 resize-none rounded-[22px] border border-[#efe4d4] bg-[#fbf8f1] px-4 py-3 text-sm text-[rgb(var(--color-bg0)/0.86)] shadow-none outline-none placeholder:text-[rgb(var(--color-bg0)/0.4)]"
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onSubmit}
            disabled={input.trim() === '' || isLoading}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#d9c3a3] text-[#10151c] shadow-[0_16px_28px_rgba(217,195,163,0.35)] transition duration-200 disabled:cursor-not-allowed disabled:opacity-45"
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
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState('');
  const [leadFingerprint, setLeadFingerprint] = useState<string | null>(initialState.leadFingerprint);
  const [messages, setMessages] = useState<ChatMessage[]>(initialState.messages);
  const [sessionUuid, setSessionUuid] = useState<string | null>(initialState.sessionUuid);
  const sourcePage = typeof window !== 'undefined' ? window.location.pathname : '/rozer-ai';

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
            className="fixed left-3 right-3 top-[max(12px,env(safe-area-inset-top))] bottom-[max(12px,env(safe-area-inset-bottom))] z-[999999] flex flex-col overflow-hidden rounded-[28px] border border-[#e4ddd0] bg-white shadow-[0_32px_80px_rgba(5,8,19,0.28)] sm:left-5 sm:right-5 sm:top-5 sm:bottom-5 sm:h-auto sm:max-h-none sm:w-auto"
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
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsOpen(true)}
          className="fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-[999999] inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#10151c] text-[#f5eee3] shadow-[0_26px_58px_rgba(16,21,28,0.34)] sm:right-5 sm:bottom-5"
          aria-label="Open Rozer chat"
        >
          <MessageSquareMore className="h-6 w-6" />
          <span className="absolute right-3 top-3 h-3.5 w-3.5 rounded-full border-2 border-[#10151c] bg-[#b89560]" />
        </motion.button>
      ) : null}
    </>
  );
};

const RozerContactAiPage: React.FC = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[rgb(var(--color-bg0))] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(243,215,154,0.16),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(255,255,255,0.08),_transparent_24%),linear-gradient(180deg,_rgba(8,12,24,0.88),_rgba(5,8,19,1))]" />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
        <motion.section
          initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-[36px] border border-white/12 bg-white px-5 py-6 text-[rgb(var(--color-bg0))] shadow-[0_28px_90px_rgba(0,0,0,0.2)] sm:px-7 sm:py-8 lg:px-10 lg:py-10"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_360px] lg:items-center">
            <div>
              <Badge tone="accent">Rozer AI Contact Assistant</Badge>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-[rgb(var(--color-bg0))] sm:text-5xl lg:text-[3.6rem]">
                Friendly AI support that turns visitors into real leads.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[rgb(var(--color-bg0)/0.7)] sm:text-lg">
                Rozer Bot helps visitors ask about support, pricing, demos, and general contact information,
                then safely moves interested guests toward a real human follow-up through phone or email collection.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <Badge>Clearly says it is a bot</Badge>
                <Badge>Collects phone or email</Badge>
                <Badge>Professional contact flow</Badge>
              </div>

              <div className="mt-6 rounded-[24px] border border-[rgb(var(--color-bg0)/0.08)] bg-[rgb(251,249,244)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--color-bg0)/0.48)]">
                  Rozer platform coverage
                </p>
                <p className="mt-3 text-sm leading-6 text-[rgb(var(--color-bg0)/0.72)]">
                  Rozer can help visitors discover the platform across QR menu experiences, guest ordering,
                  staff order management, chef kitchen workflows, accounting, invoices, inventory ingredients,
                  stock history, reservations, room planning, event flows, analytics, and modern customer-facing service tools.
                </p>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 18, filter: 'blur(12px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.08, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-[32px] bg-[#10151c] p-5 text-[#f5eee3] shadow-[0_28px_60px_rgba(16,21,28,0.26)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[rgb(var(--color-gold2))]">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold">Rozer Bot</p>
                  <p className="text-xs text-[#f5eee3]/64">AI contact assistant</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="max-w-[92%] rounded-[24px] rounded-bl-[8px] bg-white px-4 py-3 text-sm leading-6 text-[#10151c]">
                  Hi, I&apos;m Rozer, your AI contact assistant. I&apos;m a bot, but I&apos;m here to help you quickly.
                </div>
                <div className="ml-auto max-w-[86%] rounded-[24px] rounded-br-[8px] bg-white/8 px-4 py-3 text-sm leading-6 text-[#f5eee3]">
                  Would you like to leave your phone number or email so the Rozer team can contact you?
                </div>
              </div>

              <div className="mt-5 grid gap-3 rounded-[24px] border border-white/10 bg-white/6 p-4 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="h-[18px] w-[18px] text-[rgb(var(--color-gold2))]" />
                  <span>raed.ghanim.2014@gmail.com</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-[18px] w-[18px] text-[rgb(var(--color-gold2))]" />
                  <span>+96171251044</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock3 className="h-[18px] w-[18px] text-[rgb(var(--color-gold2))]" />
                  <span>Business hours: 24/7</span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        <section className="mt-8 sm:mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[rgb(var(--color-gold2)/0.92)]">
                Strengths
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
                Built for confident first contact.
              </h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FeatureCard
              icon={<MessageSquareMore className="h-5 w-5" />}
              title="Answers contact questions"
              description="Guides visitors through support, demos, pricing requests, and general contact needs with clear next steps."
            />
            <FeatureCard
              icon={<Sparkles className="h-5 w-5" />}
              title="Smart lead qualification"
              description="Understands visitor intent and gently gathers the details your team needs before a real follow-up."
            />
            <FeatureCard
              icon={<Phone className="h-5 w-5" />}
              title="Collects contact details"
              description="Captures phone, email, and business context in a conversational way that feels natural on mobile."
            />
            <FeatureCard
              icon={<Waypoints className="h-5 w-5" />}
              title="Human handoff ready"
              description="Keeps the conversation ready for the Rozer team when a request needs a personal reply or a demo callback."
            />
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <motion.article
            initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[32px] border border-white/10 bg-white px-5 py-6 text-[rgb(var(--color-bg0))] shadow-[0_20px_60px_rgba(0,0,0,0.16)] sm:px-6"
          >
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgb(var(--color-gold)/0.15)] text-[rgb(var(--color-bg0))]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[rgb(var(--color-bg0)/0.44)]">
                  Bot behavior
                </p>
                <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">How Rozer speaks and assists</h3>
              </div>
            </div>

            <ul className="mt-6 space-y-4">
              <BehaviorItem>Introduces itself as Rozer and clearly says that it is a bot.</BehaviorItem>
              <BehaviorItem>Answers questions about contact, support, pricing, demos, and product capabilities in a short professional tone.</BehaviorItem>
              <BehaviorItem>Suggests leaving a phone number or email once the visitor shows real interest.</BehaviorItem>
              <BehaviorItem>Says pricing is handled by the Rozer team and depends on the restaurant’s setup and needs.</BehaviorItem>
              <BehaviorItem>Escalates sensitive topics such as money details, private information, infrastructure questions, hacking-style prompts, and vendor/AI implementation details.</BehaviorItem>
              <BehaviorItem>Never pressures the visitor and offers human follow-up whenever the question should be forwarded.</BehaviorItem>
            </ul>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: 0.05, duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[32px] border border-white/10 bg-white px-5 py-6 text-[rgb(var(--color-bg0))] shadow-[0_20px_60px_rgba(0,0,0,0.16)] sm:px-6"
          >
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgb(var(--color-gold)/0.15)] text-[rgb(var(--color-bg0))]">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[rgb(var(--color-bg0)/0.44)]">
                  Lead information
                </p>
                <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">What the bot can collect</h3>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <MiniInfo icon={<UserRound className="h-5 w-5" />} label="Name" />
              <MiniInfo icon={<Phone className="h-5 w-5" />} label="Phone / WhatsApp" />
              <MiniInfo icon={<Mail className="h-5 w-5" />} label="Email address" />
              <MiniInfo icon={<Clock3 className="h-5 w-5" />} label="Preferred contact time" />
              <MiniInfo icon={<MessageSquareMore className="h-5 w-5" />} label="Guest message" />
              <MiniInfo icon={<BriefcaseBusiness className="h-5 w-5" />} label="Business type" />
            </div>
          </motion.article>
        </section>
      </div>

      <RozerFloatingChat />
    </div>
  );
};

export default RozerContactAiPage;
