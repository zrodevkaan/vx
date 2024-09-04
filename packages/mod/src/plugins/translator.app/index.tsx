import { definePlugin } from "../index";
import { Developers } from "../../constants";
import { MenuComponents, patch, unpatch } from "../../api/menu";
import { Injector } from "../../patcher";
import { bySource, getLazy } from "@webpack";
import {Markdown, Tooltip} from "../../components";
import * as styler from "./translate.css?managed";
import { createAbort, InternalStore } from "../../util";
import { useInternalStore } from "../../hooks";
import { MessageStore } from "@webpack/common";
import { useMemo } from "react";
import { getLocaleName } from "vx:i18n";

const injector = new Injector();

export const LANGUAGE_CODES: readonly string[] = [
    "BG",
    "ZH",
    "CS",
    "DA",
    "NL",
    "EN",
    "ET",
    "FI",
    "FR",
    "DE",
    "EL",
    "HU",
    "IT",
    "JA",
    "LV",
    "LT",
    "PL",
    "PT",
    "RO",
    "RU",
    "SK",
    "SL",
    "ES",
    "SV",
    "TR"
];

interface Translation {
    language: typeof LANGUAGE_CODES[number], 
    content: string, 
    translation: string
}

class TranslatedMessageStore extends InternalStore {
    #translations: Record<string, Record<string, Translation>> = {};
    public getTranslation(channelId: string, messageId: string): Translation | null {
        return this.#translations[channelId]?.[messageId] || null;
    }
    public async translate(channelId: string, messageId: string, language: typeof LANGUAGE_CODES[number]) {
        const message = MessageStore.getMessage(channelId, messageId);
        if (!message || !message.content) return;

        const translation = await window.VXNative!.translate(message.content, language);

        this.#translations[channelId] ??= {};
        this.#translations[channelId][messageId] = {
            translation, content: message.content, language
        };

        this.emit();
    }
    public deleteTranslation(channelId: string, messageId: string) {
        this.#translations[channelId] ??= {};
        delete this.#translations[channelId][messageId];

        this.emit();
    }
}

const translatedMessageStore = new TranslatedMessageStore();

const MessageContent = getLazy(bySource('VOICE_HANGOUT_INVITE?""'), { searchDefault: false });

const [ abort, getSignal ] = createAbort();

export default definePlugin({
    authors: [Developers.kaan],
    requiresRestart: false,
    styler,
    async start() {
        const signal = getSignal();

        patch("vx-translator", "message", (props, res) => {            
            const translation = useInternalStore(translatedMessageStore, () => translatedMessageStore.getTranslation(props.channel.id, props.message.id));
        
            res.props.children.push(
                <MenuComponents.MenuGroup key="translation-menu-group">
                    <MenuComponents.MenuItem label="Translate" id="vx-translate">
                        {LANGUAGE_CODES.map((lang) => (
                            <MenuComponents.MenuRadioItem
                                key={lang}
                                label={`Translate to ${getLocaleName(lang)}`}
                                id={`vx-translate-${lang}`}
                                action={() => {
                                    translatedMessageStore.translate(props.channel.id, props.message.id, lang);
                                }}
                                group="translation-group"
                                checked={translation?.language === lang}
                            />
                        ))}
                        <MenuComponents.MenuItem
                            key="reset"
                            label="Reset Translation"
                            id="vx-reset"
                            color={"danger"}
                            action={() => {
                                translatedMessageStore.deleteTranslation(props.channel.id, props.message.id);
                            }}
                        />
                    </MenuComponents.MenuItem>
                </MenuComponents.MenuGroup>
            );
        });

        const module = await MessageContent;

        if (signal.aborted) return;

        injector.after(module.default, "type", (_, [ props ]: any[], res) => {
            const translation = useInternalStore(translatedMessageStore, () => translatedMessageStore.getTranslation(props.message.channel_id, props.message.id));
            const isOutOfDate = useMemo(() => {
                if (!translation) return false;
                return translation.content !== props.message.content;
            }, [ translation, props.message.content ]);

            if (!translation) return;

            return injector.return([
                <div className="vx-translation">
                    <Tooltip text={`Translated into ${getLocaleName(translation.language)}${isOutOfDate ? "\nTranslation is out of date!" : ""}`}>
                        {(props) => (
                            <span {...props} className="vx-translation-languaage" data-vx-is-out-of-date={Boolean(isOutOfDate)}>
                                {translation.language}
                            </span>
                        )}
                    </Tooltip>
                    <Markdown text={translation.translation} />
                </div>,
                res
            ]);
        });

    },
    stop() {
        injector.unpatchAll();
        abort();
        unpatch("vx-translator");
    }
});