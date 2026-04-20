import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useOrderCart } from '../contexts/useOrderCart';

type Role = 'user' | 'assistant';
type SupportedLanguage = 'ar' | 'fr' | 'en';

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
}

interface ChatOrderItem {
  name: string;
  quantity: number;
}

interface PlaceOrderData {
  action: 'place_order';
  items: ChatOrderItem[];
}

interface ChatApiResponse {
  reply: string;
  order_data?: {
    action?: string;
    items?: unknown;
  };
}

interface ChatRestaurantContext {
  restaurant_slug?: string;
  table_id?: number;
}

const makeId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const isSameOriginApiBase = (baseUrl: string): boolean => {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    return new URL(baseUrl, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
};

const resolveApiBase = (): string => {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv && fromEnv.trim() !== '') {
    const normalized = fromEnv.replace(/\/+$/, '');

    // Chat depends on session cookies; prefer same-origin to avoid CORS/session issues.
    if (isSameOriginApiBase(normalized)) {
      return normalized;
    }
  }

  return '/api';
};

const detectLanguageFromText = (text: string): SupportedLanguage => {
  if (/[\u0600-\u06FF]/.test(text)) {
    return 'ar';
  }

  if (/[àâçéèêëîïôûùüÿœæ]/i.test(text)) {
    return 'fr';
  }

  if (/\b(bonjour|bonsoir|merci|s(?:'|’)il|je|voudrais|avec|sans|pour|menu|commande)\b/i.test(text)) {
    return 'fr';
  }

  return 'en';
};

const getApiErrorMessage = async (
  response: Response,
  fallback: string
): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: unknown };
    if (typeof payload?.message === 'string' && payload.message.trim() !== '') {
      return payload.message.trim();
    }
  } catch {
    // ignore parse errors
  }

  return fallback;
};

const normalizePlaceOrder = (raw?: ChatApiResponse['order_data']): PlaceOrderData | null => {
  if (!raw || raw.action !== 'place_order' || !Array.isArray(raw.items)) {
    return null;
  }

  const items = raw.items
    .map((item): ChatOrderItem | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as { name?: unknown; quantity?: unknown };
      const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
      const qtyRaw = candidate.quantity;
      const quantity = typeof qtyRaw === 'number'
        ? Math.floor(qtyRaw)
        : typeof qtyRaw === 'string' && qtyRaw.trim() !== ''
          ? Math.floor(Number(qtyRaw))
          : 0;

      if (!name || !Number.isFinite(quantity) || quantity <= 0) {
        return null;
      }

      return { name, quantity };
    })
    .filter((item): item is ChatOrderItem => item !== null);

  if (items.length === 0) {
    return null;
  }

  return {
    action: 'place_order',
    items,
  };
};

const renderChatText = (text: string): React.ReactNode => {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  return lines.map((line, lineIndex) => {
    const chunks: React.ReactNode[] = [];
    const boldPattern = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null = boldPattern.exec(line);

    while (match) {
      if (match.index > lastIndex) {
        chunks.push(line.slice(lastIndex, match.index));
      }

      chunks.push(
        <strong key={`b-${lineIndex}-${match.index}`} className="font-semibold">
          {match[1]}
        </strong>
      );

      lastIndex = match.index + match[0].length;
      match = boldPattern.exec(line);
    }

    if (lastIndex < line.length) {
      chunks.push(line.slice(lastIndex));
    }

    if (chunks.length === 0) {
      chunks.push(line);
    }

    return (
      <React.Fragment key={`line-${lineIndex}`}>
        {chunks}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </React.Fragment>
    );
  });
};

const safeDecodePathSegment = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parsePathRestaurantContext = (pathname: string): ChatRestaurantContext => {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const tableMatch = normalizedPath.match(/^\/menu\/table\/(\d+)(?:\/|$)/i);

  if (tableMatch) {
    return {
      table_id: Number(tableMatch[1]),
    };
  }

  const restaurantMatch = normalizedPath.match(/^\/menu\/([^/]+)(?:\/|$)/i);
  if (restaurantMatch && restaurantMatch[1].toLowerCase() !== 'table') {
    return {
      restaurant_slug: safeDecodePathSegment(restaurantMatch[1]),
    };
  }

  return {};
};

