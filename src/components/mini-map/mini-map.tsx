/* eslint-disable react/require-default-props */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useTransformContext,
  useTransformEffect,
  useTransformInit,
} from "hooks";
import { useResize } from "./use-resize.hook";
import { ReactZoomPanPinchRef } from "models";
import { boundLimiter } from "core/bounds/bounds.utils";

export type MiniMapProps = {
  children: React.ReactNode;
  width?: number;
  height?: number;
  borderColor?: string;
  panning?: boolean;
} & React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
>;

const previewStyles = {
  position: "absolute",
  zIndex: 2,
  top: "0px",
  left: "0px",
  boxSizing: "border-box",
  border: "3px solid red",
  transformOrigin: "0% 0%",
  boxShadow: "rgba(0,0,0,0.2) 0 0 0 10000000px",
  pointerEvents: "none",
} as const;

export const MiniMap: React.FC<MiniMapProps> = ({
  width = 200,
  height = 200,
  borderColor = "red",
  children,
  panning = true,
  ...rest
}) => {
  const [initialized, setInitialized] = useState(false);
  const instance = useTransformContext();
  const [isDown, setIsDown] = useState(false);
  const miniMapInstance = useRef<ReactZoomPanPinchRef>(null);

  const mainRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const computationCache = useRef({
    scale: 1,
    width: 0,
    height: 0,
  });

  const getContentSize = useCallback(() => {
    if (instance.contentComponent) {
      const rect = instance.contentComponent.getBoundingClientRect();

      return {
        width: rect.width / instance.transformState.scale,
        height: rect.height / instance.transformState.scale,
      };
    }
    return {
      width: 0,
      height: 0,
    };
  }, [instance.contentComponent, instance.transformState.scale]);

  const computeMiniMapScale = useCallback(() => {
    const contentSize = getContentSize();
    const scaleX = width / contentSize.width;
    const scaleY = height / contentSize.height;
    const scale = scaleY > scaleX ? scaleX : scaleY;

    return scale;
  }, [getContentSize, height, width]);

  const computeMiniMapSize = () => {
    const contentSize = getContentSize();
    const scaleX = width / contentSize.width;
    const scaleY = height / contentSize.height;
    if (scaleY > scaleX) {
      return { width, height: contentSize.height * scaleX };
    }
    return { width: contentSize.width * scaleY, height };
  };

  const computeMiniMapStyle = () => {
    const scale = computeMiniMapScale();
    const style = {
      transform: `scale(${scale || 1})`,
      transformOrigin: "0% 0%",
      position: "absolute",
      boxSizing: "border-box",
      zIndex: 1,
      // overflow: "hidden",
    } as const;

    Object.keys(style).forEach((key) => {
      if (wrapperRef.current) {
        wrapperRef.current.style[key] = style[key];
      }
    });
  };

  const transformMiniMap = () => {
    computeMiniMapStyle();
    const miniSize = computeMiniMapSize();
    const wrapSize = getContentSize();
    if (wrapperRef.current) {
      wrapperRef.current.style.width = `${wrapSize.width}px`;
      wrapperRef.current.style.height = `${wrapSize.height}px`;
    }
    if (mainRef.current) {
      mainRef.current.style.width = `${miniSize.width}px`;
      mainRef.current.style.height = `${miniSize.height}px`;
    }
    if (previewRef.current) {
      const size = getContentSize();
      const scale = computeMiniMapScale();
      const previewScale = scale * (1 / instance.transformState.scale);
      const transform = instance.handleTransformStyles(
        -instance.transformState.positionX * previewScale,
        -instance.transformState.positionY * previewScale,
        1,
      );

      previewRef.current.style.transform = transform;
      previewRef.current.style.width = `${size.width * previewScale}px`;
      previewRef.current.style.height = `${size.height * previewScale}px`;
    }
  };

  const initialize = () => {
    transformMiniMap();
  };

  useTransformEffect(() => {
    transformMiniMap();
  });

  useTransformInit(() => {
    initialize();
    setInitialized(true);
  });

  useResize(instance.contentComponent, initialize, [initialized]);

  useEffect(() => {
    return instance.onChange((zpp) => {
      const scale = computeMiniMapScale();
      if (miniMapInstance.current) {
        miniMapInstance.current.instance.transformState.scale =
          zpp.instance.transformState.scale;
        miniMapInstance.current.instance.transformState.positionX =
          zpp.instance.transformState.positionX * scale;
        miniMapInstance.current.instance.transformState.positionY =
          zpp.instance.transformState.positionY * scale;
      }
    });
  }, [computeMiniMapScale, instance, miniMapInstance]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (panning && isDown && instance.contentComponent) {
        const scale = computeMiniMapScale();
        const previewRect = previewRef.current?.getBoundingClientRect()!;
        const mainRect = mainRef.current?.getBoundingClientRect()!;

        const relativeX = (e.clientX - mainRect.left) / scale;
        const relativeY = (e.clientY - mainRect.top) / scale;

        const x = relativeX - previewRect.width / 2;
        const y = relativeY - previewRect.height / 2;

        const instanceWidth =
          (instance.wrapperComponent?.offsetWidth || 0) *
          instance.transformState.scale;
        const instanceHeight =
          (instance.wrapperComponent?.offsetHeight || 0) *
          instance.transformState.scale;

        const limitWidth =
          instanceWidth - previewRect.width * 2 * instance.transformState.scale;
        const limitHeight =
          instanceHeight -
          previewRect.height * 2 * instance.transformState.scale;

        const boundedX = boundLimiter(
          x * instance.transformState.scale,
          0,
          limitWidth,
          true,
        );

        const boundedY = boundLimiter(
          y * instance.transformState.scale,
          0,
          limitHeight,
          true,
        );

        instance.setTransformState(
          instance.transformState.scale,
          -boundedX,
          -boundedY,
        );
      }
    };

    const setDown = (e: MouseEvent) => {
      if (
        mainRef.current?.contains(e.target as Node) ||
        e.target === mainRef.current
      ) {
        move(e);
        setIsDown(true);
      }
    };
    const setUp = () => {
      setIsDown(false);
    };
    document.addEventListener("mousedown", setDown);
    document.addEventListener("mouseup", setUp);
    document.addEventListener("mousemove", move);
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", setUp);
    };
  });

  const wrapperStyle = useMemo(() => {
    return {
      position: "relative",
      zIndex: 2,
      // overflow: "hidden",
      userSelect: "none",
    } as const;
  }, []);

  return (
    <div
      {...rest}
      ref={mainRef}
      style={wrapperStyle}
      className={`rzpp-mini-map ${rest.className || ""}`}
    >
      <div
        {...rest}
        style={{ pointerEvents: "none" }}
        ref={wrapperRef}
        className="rzpp-minimap-wrapper"
      >
        {children}
      </div>
      <div
        className="rzpp-minimap-preview"
        ref={previewRef}
        style={{ ...previewStyles, borderColor }}
      />
    </div>
  );
};
