"use client";

import type { CSSProperties, ReactNode } from "react";
import { useAnimatedMetric } from "./useAnimatedMetric";

function MetricValue({
  value,
  currency = true,
  style,
  animationKey,
}: {
  value: number;
  currency?: boolean;
  style?: CSSProperties;
  animationKey?: string | number;
}) {
  const text = useAnimatedMetric(value, 800, currency, animationKey);
  return (
    <span className="metric-val" style={style}>
      {text}
    </span>
  );
}

export interface MetricCardProps {
  id?: string;
  className?: string;
  style?: CSSProperties;
  iconBg: string;
  iconColor: string;
  iconSize?: number;
  iconPaths: string;
  title: string;
  titleStyle?: CSSProperties;
  value: number;
  currency?: boolean;
  valueStyle?: CSSProperties;
  valueFontSize?: number;
  animationKey?: string | number;
  onClick?: () => void;
}

/** Картка метрики як у old_boso_admin.html (mc-header + metric-icon + mc-body). */
export function MetricCard({
  id,
  className = "",
  style,
  iconBg,
  iconColor,
  iconSize = 22,
  iconPaths,
  title,
  titleStyle,
  value,
  currency = true,
  valueStyle,
  valueFontSize,
  animationKey,
  onClick,
}: MetricCardProps) {
  return (
    <div
      id={id}
      className={`metric-card${className ? ` ${className}` : ""}`}
      style={style}
      onClick={onClick}
    >
      <div className="mc-header">
        <div className="metric-icon" style={{ background: iconBg, color: iconColor }}>
          <svg
            width={iconSize}
            height={iconSize}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <g dangerouslySetInnerHTML={{ __html: iconPaths }} />
          </svg>
        </div>
      </div>
      <div className="mc-body">
        <span className="metric-title" style={titleStyle}>
          {title}
        </span>
        <MetricValue
          value={value}
          currency={currency}
          animationKey={animationKey}
          style={valueFontSize ? { fontSize: valueFontSize, ...valueStyle } : valueStyle}
        />
      </div>
    </div>
  );
}

export function MetricCardCustom({
  id,
  className = "",
  iconBg,
  iconColor,
  icon,
  title,
  titleStyle,
  children,
  onClick,
}: {
  id?: string;
  className?: string;
  iconBg: string;
  iconColor: string;
  icon: ReactNode;
  title: string;
  titleStyle?: CSSProperties;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div id={id} className={`metric-card${className ? ` ${className}` : ""}`} onClick={onClick}>
      <div className="mc-header">
        <div className="metric-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
      <div className="mc-body">
        <span className="metric-title" style={titleStyle}>
          {title}
        </span>
        {children}
      </div>
    </div>
  );
}
