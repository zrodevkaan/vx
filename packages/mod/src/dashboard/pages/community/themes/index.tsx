import { createContext, useContext, useMemo, useState } from "react";
import { Panel } from "../../..";
import { Button, Flex, Icons, Popout, SearchBar, Spinner, Tooltip } from "../../../../components";
import { Messages } from "vx:i18n";
import { className, InternalStore } from "../../../../util";
import { NO_RESULTS, NO_RESULTS_ALT, NoAddons, queryStore } from "../../addons/shared";
import { useInternalStore } from "../../../../hooks";
import { openInviteModal } from "../../../../api/modals";
import { closeMenu, MenuComponents, MenuRenderProps, openMenu } from "../../../../api/menu";
import { addons } from "../../../../native";
import { themeStore } from "../../../../addons/themes";
import { openNotification } from "../../../../api/notifications";
import { LayerManager, NavigationUtils } from "@webpack/common";

const BETTERDISCORD_API_VERSION = 1;
const BETTERDISCORD_API = `https://api.betterdiscord.app/v${BETTERDISCORD_API_VERSION}`;
const BETTERDISCORD_API_THEMES = `${BETTERDISCORD_API}/store/themes`;

const themeCommunityStore = new class ThemeCommunityStore extends InternalStore {
  constructor() {
    super();

  }

  #ok = false;
  #loading = true;
  #initialized = false;
  #addons: Addon[] | null = null;

  async initialize() {
    if (this.#initialized) return;
    this.#initialized = true;

    const { ok, json } = await request.json<BetterDiscord.Addon[]>(BETTERDISCORD_API_THEMES, {
      cache: "reload"
    });

    if (!ok) {
      this.#ok = false;
      this.#loading = false;
      this.emit();
      return;
    }
    
    this.#ok = true;
    this.#loading = false;
    this.#addons = json.map((addon) => new Addon(addon));
    this.emit();
  }

  getAddons() {
    return this.#addons || [];
  }
  getAddon(id: number) {
    for (const element of this.#addons!) {
      if (element.id === id) return element;
    }
    return null;
  }
  
  getState() {
    this.initialize();

    return {
      addons: this.getAddons(),
      isLoading: this.#loading,
      ok: this.#ok
    };
  }
}

class Addon {
  constructor(addon: BetterDiscord.Addon) {
    this.name = addon.name;
    this.filename = addon.latest_source_url.split("/").at(-1)!;
    this.description = addon.description;
    this.tags = addon.tags;
    this.likes = addon.likes;
    this.downloads = addon.downloads;

    this.guild = addon.guild || addon.author.guild || null;

    this.id = addon.id;
    this.author = addon.author.display_name;

    this.#addon = addon;
  }

  #addon: BetterDiscord.Addon;

  public readonly id: number;
  public readonly name: string;
  public readonly filename: string;
  public readonly description: string;
  public readonly tags: string[];
  public readonly likes: number;
  public readonly downloads: number;
  public readonly author: string;

  public readonly guild: BetterDiscord.Guild | null;

  public getSplashImage() {
    return `https://betterdiscord.app${this.#addon.thumbnail_url}`;
  }
  public getAuthorImage() {
    return `https://avatars.githubusercontent.com/u/${this.#addon.author.github_id}?v=4`;

    const gitHubPattern = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/;
    const match = this.#addon.latest_source_url.match(gitHubPattern);
    
    return `https://github.com/${match![1]}.png`;
  }
  public openPreview() {
    const gitHubPattern = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/;
    const match = this.#addon.latest_source_url.match(gitHubPattern);
  
    if (!match) {
      throw new Error("Invalid GitHub URL");
    }
  
    const [, user, repo, commit, filePath ] = match;

    const jsDelivrUrl = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${commit}/${filePath}`;
    
    const discordPreviewUrl = `https://discord-preview.vercel.app/?file=${encodeURIComponent(jsDelivrUrl)}`;

    window.open(discordPreviewUrl, "_blank");
  }
  public openSource() {
    window.open(this.#addon.latest_source_url, "_blank");
  }
  public async download() {
    const gitHubPattern = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/;
    const match = this.#addon.latest_source_url.match(gitHubPattern);
  
    if (!match) {
      throw new Error("Invalid GitHub URL");
    }
  
    const [, user, repo, commit, filepath ] = match;
    const url = `https://raw.githubusercontent.com/${user}/${repo}/${commit}/${filepath}`;

    const { text, ok } = await request.text(url);
    if (!ok) throw new Error("Request was not ok");

    addons.themes.setEnabledState(this.filename, true);
    addons.themes.write(this.filename, text);
  }
  public openInBrowser() {
    window.open(`https://betterdiscord.app/theme?id=${this.id}`, "_blank");
  }
  public openAuthorPage() {
    window.open(`https://betterdiscord.app/developer/${encodeURIComponent(this.#addon.author.display_name)}`, "_blank")
  }
  public async openInviteModal() {
    if (!this.guild) return false;

    const joined = await openInviteModal(this.guild!.invite_link.replace("https://discord.gg/", ""));
    if (!joined) return false;

    NavigationUtils.transitionToGuild(this.guild!.snowflake);
    LayerManager.pop();
  }
}

const tagsContext = createContext<[ tags: string[], setTags: (tags: string[]) => void ]>([ [], () => {} ]);

function CommunityAddonMenu({ addon, props }: { addon: Addon, props: MenuRenderProps }) {
  return (
    <MenuComponents.Menu navId="vx-community-card-menu" onClose={closeMenu} {...props}>
      <MenuComponents.MenuGroup label={addon.name}>
        <MenuComponents.MenuItem 
          id="source"
          label={Messages.GO_TO_SOURCE}
          action={() => addon.openSource()}
          icon={Icons.Github}
        />
        <MenuComponents.MenuItem 
          id="preview"
          label={Messages.PREVIEW}
          action={() => addon.openPreview()}
          icon={(props) => <Icons.DiscordIcon name="Eye" {...props} />}
        />
        {addon.guild && (
          <MenuComponents.MenuItem 
            id="support"
            label={Messages.JOIN_SUPPORT_SERVER}
            icon={Icons.Help}
            action={() => addon.openInviteModal()}
          />
        )}
        <MenuComponents.MenuItem 
          id="site"
          label="View in Browser"
          icon={Icons.Globe}
          action={() => addon.openInBrowser()}
        />
      </MenuComponents.MenuGroup>
    </MenuComponents.Menu>
  )
}

function CommunityAddonCard({ addon }: { addon: Addon }) {
  const [ tags, setTags ] = useContext(tagsContext);
  const hasTheme = useInternalStore(themeStore, () => themeStore.keys().includes(addon.filename));
  
  const [ downloadState, setDownloadState ] = useState(0);

  const isDisabled = useMemo(() => hasTheme || downloadState !== 0, [ downloadState, hasTheme ]);

  return (
    <div className="vx-community-card" onContextMenu={(event) => openMenu(event, (props) => <CommunityAddonMenu props={props} addon={addon} />)}>
      <div className="vx-community-card-splash">
        <div className="vx-community-card-preview">
          <img src={addon.getSplashImage()} className="vx-community-card-preview-img" loading="lazy" />
        </div>
        <Tooltip text={addon.author}>
          {(props) => (
            <div className="vx-community-card-author" {...props} onClick={() => addon.openAuthorPage()}>
              <svg width="48" height="48" className="vx-community-card-author-svg" viewBox="0 0 48 48">
                <foreignObject x="0" y="0" width="48" height="48" overflow="visible" mask="url(#svg-mask-squircle)">
                  <div className="vx-community-card-author-mask">
                    <svg width="40" height="40" className="vx-community-card-author-svg" viewBox="0 0 40 40">
                      <foreignObject x="0" y="0" width="40" height="40" overflow="visible" mask="url(#svg-mask-squircle)">
                        <img src={addon.getAuthorImage()} alt="" className="vx-community-card-author-img" loading="lazy" />
                      </foreignObject>
                    </svg>
                  </div>
                </foreignObject>
              </svg>
            </div>
          )}
        </Tooltip>
      </div>
      <div className="vx-community-card-body">
        <div className="vx-community-card-name">{addon.name}</div>
        <div className="vx-community-card-description">
          {addon.description}
        </div>
        <div className="vx-community-card-tags">
          {addon.tags.map((tag) => (
            <span 
              key={tag} 
              className={className([ "vx-community-card-tag", tags.includes(tag) && "vx-community-card-tag-selected" ])}
              onClick={() => {
                const index = tags.indexOf(tag);

                if (index === -1) {
                  setTags([ ...tags, tag ]);
                  return;
                }
                
                const newTags = tags.concat();
                newTags.splice(index, 1);
                setTags(newTags);
              }}
            >{tag}</span>
          ))}
        </div>
        <div className="vx-community-card-info">
          <div className="vx-community-card-info-left">
            <div className="vx-community-card-info-likes">
              <div className="vx-community-card-info-dot"></div>
              <div>{Messages.CONNECTIONS_PROFILE_TIKTOK_LIKES.format({ value: addon.likes })}</div>
            </div>
            <div className="vx-community-card-info-downloads">
              <div className="vx-community-card-info-dot"></div>
              <div>{addon.downloads} Downloads</div>
            </div>
          </div>
          <div className="vx-community-card-info-right">
            {addon.guild && (
                <Tooltip text={Messages.JOIN_SUPPORT_SERVER}>
                  {(props) => (
                    <Button 
                      size={Button.Sizes.ICON} 
                      look={Button.Looks.BLANK} 
                      className="vx-community-card-button"
                      {...props}
                      onClick={() => {
                        props.onClick();
                        addon.openInviteModal();
                      }}
                    >
                      <Icons.Help />
                      {/* <img width={24} height={24} src={`https://cdn.discordapp.com/icons/${(addon.guild || addon.author.guild)!.snowflake}/${(addon.guild || addon.author.guild)!.avatar_hash}.webp`} /> */}
                    </Button>
                )}
              </Tooltip>
            )}
            <Tooltip text={Messages.PREVIEW}>
              {(props) => (
                <Button 
                  size={Button.Sizes.ICON} 
                  look={Button.Looks.BLANK} 
                  className="vx-community-card-button" 
                  {...props}
                  onClick={() => {
                    props.onClick();
                    addon.openPreview();
                  }}
                >
                  <Icons.DiscordIcon name="EyeIcon" />
                </Button>
              )}
            </Tooltip>
            <Tooltip text={Messages.GO_TO_SOURCE}>
              {(props) => (
                <Button 
                  size={Button.Sizes.ICON} 
                  look={Button.Looks.BLANK} 
                  className="vx-community-card-button" 
                  {...props}
                  onClick={() => {
                    props.onClick();
                    addon.openSource();
                  }}
                >
                  <Icons.Github />
                </Button>
              )}
            </Tooltip>
            <Button
              size={Button.Sizes.ICON} 
              disabled={isDisabled} 
              onClick={async () => {
                setDownloadState(1);
                try {
                  await addon.download();
                } catch (error) {
                  openNotification({
                    title: "Unable to download theme",
                    description: String(error),
                    type: "danger",
                    icon: Icons.Warn
                  });
                }
              }}
            >
              <Icons.Download />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const enum SortingMethod {
  NAME, LIKES, DOWNLOADS, POPULARITY
}

const ALL_TAGS = [
  "flat",
	"transparent",
	"layout",
	"customizable",
	"fiction",
	"nature",
	"space",
	"dark",
	"light",
	"game",
	"anime",
	"red",
	"orange",
	"green",
	"purple",
	"black",
	"other",
	"high-contrast",
	"white",
	"aqua",
	"animated",
	"yellow",
	"blue",
	"abstract"
]

export function CommunityThemes() {
  const { isLoading, ok, addons } = useInternalStore(themeCommunityStore, () => themeCommunityStore.getState());

  const [ query, setQuery ] = useState(() => queryStore.get("community-themes"));

  const [ tags, setTags ] = useState<string[]>([ ]);

  const [ sorting, setSort ] = useState(SortingMethod.POPULARITY);
  const [ sortingReversed, setSortingReversed ] = useState(false);
  const [ showingSortMenu, isShowingSortMenu ] = useState(false);

  const [ showingTags, isShowingTags ] = useState(false);

  const alt = useMemo(() => !Math.floor(Math.random() * 100), [ query ]);

  const filteredAddons = useMemo(() => {
    const filtered: Addon[] = [];

    for (const addon of addons) {
      if (tags.length && query.length) {
        if (!addon.name.toLowerCase().includes(query.toLowerCase())) continue;
        if (!tags.every((tag) => addon.tags.includes(tag))) continue;
        filtered.push(addon);
        
        continue;
      }
      if (tags.length) {
        if (!tags.every((tag) => addon.tags.includes(tag))) continue;
        filtered.push(addon);

        continue;
      }
      if (query.length) {
        if (!addon.name.toLowerCase().includes(query.toLowerCase())) continue;
        filtered.push(addon);
        
        continue;
      }

      filtered.push(addon);
    }

    const arr = filtered.sort((a, b) => {
      switch (sorting) {
        case SortingMethod.POPULARITY: {
          const scoreA = a.downloads * 0.7 + a.likes * 0.3;
          const scoreB = b.downloads * 0.7 + b.likes * 0.3;
      
          if (sortingReversed) return scoreA - scoreB;
          return scoreB - scoreA;
        }
        case SortingMethod.NAME:
          if (sortingReversed) return b.name.localeCompare(a.name);
          return a.name.localeCompare(b.name);
        case SortingMethod.DOWNLOADS:
          if (sortingReversed) return a.downloads - b.downloads;
          return b.downloads - a.downloads;
        case SortingMethod.LIKES:
          if (sortingReversed) return a.likes - b.likes; 
          return b.likes - a.likes;
      }
    });

    return arr;
  }, [ addons, tags, query , sorting, sortingReversed ]);

  const [ tagQuery, setTagQuery ] = useState("");

  const filteredTags = useMemo(() => {
    return ALL_TAGS.filter((tag) => tag.includes(tagQuery.toLowerCase()));
  }, [ tagQuery ]);

  return (
    <Panel
      title={Messages.THEMES}
      buttons={
        <>
          <Popout 
            shouldShow={showingSortMenu}
            onRequestClose={() => isShowingSortMenu(false)} 
            position="left"
            renderPopout={(props) => (
              <MenuComponents.Menu navId="vx-community-sort-menu" onClose={() => isShowingSortMenu(false)}>
                <MenuComponents.MenuGroup label={Messages.SELECT_SORT_MODE}>
                  <MenuComponents.MenuCheckboxItem 
                    label={Messages.MOST_POPULAR} 
                    id="popularity" 
                    checked={sorting === SortingMethod.POPULARITY}
                    action={() => setSort(SortingMethod.POPULARITY)}
                  />
                  <MenuComponents.MenuCheckboxItem 
                    label="Downloads" 
                    id="downloads" 
                    checked={sorting === SortingMethod.DOWNLOADS}
                    action={() => setSort(SortingMethod.DOWNLOADS)}
                  />
                  <MenuComponents.MenuCheckboxItem 
                    label={Messages.CONNECTIONS_TIKTOK_LIKES} 
                    id="likes" 
                    checked={sorting === SortingMethod.LIKES}
                    action={() => setSort(SortingMethod.LIKES)}
                  />
                  <MenuComponents.MenuCheckboxItem 
                    label={Messages.GUILD_SETTINGS_EMOJI_NAME} 
                    id="name" 
                    checked={sorting === SortingMethod.NAME}
                    action={() => setSort(SortingMethod.NAME)}
                  />
                </MenuComponents.MenuGroup>
                <MenuComponents.MenuGroup>
                  <MenuComponents.MenuCheckboxItem 
                    label={Messages.REVERSED} 
                    id="reverse" 
                    checked={sortingReversed} 
                    action={() => setSortingReversed(v => !v)}
                  />
                </MenuComponents.MenuGroup>
              </MenuComponents.Menu>
            )}
          >
            {(props) => (
              <Tooltip text={Messages.FORUM_CHANNEL_SORT_BY}>
                {(ttProps) => (
                  <Button
                    {...props}
                    {...ttProps}
                    size={Button.Sizes.NONE}
                    look={Button.Looks.BLANK} 
                    className="vx-header-button"
                    onClick={(event) => {
                      props.onClick(event);
                      ttProps.onClick();
                      isShowingSortMenu(!showingSortMenu);
                    }}
                  >
                    <Icons.DiscordIcon name="ListNumberedIcon" />
                  </Button>
                )}
              </Tooltip>
            )}
          </Popout>
          <Popout 
            shouldShow={showingTags}
            onRequestClose={() => isShowingTags(false)} 
            position="left"
            renderPopout={(props) => (
              <MenuComponents.Menu navId="vx-community-tags-menu" onClose={() => isShowingTags(false)}>
                <MenuComponents.MenuControlItem 
                  id="tag-query"
                  control={(props, ref) => (
                    <MenuComponents.MenuSearchControl {...props} ref={ref} onChange={(value) => setTagQuery(value)} query={tagQuery} />
                  )}
                />
                {filteredTags.map((tag) => (
                  <MenuComponents.MenuCheckboxItem 
                    label={tag[0].toUpperCase() + tag.slice(1)} id={tag}
                    checked={tags.includes(tag)}
                    action={() => {
                      const index = tags.indexOf(tag);
      
                      if (index === -1) {
                        setTags([ ...tags, tag ]);
                        return;
                      }
                      
                      const newTags = tags.concat();
                      newTags.splice(index, 1);
                      setTags(newTags);
                    }}
                  />
                ))}
              </MenuComponents.Menu>
            )}
          >
            {(props) => (
              <Tooltip text={Messages.TAGS}>
                {(ttProps) => (
                  <Button
                    {...props}
                    {...ttProps}
                    size={Button.Sizes.NONE}
                    look={Button.Looks.BLANK} 
                    className="vx-header-button"
                    onClick={(event) => {
                      props.onClick(event);
                      ttProps.onClick();
                      isShowingTags(!showingTags);
                    }}
                  >
                    <Icons.DiscordIcon name="TagsIcon" className={className([ "vx-community-addons-tags-icon", tags.length !== 0 && "vx-community-addons-tags-notice" ])} />
                  </Button>
                )}
              </Tooltip>
            )}
          </Popout>
          <SearchBar 
            query={query}
            size={SearchBar.Sizes.SMALL}
            onQueryChange={(query) => {
              setQuery(query);
            }}
            onClear={() => {
              setQuery("");
            }}
            autoFocus
          />
        </>
      }
    >
      {isLoading ? (
        <div className="vx-community-loading">
          <Spinner />
        </div>
      ) : ok ? (
        <>
          {filteredAddons.length ? (
            <tagsContext.Provider value={[ tags, setTags ]}>
              <Flex gap={20} direction={Flex.Direction.VERTICAL}>
                {filteredAddons.map((addon) => (
                  <Flex.Child key={addon.id}>
                    <CommunityAddonCard addon={addon} />
                  </Flex.Child>
                ))}
              </Flex>
            </tagsContext.Provider>
          ) : (
            <NoAddons message={Messages.NO_RESULTS_FOUND} img={alt ? NO_RESULTS_ALT : NO_RESULTS} />
          )}
        </>
      ) : (
        <div>
          Error fetching api, please try again later
        </div>
      )}
    </Panel>
  )
}