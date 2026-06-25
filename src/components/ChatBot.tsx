import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOrderCart } from '../contexts/useOrderCart';
import api, { getApiBase } from '../services/api';
import { fetchGuestTableDish } from '../services/orderService';
import type { Dish } from '../types';
import {
  buildGenericGuestDishPath,
  buildGuestDishPath,
  buildGuestRestaurantDishPath,
} from '../utils/guestTableRoutes';
import { getGuestRestaurantCandidateSlugs } from '../utils/guestRestaurant';
import {
  buildDishAliasLinks,
  collectRecommendationDishesFromFullMenu,
  findMentionedDish,
  isDirectDishIntent,
  mergeRecommendationDishes,
  normalizeDishName,
  resolveChatRecommendation,
  responseExplicitlyRecommendsDishName,
  sortRecommendationDishesByPriority,
  toChatRecommendationDishFromIndex,
  type ChatRecommendationDish,
  type ChatRecommendationResolution,
} from '../utils/chatbotRecommendations';
import { useGuestMenuResource } from '../contexts/GuestMenuResourceContext';

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

interface ChatDishLink {
  id: number;
  name: string;
  normalized: string;
  imageUrl?: string;
  isProfitable?: boolean;
  isOrderable?: boolean;
  isOutOfStock?: boolean;
  category?: string;
  categoryAr?: string | null;
}

interface ChatDishPreview {
  name: string;
  href: string;
  imageUrl?: string;
}

interface StoredChatState {
  conversationId: string;
  messages: ChatMessage[];
  pendingOrder: PlaceOrderData | null;
}

const CHAT_STATE_STORAGE_PREFIX = 'guest_chat_state:';

const makeId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

const sortChatDishesByPriority = (dishes: ChatDishLink[]): ChatDishLink[] => {
  return [...dishes].sort((left, right) => {
    const leftAvailableScore = left.isOrderable !== false && left.isOutOfStock !== true ? 1 : 0;
    const rightAvailableScore = right.isOrderable !== false && right.isOutOfStock !== true ? 1 : 0;

    if (leftAvailableScore !== rightAvailableScore) {
      return rightAvailableScore - leftAvailableScore;
    }

    const leftProfitScore = left.isProfitable === true ? 1 : 0;
    const rightProfitScore = right.isProfitable === true ? 1 : 0;

    if (leftProfitScore !== rightProfitScore) {
      return rightProfitScore - leftProfitScore;
    }

    return left.name.localeCompare(right.name);
  });
};
const buildProfitableSuggestionMessage = (
  resolution: ChatRecommendationResolution,
  dishes: ChatDishLink[]
): string | null => {
  if (dishes.length === 0) {
    return null;
  }

  const [primaryDish, secondaryDish, tertiaryDish] = dishes;
  const primaryName = `**${primaryDish.name}**`;
  const secondaryName = secondaryDish ? `**${secondaryDish.name}**` : null;
  const tertiaryName = tertiaryDish ? `**${tertiaryDish.name}**` : null;

  if (resolution.type === 'direct') {
    if (secondaryName) {
      return `If you want something in that direction, I'd start with ${primaryName}. ${secondaryName} is also a good second choice.`;
    }

    return `If you want something in that direction, I'd start with ${primaryName}.`;
  }

  if (resolution.type === 'category' && resolution.category) {
    if (secondaryName) {
      return `If you want my honest pick from the ${resolution.category}, I'd start with ${primaryName}. If you want a second option, ${secondaryName} is also a safe choice.`;
    }

    return `If you want my honest pick from the ${resolution.category}, I'd start with ${primaryName}.`;
  }

  if (!secondaryName) {
    return `If you want a solid place to start, I'd go with ${primaryName}.`;
  }

  if (!tertiaryName) {
    return `If you want a solid place to start, I'd go with ${primaryName}. ${secondaryName} is another good option if you want a second choice.`;
  }

  return `If you want a solid place to start, I'd go with ${primaryName}. ${secondaryName} and ${tertiaryName} are also good options depending on what you're in the mood for.`;
};

