import { Panel } from "../..";
import { Button, Flex, FlexChild, Icons, Tooltip } from "../../../components";
import { useInternalStore } from "../../../hooks";
import { CustomCSSCard } from "./card";
import { customCSSStore } from "./store";

export function CustomCSS() {
  const entries = useInternalStore(customCSSStore, () => customCSSStore.keys());

  return (
    <Panel
      title="Custom CSS"
      buttons={
        <>
          <Tooltip text="New">
            {(props) => (
              <Button
                {...props}
                size={Button.Sizes.NONE}
                look={Button.Looks.BLANK} 
                className="vx-header-button"
                onClick={() => {
                  props.onClick();

                  customCSSStore.new();
                }}
              >
                <Icons.Plus />
              </Button>
            )}
          </Tooltip>
        </>
      }
    >
      <Flex className="vx-addons" direction={Flex.Direction.VERTICAL} gap={8}>
        {entries.map((key) => (
          <FlexChild key={`vx-c-${key}`} >
            <CustomCSSCard id={key} />
          </FlexChild>
        ))}
      </Flex>
    </Panel>
  );
};