const ChatBot: React.FC = () => {
  const location = useLocation();
  const { restaurant } = useOrderCart();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);
  const [conversationId, setConversationId] = useState<string>(() => makeId());
  const [pendingOrder, setPendingOrder] = useState<PlaceOrderData | null>(null);
  const [orderNotice, setOrderNotice] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chatRequestAbortRef = useRef<AbortController | null>(null);
  const orderRequestAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const apiBase = useMemo(() => resolveApiBase(), []);
  const chatContext = useMemo<ChatRestaurantContext>(() => {
    const fromPath = parsePathRestaurantContext(location.pathname);

    return {
      restaurant_slug: fromPath.restaurant_slug ?? restaurant?.slug,
      // Only send table context when URL is explicitly table-scoped.
      table_id: fromPath.table_id,
    };
  }, [location.pathname, restaurant?.slug]);
  const chatContextKey = `${chatContext.restaurant_slug ?? 'none'}::${chatContext.table_id ?? 'none'}`;
  const previousChatContextKeyRef = useRef(chatContextKey);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      chatRequestAbortRef.current?.abort();
      orderRequestAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isLoading, pendingOrder, isConfirmingOrder, orderNotice]);

  useEffect(() => {
    if (previousChatContextKeyRef.current === chatContextKey) {
      return;
    }

    previousChatContextKeyRef.current = chatContextKey;
    chatRequestAbortRef.current?.abort();
    orderRequestAbortRef.current?.abort();
    setMessages([]);
    setConversationId(makeId());
    setPendingOrder(null);
    setOrderNotice(null);
  }, [chatContextKey]);

  const pushMessage = (role: Role, content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: makeId(),
        role,
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const clearConversation = () => {
    setMessages([]);
    setConversationId(makeId());
    setPendingOrder(null);
    setOrderNotice(null);
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || isLoading || isConfirmingOrder) return;

    setOrderNotice(null);
    pushMessage('user', content);
    setInput('');
    setIsLoading(true);

    try {
      chatRequestAbortRef.current?.abort();
      const controller = new AbortController();
      chatRequestAbortRef.current = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 20000);

      const response = await fetch(`${apiBase}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          message: content,
          conversation_id: conversationId,
          language: detectLanguageFromText(content),
          restaurant_slug: chatContext.restaurant_slug,
          table_id: chatContext.table_id,
        }),
      });
      window.clearTimeout(timeoutId);
      chatRequestAbortRef.current = null;

      if (!response.ok) {
        const message = await getApiErrorMessage(
          response,
          `Request failed (${response.status})`
        );
        throw new Error(message);
      }

      const data = (await response.json()) as ChatApiResponse;
      const reply = (data.reply || '').trim();
      const nextPendingOrder = normalizePlaceOrder(data.order_data);

      if (reply) {
        pushMessage('assistant', reply);
      } else if (!nextPendingOrder) {
        pushMessage('assistant', 'Sorry, I could not generate a response.');
      }

      if (nextPendingOrder) {
        setPendingOrder(nextPendingOrder);
      }
    } catch (error) {
      if (!isMountedRef.current) return;

      if (error instanceof DOMException && error.name === 'AbortError') {
        pushMessage('assistant', 'Request timed out. Please try again.');
      } else {
        const fallbackMessage = error instanceof Error && error.message.trim() !== ''
          ? error.message
          : 'Sorry, something went wrong. Please try again.';
        pushMessage('assistant', fallbackMessage);
      }
    } finally {
      chatRequestAbortRef.current = null;
      if (!isMountedRef.current) return;
      setIsLoading(false);
    }
  };

  const confirmPendingOrder = async () => {
    if (!pendingOrder || isConfirmingOrder || isLoading) return;

    setOrderNotice(null);
    setIsConfirmingOrder(true);

    try {
      orderRequestAbortRef.current?.abort();
      const controller = new AbortController();
      orderRequestAbortRef.current = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${apiBase}/chat/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          items: pendingOrder.items,
        }),
      });
      window.clearTimeout(timeoutId);
      orderRequestAbortRef.current = null;

      if (!response.ok) {
        const message = await getApiErrorMessage(
          response,
          `Order request failed (${response.status})`
        );
        throw new Error(message);
      }

      setPendingOrder(null);
      setOrderNotice('Order sent to waiter successfully');
      pushMessage('assistant', 'Order sent to waiter successfully');
    } catch (error) {
      if (!isMountedRef.current) return;

      if (error instanceof DOMException && error.name === 'AbortError') {
        setOrderNotice('Order request timed out. Please try again.');
        return;
      }

      const message = error instanceof Error && error.message.trim() !== ''
        ? error.message
        : 'Could not send the order. Please try again.';
      setOrderNotice(message);
    } finally {
      orderRequestAbortRef.current = null;
      if (!isMountedRef.current) return;
      setIsConfirmingOrder(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  return (
    <div
      className="fixed bottom-24 right-4 z-[1000] sm:bottom-6 sm:right-6"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {isOpen ? (
        <div className="w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-white/20 bg-white/90 shadow-2xl backdrop-blur-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Restaurant Assistant</p>
              <p className="text-xs text-slate-500">Ask about dishes, ingredients, and orders</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          <div
            ref={listRef}
            className="h-72 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50 to-white px-3 py-3 sm:h-80"
          >
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                Hi! I can help with menu questions, ingredients, allergies, and recommendations.
              </div>
            ) : null}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={[
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm',
                    msg.role === 'user'
                      ? 'rounded-br-md bg-slate-900 text-white'
                      : 'rounded-bl-md border border-slate-200 bg-white text-slate-800',
                  ].join(' ')}
                >
                  {renderChatText(msg.content)}
                </div>
              </div>
            ))}

            {pendingOrder ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-semibold">Confirm order</p>
                <ul className="mt-2 space-y-1 text-emerald-800">
                  {pendingOrder.items.map((item, index) => (
                    <li key={`${item.name}-${index}`}>
                      {item.quantity} x {item.name}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void confirmPendingOrder()}
                    disabled={isConfirmingOrder || isLoading}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isConfirmingOrder ? 'Sending...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingOrder(null)}
                    disabled={isConfirmingOrder}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {orderNotice ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                {orderNotice}
              </div>
            ) : null}

            {isLoading ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                  Thinking...
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200/70 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={clearConversation}
                className="text-xs font-medium text-slate-500 transition hover:text-slate-800"
              >
                Clear conversation
              </button>
            </div>

            <form onSubmit={onSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-500"
                disabled={isLoading || isConfirmingOrder}
              />
              <button
                type="submit"
                disabled={isLoading || isConfirmingOrder || input.trim().length === 0}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl transition hover:scale-105 hover:bg-black"
          aria-label="Open chat"
        >
          <span className="text-xl">💬</span>
        </button>
      )}
    </div>
  );
};

export default ChatBot;
