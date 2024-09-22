import {definePlugin} from "../index";
import {Developers} from "../../constants";
import {Channel} from "discord-types/general";
import {useState} from "react";
import {Button, Icons} from "../../components";
import {getModule, getProxy, getProxyByKeys, getProxyStore} from "@webpack";
import {MessageActions, SelectedChannelStore} from "@webpack/common";
const buttonClasses = getProxyByKeys<Record<string, string>>([ "buttonWrapper", "pulseButton" ]);

const DraftStore = getProxyStore("DraftStore")
const PreviewIcon = getProxy(x=>x.EyeIcon)

function sendPreview() {
    const channelID = SelectedChannelStore.getChannelId();

    const draft = DraftStore.getDraft(channelID, 0);

    if (draft) {
        MessageActions.sendBotMessage(channelID, draft);
    }
}

export default definePlugin({
    authors: [Developers.kaan],
    requiresRestart: false,
    patches: {
        match: ".isSubmitButtonEnabled)",
        find: /return\(.+&&(.{1,3}?)\.push.+{disabled:.{1,3},type:.{1,3}}/,
        replace: "$self._addButton($1,arguments[0],$enabled);$&"
    },
    _addButton(buttons: React.ReactNode[], props: { type: { analyticsName: string }, channel: Channel, disabled: boolean }, enabled: boolean) {
        if (props.type.analyticsName !== "normal") return;
        if (props.disabled) return;
        if (!enabled) return;
        
        buttons.push(
            <div className={"vx-textarea-button-container"}>
                <Button
                    look={Button.Looks.BLANK}
                    size={Button.Sizes.NONE}
                    className={buttonClasses.active}
                    onClick={() => {
                        sendPreview()
                    }}
                    innerClassName="vx-textarea-button-inner"
                    // @ts-expect-error idk the typings for this, so
                    focusProps={{
                        offset: {
                            top: 4,
                            bottom: 4
                        }
                    }}
                >
                    <PreviewIcon.EyeIcon {...{color: "var(--interactive-normal)"}} />
                </Button>
            </div>
        )

    }
})