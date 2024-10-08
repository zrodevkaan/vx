import { Children, cloneElement } from "react";

import ErrorBoundary from "./boundary";
import { PopoutAlign, PopoutPosition } from "./popout";
import { SystemDesign } from "./util";

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

export interface PassedChildrenProps {
  ["aria-label"]: string,
  onBlur(): void,
  onFocus(): void,
  onClick(): void,
  onContextMenu(): void,
  onMouseEnter(): void,
  onMouseLeave(): void
};

export interface TooltipProps {
  allowOverflow?: boolean,
  color?: Lowercase<keyof TooltipColors>,
  forceOpen?: boolean,
  hide?: boolean,
  hideOnClick?: boolean,
  /** @note maybe? */
  position?: PopoutPosition,
  /** @note maybe? */
  align?: PopoutAlign,
  shouldShow?: boolean
  spacing?: number,
  text: React.ReactNode | string | null,
  children: (props: PassedChildrenProps) => React.ReactNode,
  "aria-label"?: string
};

export function Tooltip(props: TooltipProps) {
  return (
    <ErrorBoundary>
      <SystemDesign.Tooltip {...props} />
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