const buildDishHref = (
  dishId: number,
  dishName: string | undefined,
  context: ChatRestaurantContext
): string | null => {
  if (context.table_id && Number.isFinite(context.table_id) && context.table_id > 0) {
    return buildGuestDishPath(context.table_id, dishId, dishName);
  }

  if (context.restaurant_slug) {
    return buildGuestRestaurantDishPath(context.restaurant_slug, dishId, dishName);
  }

  return buildGenericGuestDishPath(dishId, dishName);
};

const findNextDishMatch = (
  loweredText: string,
  fromIndex: number,
  dishes: ChatDishLink[]
): { start: number; end: number; dish: ChatDishLink } | null => {
  let best: { start: number; end: number; dish: ChatDishLink } | null = null;

  for (const dish of dishes) {
    const start = loweredText.indexOf(dish.normalized, fromIndex);
    if (start < 0) {
      continue;
    }

    const end = start + dish.normalized.length;

    if (
      !best
      || start < best.start
      || (start === best.start && dish.normalized.length > (best.end - best.start))
    ) {
      best = { start, end, dish };
    }
  }

  return best;
};

const renderTextWithDishLinks = (
  text: string,
  dishes: ChatDishLink[],
  context: ChatRestaurantContext,
  keyPrefix: string,
  onDishTouchStart: (dish: ChatDishLink, href: string, event: React.TouchEvent<HTMLAnchorElement>) => void,
  onDishTouchEnd: (event: React.TouchEvent<HTMLAnchorElement>) => void,
  onDishTouchMove: (event: React.TouchEvent<HTMLAnchorElement>) => void
): React.ReactNode[] => {
  if (dishes.length === 0) {
    return [text];
  }

  const nodes: React.ReactNode[] = [];
  const loweredText = text.toLowerCase();
  let cursor = 0;

  while (cursor < text.length) {
    const match = findNextDishMatch(loweredText, cursor, dishes);
    if (!match) {
      nodes.push(text.slice(cursor));
      break;
    }

    if (match.start > cursor) {
      nodes.push(text.slice(cursor, match.start));
    }

    const label = text.slice(match.start, match.end);
    const href = buildDishHref(match.dish.id, match.dish.name, context);

    if (href) {
      nodes.push(
        <a
          key={`${keyPrefix}-dish-${match.start}-${match.dish.id}`}
          href={href}
          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100/80 px-2 py-0.5 font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
          onTouchStart={(event) => onDishTouchStart(match.dish, href, event)}
          onTouchEnd={onDishTouchEnd}
          onTouchCancel={onDishTouchEnd}
          onTouchMove={onDishTouchMove}
        >
          {label}
        </a>
      );
    } else {
      nodes.push(label);
    }

    cursor = match.end;
  }

  return nodes;
};

