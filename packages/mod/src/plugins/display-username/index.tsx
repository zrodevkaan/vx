import { definePlugin } from "..";
import { Developers } from "../../constants";
import { Message, User } from "discord-types/general";
import { React } from "../../webpack/common";
import { ErrorBoundary } from "../../components";

import { addStyle } from "./index.css?managed";

type TypedUser = User & { isPomelo(): boolean, globalName: string | null };

export default definePlugin({
  name: "DisplayUsername",
  description: "Shows the users",
  authors: [ Developers.doggybootsy ],
  patches: {
    match: "showCommunicationDisabledStyles:",
    find: /,(.{1,3}&&!.{1,3}&&\(.+?getMessageTimestampId\)\((.{1,3})\))/,
    replace: ",$react.createElement($self.DisplayUsername,$2),$1"
  },
  start() {
    addStyle();
  },
  DisplayUsername: ErrorBoundary.wrap((message: Message & { author: TypedUser }) => {
    const isPomelo = React.useMemo(() => message.author.isPomelo() || (message.author.discriminator === "0000"), [ message ]);

    if (isPomelo && !message.author.globalName) return;
  
    return (
      <span className="vx-display-username">
        {isPomelo ? "@" : ""}
        {message.author.username}
        {!isPomelo ? `#${message.author.discriminator}` : ""}
      </span>
    );
  })
});