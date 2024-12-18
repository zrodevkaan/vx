import {MenuComponents, openMenu} from "../menu";
import {closeAllModals} from "../modals";
import {addPlainTextPatch, getProxy} from "@webpack";

addPlainTextPatch({
    match: "Be8Q5O",
    find: /.tutorialContainer,/,
    replace: '$&onContextMenu:$vxi.HMBA?.openContextMenu,'
})

export class HomeButtonContextMenuApi {
    items: Map<string, React.ReactElement | (() => React.ReactElement)>;
    constructor() {
        this.items = new Map();
        this.openContextMenu = this.openContextMenu.bind(this);
    }
    addItem(id: string, item: React.ReactElement | (() => React.ReactElement)) {
        this.items.set(id, item);
    }
    removeItem(id: string) {
        this.items.delete(id);
    }
    openContextMenu(event: React.MouseEvent) {
        const HomeButtonContextMenu = (props) => {
            const HomeButtonContextMenuItems = this.items.size
                ? Array.from(this.items.values())
                    .map((i) => (typeof i === "function" ? i() : i))
                    .filter(Boolean)
                    .sort((a, b) => a?.props?.label?.localeCompare(b?.props?.label))
                : [];
            return ( // yes I got permission uwu hes my bbg
                <MenuComponents.Menu {...props} navId="yofukashino">
                    {...HomeButtonContextMenuItems}
                </MenuComponents.Menu>
            );
        };
        openMenu(event, (props) => (
            <HomeButtonContextMenu {...props} onClose={() => closeAllModals} />
        ));
    }
}

export const HMBA = __self__.HMBA = new HomeButtonContextMenuApi();