const renderChatText = (
  text: string,
  dishes: ChatDishLink[],
  context: ChatRestaurantContext,
  onDishTouchStart: (dish: ChatDishLink, href: string, event: React.TouchEvent<HTMLAnchorElement>) => void,
  onDishTouchEnd: (event: React.TouchEvent<HTMLAnchorElement>) => void,
  onDishTouchMove: (event: React.TouchEvent<HTMLAnchorElement>) => void
): React.ReactNode => {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  return lines.map((line, lineIndex) => {
    const chunks: React.ReactNode[] = [];
    const boldPattern = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null = boldPattern.exec(line);

    while (match) {
      if (match.index > lastIndex) {
        const plainText = line.slice(lastIndex, match.index);
        chunks.push(
          ...renderTextWithDishLinks(
            plainText,
            dishes,
            context,
            `p-${lineIndex}-${lastIndex}`,
            onDishTouchStart,
            onDishTouchEnd,
            onDishTouchMove
          )
        );
      }

      chunks.push(
        <strong key={`b-${lineIndex}-${match.index}`} className="font-semibold">
          {renderTextWithDishLinks(
            match[1],
            dishes,
            context,
            `b-${lineIndex}-${match.index}`,
            onDishTouchStart,
            onDishTouchEnd,
            onDishTouchMove
          )}
        </strong>
      );

      lastIndex = match.index + match[0].length;
      match = boldPattern.exec(line);
    }

    if (lastIndex < line.length) {
      chunks.push(
        ...renderTextWithDishLinks(
          line.slice(lastIndex),
          dishes,
          context,
          `t-${lineIndex}-${lastIndex}`,
          onDishTouchStart,
          onDishTouchEnd,
          onDishTouchMove
        )
      );
    }

    if (chunks.length === 0) {
      chunks.push(
        ...renderTextWithDishLinks(
          line,
          dishes,
          context,
          `e-${lineIndex}`,
          onDishTouchStart,
          onDishTouchEnd,
          onDishTouchMove
        )
      );
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
  if (
    restaurantMatch
    && !['table', 'dish'].includes(restaurantMatch[1].toLowerCase())
  ) {
    return {
      restaurant_slug: safeDecodePathSegment(restaurantMatch[1]),
    };
  }

  return {};
};

const normalizeStoredMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): ChatMessage | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Partial<ChatMessage>;
      if (
        typeof candidate.id !== 'string'
        || (candidate.role !== 'user' && candidate.role !== 'assistant')
        || typeof candidate.content !== 'string'
        || typeof candidate.createdAt !== 'string'
      ) {
        return null;
      }

      return {
        id: candidate.id,
        role: candidate.role,
        content: candidate.content,
        createdAt: candidate.createdAt,
      };
    })
    .filter((message): message is ChatMessage => message !== null);
};

