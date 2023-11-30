import { Children, cloneElement } from "react";

import { getProxyByProtoKeys } from "../webpack";
import ErrorBoundary from "./boundary";

interface TooltipColors {
  PRIMARY: string,
  BLACK: string,
  GREY: string,
  BRAND: string,
  GREEN: string,
  YELLOW: string,
  RED: string,
  CUSTOM: string,
  PREMIUM: string
};

interface PassedChildrenProps {
  ["aria-label"]: string,
  onBlur(): void,
  onFocus(): void,
  onClick(): void,
  onContextMenu(): void,
  onMouseEnter(): void,
  onMouseLeave(): void
};

interface TooltipProps {
  allowOverflow?: boolean,
  color?: string,
  forceOpen?: boolean,
  hide?: boolean,
  hideOnClick?: boolean,
  /** @note maybe? */
  position?: "top" | "bottom" | "left" | "right" | "center",
  /** @note maybe? */
  align?: "top" | "bottom" | "left" | "right" | "center",
  shouldShow?: boolean
  spacing?: number,
  text: string,
  children: (props: PassedChildrenProps) => React.ReactNode
};

const RawTooltip = getProxyByProtoKeys<React.FunctionComponent<TooltipProps> & { Colors: TooltipColors }>([ "renderTooltip", "shouldShowTooltip" ], { searchExports: true });

export function Tooltip(props: TooltipProps) {
  return (
    <ErrorBoundary>
      <RawTooltip {...props} />
    </ErrorBoundary>
  );
};

export function WrapTooltip(props: Omit<TooltipProps, "children"> & { children: React.ReactElement }) {
  return (
    <Tooltip {...props}>
      {(passedProps) => {
        const child = Children.only(props.children);
        
        return cloneElement(child, {
          ["aria-label"]: passedProps["aria-label"],
          onBlur(event: React.FocusEvent) {
            passedProps.onBlur();
            
            if (typeof child.props.onBlur === "function") return child.props.onBlur(event);  
          },
          onFocus(event: React.FocusEvent) {
            passedProps.onFocus();
            
            if (typeof child.props.onFocus === "function") return child.props.onFocus(event);  
          },
          onClick(event: React.MouseEvent) {
            passedProps.onClick();
            
            if (typeof child.props.onClick === "function") return child.props.onClick(event);  
          },
          onContextMenu(event: React.MouseEvent) {
            passedProps.onMouseLeave();
            
            if (typeof child.props.onContextMenu === "function") return child.props.onContextMenu(event);  
          },
          onMouseEnter(event: React.MouseEvent) {
            passedProps.onMouseEnter();
            
            if (typeof child.props.onMouseEnter === "function") return child.props.onMouseEnter(event);  
          },
          onMouseLeave(event: React.MouseEvent) {
            passedProps.onMouseLeave();
            
            if (typeof child.props.onMouseLeave === "function") return child.props.onMouseLeave(event);  
          }
        });
      }}
    </Tooltip>
  )
};
