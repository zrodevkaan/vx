import { FluxStore } from "discord-types/stores";
import { FluxDispatcher as FluxDispatcherType } from "discord-types/other";
import { byStrings, getProxyByKeys, getProxyByStrings } from "./filters"
import { getProxyStore } from "./stores";
import { getMangledProxy, getProxy } from "./util";
import { getModule } from "./searching";
import { DispatchEvent } from "discord-types/other/FluxDispatcher";
import { Channel, User } from "discord-types/general";

export const React = getProxyByKeys<typeof import("react")>([ "createElement", "memo" ]);
export const ReactDOM = getProxyByKeys<typeof import("react-dom")>([ "render", "hydrate", "hydrateRoot" ]);
export const ReactSpring = getProxyByKeys<any>([ "config", "to", "a", "useSpring" ]);
export const UserStore = getProxyStore("UserStore");
export const ChannelStore = getProxyStore("ChannelStore");
export const SelectedChannelStore = getProxyStore("SelectedChannelStore");
export const GuildStore = getProxyStore("GuildStore");
export const SelectedGuildStore = getProxyStore("SelectedGuildStore");

type useStateFromStores = <T>(stores: FluxStore[], effect: () => T) => T;
export const useStateFromStores = getProxyByStrings<useStateFromStores>([ "useStateFromStores" ]);

export const FluxDispatcher = getProxyByKeys<FluxDispatcherType>([ "subscribe", "dispatch" ]);

interface NavigationUtil {
  transitionTo(path: string): void,

  // DM
  transtionToGuild(guildId: null, channelId: string, messageId?: string): void,
  // Guild
  transtionToGuild(guildId: string, channelId?: string, messageId?: string): void,
  // Guild Thread
  transtionToGuild(guildId: string | null, channelId: string, threadId: string, messageId?: string): void,

  replace(path: string): void,

  goBack(): void,
  goForward(): void
};

export const NavigationUtils = getMangledProxy<NavigationUtil>("transitionTo - Transitioning to", {
  transitionTo: byStrings("\"transitionTo - Transitioning to \""),
  replace: byStrings("\"Replacing route with \""),
  goBack: byStrings(".goBack()"),
  goForward: byStrings(".goForward()"),
  transtionToGuild: byStrings("\"transitionToGuild - Transitioning to \"")
});

export function dirtyDispatch(event: DispatchEvent) {
  return new Promise<void>((resolve) => {
    FluxDispatcher.wait(() => {
      resolve(FluxDispatcher.dispatch(event));
    });
  });
};

interface i18n {
  Messages: Record<Capitalize<string>, string>,
  getLocale(): string
};
export const I18n = getProxy<i18n>(m => m.Messages && Array.isArray(m._events.locale));

// ComponentDispatch can be easily called before its loaded so this is a just incase
export const insertText = (() => {
  let ComponentDispatch: any;
  
  return (content: string) => {
    if (!ComponentDispatch) ComponentDispatch = getModule(m => m.dispatchToLastSubscribed && m.emitter?.listeners?.('INSERT_TEXT')?.length, { searchExports: true });
    
    ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", {
      plainText: content
    });
  };
})();

export const LayerManager = {
  pushLayer(component: () => React.ReactNode) {
    dirtyDispatch({
      type: "LAYER_PUSH",
      component
    });
  },
  popLayer() {
    dirtyDispatch({
      type: "LAYER_POP"
    });
  },
  popAllLayers() {
    dirtyDispatch({
      type: "LAYER_POP_ALL"
    });
  }
};

const cachedUserFetches = new Map<string, Promise<User>>();
const fetchUserModule = getProxyByStrings<(uid: string) => Promise<User>>([ "USER_UPDATE", "getUser", "USER(" ], { searchExports: true });
export function fetchUser(userId: string): Promise<User> {
  if (cachedUserFetches.has(userId)) return cachedUserFetches.get(userId)!;

  const request = fetchUserModule(userId);
  request.catch(() => {
    // To attempt the fetch again later
    cachedUserFetches.delete(userId);
  });

  cachedUserFetches.set(userId, request);

  return request;
};

export const WindowUtil = getMangledProxy<{
  open: (opts: { href: string }) => void,
  isTrusted: (url: string, idk: unknown) => boolean
}>(".Messages.MALFORMED_LINK_BODY", {
  open: byStrings(".apply"),
  isTrusted: byStrings(".getChannelId()")
});

const openUserContextMenuModule = getProxyByStrings<(event: React.MouseEvent, user: User, channel: Channel) => void>([ ".isGroupDM()?", ".isDM()?", "targetIsUser:", ",Promise.all(" ], { searchExports: true });
export const openUserContextMenu = (event: React.MouseEvent, user: User) => {
  const dummyChannel = {
    isGroupDM() { return false; },
    isDM() { return false; },
    guild_id: null
  } as unknown as Channel;
  
  openUserContextMenuModule(event, user, dummyChannel);
};