const normalizeStoredPendingOrder = (value: unknown): PlaceOrderData | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<PlaceOrderData>;
  if (candidate.action !== 'place_order' || !Array.isArray(candidate.items)) {
    return null;
  }

  const items = candidate.items
    .map((item): ChatOrderItem | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const entry = item as Partial<ChatOrderItem>;
      if (typeof entry.name !== 'string' || typeof entry.quantity !== 'number') {
        return null;
      }

      const name = entry.name.trim();
      const quantity = Math.floor(entry.quantity);
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

const loadStoredChatState = (scopeKey: string): StoredChatState | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(`${CHAT_STATE_STORAGE_PREFIX}${scopeKey}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredChatState>;
    const conversationId = typeof parsed.conversationId === 'string' && parsed.conversationId.trim() !== ''
      ? parsed.conversationId
      : makeId();

    return {
      conversationId,
      messages: normalizeStoredMessages(parsed.messages),
      pendingOrder: normalizeStoredPendingOrder(parsed.pendingOrder),
    };
  } catch {
    return null;
  }
};

const persistChatState = (
  scopeKey: string,
  state: StoredChatState
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(
      `${CHAT_STATE_STORAGE_PREFIX}${scopeKey}`,
      JSON.stringify(state)
    );
  } catch {
    // ignore storage write failures
  }
};

const ChatBot: React.FC = () => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const { restaurant, draft } = useOrderCart();
  const isGuestMenuRoute = /^\/menu(?:\/|$)/i.test(location.pathname) || location.pathname === '/';
  const isRozerAiRoute = /^\/contact-us(?:\/|$)/i.test(location.pathname);
  const isHiddenRoute = /^\/admin\/login(?:\/|$)/i.test(location.pathname);

  if (isHiddenRoute) {
    return null;
  }
  const hasGuestSession = typeof draft.tableSessionId === 'number' && draft.tableSessionId > 0;
  const guestAccessExpiresAtMs = draft.guestAccessExpiresAt ? Date.parse(draft.guestAccessExpiresAt) : Number.NaN;
  const isGuestAccessExpired = Number.isFinite(guestAccessExpiresAtMs) && guestAccessExpiresAtMs <= Date.now();
  const hasValidGuestAccess = draft.guestAccessVerified && Boolean(draft.guestAccessToken) && !isGuestAccessExpired;
  const [isAiChatbotEnabled, setIsAiChatbotEnabled] = useState<boolean | null>(null);
  const shouldRenderChat = !isRozerAiRoute
    && (!isGuestMenuRoute || (hasGuestSession && hasValidGuestAccess))
    && (!isGuestMenuRoute || isAiChatbotEnabled === true);

  const chatContext = useMemo<ChatRestaurantContext>(() => {
    const fromPath = parsePathRestaurantContext(location.pathname);
    const isTableScoped = typeof fromPath.table_id === 'number' && Number.isFinite(fromPath.table_id);

    if (isTableScoped) {
      return {
        table_id: fromPath.table_id,
      };
    }

    return {
      restaurant_slug: fromPath.restaurant_slug ?? restaurant?.slug,
      table_id: fromPath.table_id,
    };
  }, [location.pathname, restaurant?.slug]);

  const conversationScopeKey = useMemo(() => {
    if (chatContext.table_id && Number.isFinite(chatContext.table_id) && chatContext.table_id > 0) {
      return `table:${chatContext.table_id}`;
    }

    const slug = (restaurant?.slug || chatContext.restaurant_slug || 'guest').trim() || 'guest';
    const sessionId = draft.tableSessionId;

    if (typeof sessionId === 'number' && sessionId > 0) {
      return `${slug}::session:${sessionId}`;
    }

    return `${slug}::no-session`;
  }, [restaurant?.slug, chatContext.restaurant_slug, draft.tableSessionId]);

  const initialStoredStateRef = useRef<StoredChatState | null | undefined>(undefined);
  if (initialStoredStateRef.current === undefined) {
    initialStoredStateRef.current = loadStoredChatState(conversationScopeKey);
  }

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => initialStoredStateRef.current?.messages ?? []
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);
  const [conversationId, setConversationId] = useState<string>(
    () => initialStoredStateRef.current?.conversationId ?? makeId()
  );
  const [pendingOrder, setPendingOrder] = useState<PlaceOrderData | null>(
    () => initialStoredStateRef.current?.pendingOrder ?? null
  );
  const [orderNotice, setOrderNotice] = useState<string | null>(null);
  const [chatCatalog, setChatCatalog] = useState<ChatRecommendationDish[]>([]);
  const [dishPreview, setDishPreview] = useState<ChatDishPreview | null>(null);
  const [animatingUserMessageId, setAnimatingUserMessageId] = useState<string | null>(null);
  const guestMenuResource = useGuestMenuResource({
    tableId: chatContext.table_id ?? null,
    restaurantSlug: chatContext.table_id ? null : chatContext.restaurant_slug ?? null,
    guestAccessToken: draft.guestAccessToken,
    language: i18n.resolvedLanguage,
    includeDishes: 'all',
    includeIndex: true,
  }, {
    enabled: isOpen && isGuestMenuRoute,
    ttlMs: 10_000,
  });
  const chatCatalogRef = useRef<ChatRecommendationDish[]>([]);
  const chatDetailRequestsRef = useRef<Map<number, Promise<ChatRecommendationDish[]>>>(new Map());
  const chatDishes = useMemo<ChatDishLink[]>(
    () => sortChatDishesByPriority(buildDishAliasLinks(chatCatalog)),
    [chatCatalog]
  );

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const latestUserBubbleRef = useRef<HTMLDivElement | null>(null);
  const chatRequestAbortRef = useRef<AbortController | null>(null);
  const orderRequestAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const swipePreviewActivatedRef = useRef(false);
  const swipeDishRef = useRef<ChatDishPreview | null>(null);

  const apiBase = useMemo(() => getApiBase(), []);
  const previousConversationScopeKeyRef = useRef(conversationScopeKey);
  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const openFromGuestActions = () => setIsOpen(true);
    window.addEventListener('guest-chatbot:open', openFromGuestActions);
    return () => {
      window.removeEventListener('guest-chatbot:open', openFromGuestActions);
    };
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      chatRequestAbortRef.current?.abort();
      orderRequestAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }, [messages, isLoading, pendingOrder, isConfirmingOrder, orderNotice]);

  useEffect(() => {
    if (previousConversationScopeKeyRef.current === conversationScopeKey) {
      return;
    }

    previousConversationScopeKeyRef.current = conversationScopeKey;
    chatRequestAbortRef.current?.abort();
    orderRequestAbortRef.current?.abort();
    const nextStoredState = loadStoredChatState(conversationScopeKey);
    setMessages(nextStoredState?.messages ?? []);
    setConversationId(nextStoredState?.conversationId ?? makeId());
    setPendingOrder(nextStoredState?.pendingOrder ?? null);
    setOrderNotice(null);
  }, [conversationScopeKey]);

  useEffect(() => {
    persistChatState(conversationScopeKey, {
      conversationId,
      messages,
      pendingOrder,
    });
  }, [conversationScopeKey, conversationId, messages, pendingOrder]);

  useEffect(() => {
    chatCatalogRef.current = chatCatalog;
  }, [chatCatalog]);

  const mergeChatCatalog = useCallback((incoming: ChatRecommendationDish[]) => {
    setChatCatalog((current) => mergeRecommendationDishes(current, incoming));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateDishes = async () => {
      const onGuestMenuRoute = /^\/menu(?:\/|$)/i.test(location.pathname) || location.pathname === '/';
      if (!onGuestMenuRoute) {
        setIsAiChatbotEnabled((current) => (current === true ? current : true));
        setChatCatalog((current) => (current.length === 0 ? current : []));
        return;
      }

      if (restaurant?.feature_flags && typeof restaurant.feature_flags.ai_chatbot === 'boolean') {
        setIsAiChatbotEnabled(restaurant.feature_flags.ai_chatbot);
      }

      try {
        const entry = guestMenuResource.data
          ? { data: guestMenuResource.data }
          : await guestMenuResource.ensure();
        const featureFlags = entry.data?.restaurant?.feature_flags;
        const fullDishes = entry.data?.dishes ?? [];
        const indexedDishes = entry.data?.dish_index ?? [];

        if (cancelled) {
          return;
        }

        setIsAiChatbotEnabled((current) => {
          if (featureFlags && typeof featureFlags.ai_chatbot === 'boolean') {
            return featureFlags.ai_chatbot;
          }
          return current === null ? true : current;
        });

        if (isOpen) {
          const nextCatalog = fullDishes.length > 0
            ? collectRecommendationDishesFromFullMenu(fullDishes)
            : sortRecommendationDishesByPriority(indexedDishes.map((dish) => toChatRecommendationDishFromIndex(dish)));
          setChatCatalog(nextCatalog);
        }
      } catch {
        if (!cancelled) {
          setIsAiChatbotEnabled(false);
          if (isOpen) {
            setChatCatalog((current) => (current.length === 0 ? current : []));
          }
        }
      }
    };

    void hydrateDishes();

    return () => {
      cancelled = true;
    };
  }, [
    guestMenuResource,
    guestMenuResource.data,
    isOpen,
    location.pathname,
    restaurant?.feature_flags,
  ]);

  const pushMessage = (role: Role, content: string): string => {
    const messageId = makeId();
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        role,
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
    return messageId;
  };

  const waitForNextFrame = (): Promise<void> => (
    new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
  );

  const animateOutgoingUserMessage = async (
    rawText: string,
    messageId: string
  ): Promise<void> => {
    const inputEl = inputRef.current;
    const messagesEl = messagesContainerRef.current;

    if (!inputEl || !messagesEl) {
      setAnimatingUserMessageId(null);
      return;
    }

    const typedText = rawText;
    setAnimatingUserMessageId(messageId);

    const inputRect = inputEl.getBoundingClientRect();
    const clone = document.createElement('div');
    clone.textContent = typedText;
    clone.style.position = 'fixed';
    clone.style.zIndex = '9999';
    clone.style.pointerEvents = 'none';
    clone.style.left = `${inputRect.left}px`;
    clone.style.top = `${inputRect.top}px`;
    clone.style.width = `${inputRect.width}px`;
    clone.style.minHeight = `${inputRect.height}px`;
    clone.style.padding = '8px 12px';
    clone.style.borderRadius = '16px';
    clone.style.borderBottomRightRadius = '6px';
    clone.style.background = 'rgb(15 23 42)';
    clone.style.color = 'white';
    clone.style.fontSize = '14px';
    clone.style.lineHeight = '1.6';
    clone.style.whiteSpace = 'pre-wrap';
    clone.style.wordBreak = 'break-word';
    clone.style.boxShadow = '0 2px 10px rgba(15,23,42,0.22)';
    clone.style.transform = 'translate3d(0,0,0) scale(1)';
    document.body.appendChild(clone);

    await waitForNextFrame();
    await waitForNextFrame();

    messagesEl.scrollTop = messagesEl.scrollHeight;
    await waitForNextFrame();
    await waitForNextFrame();

    const targetBubble = latestUserBubbleRef.current;
    if (!targetBubble) {
      clone.remove();
      setAnimatingUserMessageId(null);
      return;
    }

    const targetRect = targetBubble.getBoundingClientRect();
    const durationMs = 550;
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

    clone.style.transition = [
      `top ${durationMs}ms ${easing}`,
      `left ${durationMs}ms ${easing}`,
      `width ${durationMs}ms ${easing}`,
      `min-height ${durationMs}ms ${easing}`,
      `transform ${durationMs}ms ${easing}`,
    ].join(', ');

    void clone.offsetHeight;
    clone.style.top = `${targetRect.top}px`;
    clone.style.left = `${targetRect.left}px`;
    clone.style.width = `${targetRect.width}px`;
    clone.style.minHeight = `${targetRect.height}px`;
    clone.style.transform = 'translate3d(0,0,0) scale(0.992)';

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      const timeoutId = window.setTimeout(done, durationMs + 120);
      clone.addEventListener('transitionend', () => {
        window.clearTimeout(timeoutId);
        done();
      }, { once: true });
    });

    clone.remove();
    setAnimatingUserMessageId(null);

    const finalBubble = latestUserBubbleRef.current;
    if (finalBubble) {
      finalBubble.animate(
        [
          { transform: 'scale(0.985)' },
          { transform: 'scale(1.012)' },
          { transform: 'scale(1)' },
        ],
        {
          duration: 180,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }
      );
    }
  };

  const closeDishPreview = () => setDishPreview(null);

  const resetSwipeState = () => {
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    swipeDishRef.current = null;
  };

  const handleDishTouchStart = (
    dish: ChatDishLink,
    href: string,
    event: React.TouchEvent<HTMLAnchorElement>
  ) => {
    const touch = event.touches[0];
    swipeStartXRef.current = touch?.clientX ?? null;
    swipeStartYRef.current = touch?.clientY ?? null;
    swipePreviewActivatedRef.current = false;
    swipeDishRef.current = {
      name: dish.name,
      href,
      imageUrl: dish.imageUrl,
    };

    event.currentTarget.addEventListener(
      'click',
      (clickEvent) => {
        if (swipePreviewActivatedRef.current) {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
          swipePreviewActivatedRef.current = false;
        }
      },
      { once: true }
    );

  };

  const handleDishTouchEnd = (event: React.TouchEvent<HTMLAnchorElement>) => {
    resetSwipeState();
    if (swipePreviewActivatedRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleDishTouchMove = (event: React.TouchEvent<HTMLAnchorElement>) => {
    const startX = swipeStartXRef.current;
    const startY = swipeStartYRef.current;
    const touch = event.touches[0];
    if (startX === null || startY === null || !touch || swipePreviewActivatedRef.current) {
      return;
    }

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Trigger preview on intentional horizontal swipe only.
    if (absX >= 42 && absX > absY * 1.4) {
      const preview = swipeDishRef.current;
      if (preview) {
        setDishPreview((current) => current ?? preview);
      }
      swipePreviewActivatedRef.current = true;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(16);
      }
      event.preventDefault();
      event.stopPropagation();
      resetSwipeState();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setConversationId(makeId());
    setPendingOrder(null);
    setOrderNotice(null);
  };

  const fetchChatDishDetail = useCallback(async (dishId: number): Promise<Dish | null> => {
    if (chatContext.table_id) {
      const response = await fetchGuestTableDish(chatContext.table_id, dishId, draft.guestAccessToken);
      return response.dish;
    }

    const candidateSlugs = getGuestRestaurantCandidateSlugs(chatContext.restaurant_slug);
    for (const candidateSlug of candidateSlugs) {
      try {
        const response = await api.get<{ dish?: Dish } | Dish>(`/menu/${candidateSlug}/dish/${dishId}`, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        });
        const payload = response.data;
        if (payload && typeof payload === 'object' && 'dish' in payload && payload.dish) {
          return payload.dish;
        }
        return payload as Dish;
      } catch (error) {
        if (candidateSlug === candidateSlugs[candidateSlugs.length - 1]) {
          throw error;
        }
      }
    }

    const fallbackResponse = await api.get<{ dish?: Dish } | Dish>(`/menu/dish/${dishId}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });
    const fallbackPayload = fallbackResponse.data;
    if (fallbackPayload && typeof fallbackPayload === 'object' && 'dish' in fallbackPayload && fallbackPayload.dish) {
      return fallbackPayload.dish;
    }

    return fallbackPayload as Dish;
  }, [chatContext.restaurant_slug, chatContext.table_id, draft.guestAccessToken]);

  const ensureDetailedChatDish = useCallback(async (dishId: number): Promise<ChatRecommendationDish[]> => {
    const existing = chatCatalogRef.current.find((dish) => dish.id === dishId) ?? null;
    if (existing?.relationsLoaded) {
      return [existing];
    }

    const pending = chatDetailRequestsRef.current.get(dishId);
    if (pending) {
      return pending;
    }

    const request = (async () => {
      const detailDish = await fetchChatDishDetail(dishId);
      if (!detailDish) {
        return [];
      }

      const nextCatalog = collectRecommendationDishesFromFullMenu([
        detailDish,
        ...(detailDish.suggested_dishes || []),
        ...(detailDish.related_dishes || []),
      ]);
      mergeChatCatalog(nextCatalog);
      return nextCatalog;
    })();

    chatDetailRequestsRef.current.set(dishId, request);

    try {
      return await request;
    } finally {
      chatDetailRequestsRef.current.delete(dishId);
    }
  }, [fetchChatDishDetail, mergeChatCatalog]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || isLoading || isConfirmingOrder) return;

    setOrderNotice(null);
    const typedText = input;
    const pushedUserMessageId = pushMessage('user', content);
    setInput('');
    void animateOutgoingUserMessage(typedText, pushedUserMessageId);
    setIsLoading(true);
    let timeoutId: number | null = null;

    try {
      const matchedDish = findMentionedDish(content, chatCatalogRef.current);
      const shouldFetchDetailedDish = Boolean(
        matchedDish
        && isDirectDishIntent(content)
        && matchedDish.relationsLoaded !== true
      );
      const detailedCatalogPromise = shouldFetchDetailedDish && matchedDish
        ? ensureDetailedChatDish(matchedDish.id)
        : Promise.resolve<ChatRecommendationDish[]>([]);

      chatRequestAbortRef.current?.abort();
      const controller = new AbortController();
      chatRequestAbortRef.current = controller;
      timeoutId = window.setTimeout(() => controller.abort(), 20000);

      const chatResponsePromise = fetch(`${apiBase}/chat`, {
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
      const [response, detailedCatalog] = await Promise.all([chatResponsePromise, detailedCatalogPromise]);
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
      const recommendationCatalog = detailedCatalog.length > 0
        ? mergeRecommendationDishes(chatCatalogRef.current, detailedCatalog)
        : chatCatalogRef.current;
      const detailedDish = matchedDish
        ? detailedCatalog.find((dish) => dish.id === matchedDish.id) ?? null
        : null;
      const recommendation = resolveChatRecommendation(content, recommendationCatalog, { detailedDish });
      const suggestionPool = recommendation.dishes
        .map((dish) => ({
          id: dish.id,
          name: dish.name,
          normalized: normalizeDishName(dish.name),
          imageUrl: dish.imageUrl,
          isProfitable: dish.isProfitable,
          isOrderable: dish.isOrderable,
          isOutOfStock: dish.isOutOfStock,
          category: dish.category,
          categoryAr: dish.categoryAr ?? undefined,
        }));
      const primarySuggestedDish = suggestionPool[0] ?? null;
      const profitableSuggestionMessage = buildProfitableSuggestionMessage(recommendation, suggestionPool);
      const replyExplicitlyRecommendsPrimarySuggestion = reply
        ? responseExplicitlyRecommendsDishName(reply, primarySuggestedDish?.name)
        : false;

      if (reply) {
        pushMessage('assistant', reply);
      } else if (!nextPendingOrder) {
        pushMessage('assistant', 'Sorry, I could not generate a response.');
      }

      if (
        recommendation.type !== 'none'
        && profitableSuggestionMessage
        && !replyExplicitlyRecommendsPrimarySuggestion
      ) {
        pushMessage('assistant', profitableSuggestionMessage);
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
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      chatRequestAbortRef.current = null;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const confirmPendingOrder = async () => {
    if (!pendingOrder || isConfirmingOrder || isLoading) return;

    setOrderNotice(null);
    setIsConfirmingOrder(true);
    let timeoutId: number | null = null;

    try {
      orderRequestAbortRef.current?.abort();
      const controller = new AbortController();
      orderRequestAbortRef.current = controller;
      timeoutId = window.setTimeout(() => controller.abort(), 15000);

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
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      orderRequestAbortRef.current = null;
      if (isMountedRef.current) {
        setIsConfirmingOrder(false);
      }
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  if (!shouldRenderChat) {
    return null;
  }

  return (
    <div
      className="fixed bottom-24 right-4 z-[1000] print:hidden sm:bottom-6 sm:right-6"
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
            ref={messagesContainerRef}
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
                  ref={msg.role === 'user' && msg.id === animatingUserMessageId ? latestUserBubbleRef : null}
                  className={[
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm',
                    msg.role === 'user'
                      ? 'rounded-br-md bg-slate-900 text-white'
                      : 'rounded-bl-md border border-slate-200 bg-white text-slate-800',
                  ].join(' ')}
                  style={msg.role === 'user' && msg.id === animatingUserMessageId ? { visibility: 'hidden' } : undefined}
                >
                  {renderChatText(
                    msg.content,
                    msg.role === 'assistant' ? chatDishes : [],
                    chatContext,
                    handleDishTouchStart,
                    handleDishTouchEnd,
                    handleDishTouchMove
                  )}
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
                <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                  <span className="sr-only">Thinking</span>
                  <span
                    className="inline-block h-2 w-2 animate-bounce rounded-full bg-slate-500"
                    style={{ animationDelay: '0ms', animationDuration: '900ms' }}
                  />
                  <span
                    className="inline-block h-2 w-2 animate-bounce rounded-full bg-slate-500"
                    style={{ animationDelay: '150ms', animationDuration: '900ms' }}
                  />
                  <span
                    className="inline-block h-2 w-2 animate-bounce rounded-full bg-slate-500"
                    style={{ animationDelay: '300ms', animationDuration: '900ms' }}
                  />
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
      ) : isGuestMenuRoute ? null : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl transition hover:scale-105 hover:bg-black"
          aria-label="Open chat"
        >
          <span className="text-xl">💬</span>
        </button>
      )}

      {dishPreview && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[2147483647] overflow-y-auto bg-slate-900/60 p-4 print:hidden">
          <div className="flex min-h-full items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close preview"
            className="absolute inset-0 cursor-default"
            onClick={closeDishPreview}
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
            {dishPreview.imageUrl ? (
              <img
                src={dishPreview.imageUrl}
                alt={dishPreview.name}
                className="h-56 w-full object-cover"
              />
            ) : (
              <div className="flex h-56 w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-medium text-slate-500">
                No image available
              </div>
            )}
            <div className="space-y-3 p-4">
              <p className="text-base font-semibold text-slate-900">{dishPreview.name}</p>
              <a
                href={dishPreview.href}
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
              >
                Open dish details
              </a>
            </div>
          </div>
          </div>
        </div>
      , document.body) : null}
    </div>
  );
};

export default ChatBot;
